import { requestError } from '../../../utils/error/app-error.js';
import {
    readBoolean,
    readEnum,
    readObjectBody,
} from '../shared/request-value.js';
import { parseAdminListQuery } from './admin-list-query.js';

function parseUserManagementQuery(query = {}) {
    const minimumSpend = readSpendQuery(query.minimumSpend, 'minimumSpend');
    const maximumSpend = readSpendQuery(query.maximumSpend, 'maximumSpend');

    if (
        minimumSpend != null
        && maximumSpend != null
        && maximumSpend < minimumSpend
    ) {
        throw requestError('MAXIMUM_SPEND_BELOW_MINIMUM');
    }

    return {
        ...parseAdminListQuery(query),
        status: readEnum(
            query.status,
            'status',
            ['all', 'active', 'blocked', 'pending-deletion'],
            { defaultValue: 'all' },
        ),
        role: readEnum(
            query.role,
            'role',
            ['all', 'USER', 'ADMIN'],
            { defaultValue: 'all' },
        ),
        minimumSpend,
        maximumSpend,
    };
}

function parseUserActivationInput(rawBody) {
    const body = readObjectBody(rawBody);
    return { isActive: readBoolean(body.isActive, 'isActive') };
}

function readSpendQuery(value, label) {
    if (value == null || value === '')
        return null;
    if (typeof value !== 'string' || !/^\d+$/.test(value))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        });
    const result = Number(value);
    if (!Number.isSafeInteger(result))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        });
    return result;
}

export {
    parseUserActivationInput,
    parseUserManagementQuery,
};
