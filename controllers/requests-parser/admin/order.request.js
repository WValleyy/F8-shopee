import {
    readEnum,
    readObjectBody,
} from '../shared/request-value.js';
import { parseAdminListQuery } from './admin-list-query.js';

function parseAdminOrderQuery(query = {}) {
    return {
        ...parseAdminListQuery(query),
        status: readEnum(
            query.status,
            'status',
            ['all', 'SHIPPING', 'COMPLETED', 'REFUNDED', 'CANCELLED'],
            { defaultValue: 'all' },
        ),
    };
}

function parseAdminOrderActionInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        action: readEnum(
            body.action,
            'action',
            ['complete', 'cancel'],
        ),
    };
}

export {
    parseAdminOrderQuery,
    parseAdminOrderActionInput,
};
