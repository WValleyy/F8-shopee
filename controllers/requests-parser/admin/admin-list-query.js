import inputLimits from '../../../config/input-limits.js';
import {
    readOptionalString,
    readPositiveIntegerQuery,
} from '../shared/request-value.js';

function parseAdminListQuery(query = {}) {
    return {
        q: readOptionalString(query.q, 'q', {
            collapseWhitespace: true,
            maxLength: inputLimits.search.queryMaxLength,
        }),
        page: readPositiveIntegerQuery(query.page),
    };
}

export { parseAdminListQuery };
