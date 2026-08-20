import appLogConfig from '../../../config/app-log.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    readOptionalString,
} from '../shared/request-value.js';
import { parseAdminListQuery } from './admin-list-query.js';

function isCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function parseAdminAppLogQuery(query = {}) {
    const date = readOptionalString(query.date, 'date');
    const hour = readOptionalString(query.hour, 'hour', {
        defaultValue: 'all',
    });

    if (date && !isCalendarDate(date))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: 'Ngày' },
        });
    if (hour !== 'all' && !/^(?:[01]\d|2[0-3])$/.test(hour))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: 'Giờ' },
        });

    return {
        ...parseAdminListQuery(query),
        date,
        hour,
        scope: readOptionalString(query.scope, 'scope', {
            defaultValue: 'all',
            maxLength: appLogConfig.scopeMaxLength,
        }),
    };
}

export { parseAdminAppLogQuery };
