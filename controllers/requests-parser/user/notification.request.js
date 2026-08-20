import { readPositiveIntegerQuery } from '../shared/request-value.js';

function parseNotificationQuery(query = {}) {
    return { page: readPositiveIntegerQuery(query.page) };
}

export { parseNotificationQuery };
