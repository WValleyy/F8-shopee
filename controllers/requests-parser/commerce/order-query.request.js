import inputLimits from '../../../config/input-limits.js';
import {
    readEnum,
    readOptionalString,
    readPositiveIntegerQuery,
} from '../shared/request-value.js';

function parsePurchaseQuery(query = {}) {
    return {
        tab: readEnum(
            query.tab,
            'tab',
            [
                'all',
                'delivering',
                'completed',
                'cancelled',
                'return-refund',
            ],
            { defaultValue: 'all' },
        ),
        q: readOptionalString(query.q, 'q', {
            collapseWhitespace: true,
            maxLength: inputLimits.search.queryMaxLength,
        }),
        page: readPositiveIntegerQuery(query.page),
    };
}

export { parsePurchaseQuery };
