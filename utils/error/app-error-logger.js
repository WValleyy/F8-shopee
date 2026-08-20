import { mkdir, appendFile } from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';

import appLogConfig from '../../config/app-log.js';
import AppLog from '../../models/system/app-log.model.js';

const LOG_DIRECTORY = path.join(process.cwd(), 'logs');
const APP_LOG_PATH = path.join(LOG_DIRECTORY, 'app.logs');
const shouldWriteFileLog = process.env.VERCEL !== '1';
const SUMMARY_KEYS = ['error', 'message', 'reason'];
const OMITTED_CONTEXT_KEYS = new Set([
    ...SUMMARY_KEYS,
    'stack',
    'cause',
]);

function truncate(value, maxLength) {
    return String(value || '').slice(0, maxLength);
}

function normalizeContext(context) {
    if (context instanceof Error) {
        return {
            error: context.message,
            stack: context.stack || '',
        };
    }

    if (context && typeof context === 'object' && !Array.isArray(context))
        return context;

    return { value: context };
}

function getMessage(scope, context) {
    for (const key of SUMMARY_KEYS) {
        const value = context[key];

        if (typeof value === 'string' && value.trim()) {
            return truncate(
                value.trim(),
                appLogConfig.messageMaxLength,
            );
        }
    }

    return truncate(
        scope.split(/[-_:]+/).filter(Boolean).join(' '),
        appLogConfig.messageMaxLength,
    );
}

function normalizeAppLog(scopeValue, severity, contextValue = {}) {
    const scope = truncate(scopeValue, appLogConfig.scopeMaxLength)
        || 'application';
    const sourceContext = normalizeContext(contextValue);
    const context = Object.fromEntries(
        Object.entries(sourceContext)
            .filter(([key]) => !OMITTED_CONTEXT_KEYS.has(key)),
    );
    const stack = truncate(
        sourceContext.stack,
        appLogConfig.stackMaxLength,
    );
    const message = getMessage(scope, sourceContext);
    let searchText = '';

    try {
        searchText = JSON.stringify({
            scope,
            message,
            context,
            stack,
        });
    } catch {
        searchText = `${scope} ${message}`;
    }

    return {
        scope,
        severity,
        message,
        context,
        stack,
        searchText: truncate(
            searchText.toLowerCase(),
            appLogConfig.searchTextMaxLength,
        ),
    };
}

function formatLogEntry(log, timestamp) {
    let serializedContext = '';

    try {
        serializedContext = JSON.stringify(log.context);
    } catch (error) {
        serializedContext = JSON.stringify({
            error: 'Log context could not be serialized.',
            serializationError: error?.message || String(error),
        });
    }

    return [
        `[${timestamp.toISOString()}]`,
        `[${log.severity.toUpperCase()}]`,
        `[${log.scope}]`,
        `[message] ${log.message}`,
        serializedContext,
        ...(log.stack ? [`[stack]\n${log.stack}`] : []),
        '',
    ].join('\n');
}

async function appendFileLog(entry, scope, context) {
    try {
        await mkdir(LOG_DIRECTORY, { recursive: true });
        await appendFile(APP_LOG_PATH, entry, 'utf8');
    } catch (error) {
        console.error('[app-logger] failed to write file log', {
            scope,
            context,
            error: error?.message || String(error),
        });
    }
}

async function insertMongoLog(log, timestamp) {
    if (mongoose.connection.readyState !== 1)
        return;

    try {
        await AppLog.create({
            ...log,
            createdAt: timestamp,
        });
    } catch (error) {
        console.error('[app-logger] failed to write MongoDB log', {
            scope: log.scope,
            error: error?.message || String(error),
        });
    }
}

async function logAppEvent(scope, severity, context = {}) {
    const timestamp = new Date();
    const log = normalizeAppLog(scope, severity, context);
    const entry = formatLogEntry(log, timestamp);
    const writers = [insertMongoLog(log, timestamp)];

    if (shouldWriteFileLog)
        writers.unshift(appendFileLog(entry, log.scope, log.context));

    await Promise.all(writers);
}

export {
    logAppEvent,
    normalizeAppLog,
};
