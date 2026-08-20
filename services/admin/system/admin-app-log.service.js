import paginationConfig from '../../../config/pagination.js';
import AppLog from '../../../models/system/app-log.model.js';
import { buildPagination } from '../../../utils/pagination.js';
import { escapeRegex } from '../../../utils/regex.js';

const LOG_TIME_ZONE = 'Asia/Ho_Chi_Minh';

async function listAdminAppLogsPage(options = {}) {
    const filters = {
        q: options.q || '',
        date: options.date || '',
        hour: options.hour || 'all',
        scope: options.scope || 'all',
    };
    const match = buildLogMatch(filters);
    const [totalItems, scopeOptions] = await Promise.all([
        AppLog.countDocuments(match),
        AppLog.distinct('scope'),
    ]);
    const pagination = buildPagination({
        page: options.page || 1,
        limit: paginationConfig.appLogs,
        totalItems,
    });
    const normalizedScopes = scopeOptions
        .filter(scope => typeof scope === 'string' && scope)
        .sort((left, right) => left.localeCompare(right));
    const logs = await AppLog
        .find(match)
        .select('scope severity message context stack createdAt')
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * paginationConfig.appLogs)
        .limit(paginationConfig.appLogs)
        .lean();

    return {
        logs: logs.map(log => ({
            scope: log.scope,
            severity: log.severity,
            message: log.message,
            context: log.context,
            stack: log.stack,
            createdAt: log.createdAt,
        })),
        filters,
        scopeOptions: normalizedScopes,
        pagination,
    };
}

function getVietnamTimeRange(date, hour = '') {
    const start = new Date(
        `${date}T${hour || '00'}:00:00.000+07:00`,
    );
    const duration = hour ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    return {
        $gte: start,
        $lt: new Date(start.getTime() + duration),
    };
}

function buildLogMatch(filters) {
    const match = {};

    if (filters.scope !== 'all')
        match.scope = filters.scope;

    if (filters.q) {
        match.searchText = new RegExp(
            escapeRegex(filters.q.toLowerCase()),
            'i',
        );
    }

    if (filters.date) {
        match.createdAt = getVietnamTimeRange(
            filters.date,
            filters.hour === 'all' ? '' : filters.hour,
        );
    } else if (filters.hour !== 'all') {
        match.$expr = {
            $eq: [
                {
                    $hour: {
                        date: '$createdAt',
                        timezone: LOG_TIME_ZONE,
                    },
                },
                Number(filters.hour),
            ],
        };
    }

    return match;
}

export {
    listAdminAppLogsPage,
};
