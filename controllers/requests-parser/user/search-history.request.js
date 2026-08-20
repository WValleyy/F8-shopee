import inputLimits from '../../../config/input-limits.js';
import {
    readObjectBody,
    readRequiredString,
} from '../shared/request-value.js';

function parseSearchHistoryInput(rawBody) {
    const body = readObjectBody(rawBody);
    const query = readRequiredString(body.query, 'Search query', {
        collapseWhitespace: true,
        maxLength: inputLimits.search.queryMaxLength,
    });
    return {
        query,
        normalizedQuery: query.toLocaleLowerCase('vi-VN'),
    };
}

export { parseSearchHistoryInput };
