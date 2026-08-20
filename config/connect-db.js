import mongoose from 'mongoose';

import env from '../config/load-env.js';
import { logAppEvent } from '../utils/error/app-error-logger.js';

const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 1000, 3000];
const NON_RETRYABLE_MONGODB_CODES = new Set([13, 18]);

let activeConnectionPromise = null;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorCode(error) {
    return error?.code
        ?? error?.cause?.code
        ?? error?.reason?.code;
}

function isRetryableConnectionError(error) {
    if (NON_RETRYABLE_MONGODB_CODES.has(getErrorCode(error)))
        return false;

    return [
        'MongoNetworkError',
        'MongoNetworkTimeoutError',
        'MongoServerSelectionError',
    ].includes(error?.name);
}

function summarizeTopology(error) {
    const servers = error?.reason?.servers;

    if (!(servers instanceof Map))
        return [];

    return Array.from(servers.entries()).map(([address, description]) => ({
        address,
        type: description?.type,
        error: description?.error?.message || null,
    }));
}

async function connectWithRetry(uri, dbName) {
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
        try {
            await mongoose.connect(uri, {
                dbName,
                connectTimeoutMS: 10000,
                serverSelectionTimeoutMS: 15000,
            });

            console.log('Connected to MongoDB.');

            return mongoose.connection;
        } catch (error) {
            const shouldRetry = attempt < MAX_CONNECT_ATTEMPTS
                && isRetryableConnectionError(error);

            if (!shouldRetry)
                throw error;

            const nextDelayMs = RETRY_DELAYS_MS[attempt] ?? 3000;

            await logAppEvent('mongodb:connect-retry', 'warning', {
                attempt,
                maxAttempts: MAX_CONNECT_ATTEMPTS,
                nextDelayMs,
                error: error?.message || String(error),
                errorName: error?.name,
                errorCode: getErrorCode(error) ?? null,
                beforeHandshake: Boolean(error?.beforeHandshake),
                topology: summarizeTopology(error),
            });

            await wait(nextDelayMs);
        }
    }

    throw new Error('MongoDB connection attempts exhausted.');
}

async function connectDB(options = {}) {
    const uri = options.uri || env.database.uri;
    const dbName = options.dbName || env.database.name;

    if (!uri)
        throw new Error('MONGODB_URI is required to start the server.');

    if (mongoose.connection.readyState === 1)
        return mongoose.connection;

    if (activeConnectionPromise)
        return activeConnectionPromise;

    mongoose.set('strictQuery', true);

    activeConnectionPromise = connectWithRetry(uri, dbName);

    try {
        return await activeConnectionPromise;
    } finally {
        activeConnectionPromise = null;
    }
}

export default connectDB;
