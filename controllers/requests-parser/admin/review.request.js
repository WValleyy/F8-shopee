import {
    readBoolean,
    readEnum,
    readObjectBody,
    readObjectId,
} from '../shared/request-value.js';
import { parseAdminListQuery } from './admin-list-query.js';

function parseAdminReviewQuery(query = {}) {
    return {
        ...parseAdminListQuery(query),
        status: readEnum(
            query.status,
            'status',
            ['all', 'published', 'hidden'],
            { defaultValue: 'all' },
        ),
        rating: readEnum(
            query.rating,
            'rating',
            ['all', '1', '2', '3', '4', '5'],
            { defaultValue: 'all' },
        ),
        images: readEnum(
            query.images,
            'images',
            ['all', 'with-images', 'without-images'],
            { defaultValue: 'all' },
        ),
        sort: readEnum(
            query.sort,
            'sort',
            ['newest', 'oldest', 'helpful'],
            { defaultValue: 'newest' },
        ),
        product: readObjectId(query.product, 'product', { required: false }),
    };
}

function parseReviewPublicationInput(rawBody) {
    const body = readObjectBody(rawBody);
    return { isPublished: readBoolean(body.isPublished, 'isPublished') };
}

export {
    parseAdminReviewQuery,
    parseReviewPublicationInput,
};
