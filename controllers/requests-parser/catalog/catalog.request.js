import inputLimits from '../../../config/input-limits.js';
import { catalogSortGroups } from '../../../config/catalog.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    readOptionalString,
    readPositiveIntegerQuery,
} from '../shared/request-value.js';

function parseSort(value) {
    if (value == null || value === '')
        return [];
    if (typeof value !== 'string')
        throw requestError('CATALOG_SORT_INVALID');
    const criteria = value.split(',').map(item => item.trim()).filter(Boolean);
    const groups = criteria.map(item => catalogSortGroups[item]);
    if (
        !criteria.length
        || groups.some(group => !group)
        || new Set(criteria).size !== criteria.length
        || new Set(groups).size !== groups.length
    ) {
        throw requestError('CATALOG_SORT_INVALID');
    }
    return criteria;
}

function parseCatalogQuery(query = {}) {
    return {
        category: readOptionalString(query.category, 'category', {
            defaultValue: 'all',
        }),
        sort: parseSort(query.sort),
        q: readOptionalString(query.q, 'q', {
            collapseWhitespace: true,
            maxLength: inputLimits.search.queryMaxLength,
        }),
        page: readPositiveIntegerQuery(query.page),
    };
}

function parseSearchSuggestionQuery(query = {}) {
    return {
        q: readOptionalString(query.q, 'q', {
            collapseWhitespace: true,
            maxLength: inputLimits.search.queryMaxLength,
        }),
    };
}

export {
    parseCatalogQuery,
    parseSearchSuggestionQuery,
};
