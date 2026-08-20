import inputLimits from '../../../config/input-limits.js';
import {
    readBoolean,
    readEnum,
    readNumber,
    readObjectBody,
    readObjectId,
    readRequiredString,
} from '../shared/request-value.js';
import { parseAdminListQuery } from './admin-list-query.js';

function parseAdminCategoryQuery(query = {}) {
    return {
        ...parseAdminListQuery(query),
        status: readEnum(
            query.status,
            'status',
            ['all', 'active', 'hidden'],
            { defaultValue: 'all' },
        ),
    };
}

function parseCategoryInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        name: readRequiredString(body.name, 'name', {
            maxLength: inputLimits.category.nameMaxLength,
        }),
        parentId: readObjectId(body.parentId, 'parentId', {
            required: false,
        }),
        sortOrder: readNumber(body.sortOrder, 'sortOrder', {
            integer: true,
            min: 0,
        }),
        isActive: readBoolean(body.isActive, 'isActive', true),
    };
}

export {
    parseAdminCategoryQuery,
    parseCategoryInput,
};
