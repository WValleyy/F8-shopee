import inputLimits from '../../../config/input-limits.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    readFormNumber,
    readObjectBody,
    readObjectId,
    readOptionalString,
    readPositiveIntegerQuery,
} from '../shared/request-value.js';

function parseCreateReviewInput(rawBody, images = []) {
    const body = readObjectBody(rawBody);
    return {
        orderId: readObjectId(body.orderId, 'orderId'),
        variantId: readObjectId(body.variantId, 'variantId'),
        rating: readFormNumber(body.rating, 'rating', {
            integer: true,
            min: 1,
            max: 5,
        }),
        content: readOptionalString(body.content, 'content', {
            maxLength: inputLimits.review.contentMaxLength,
        }),
        images,
    };
}

function parseProductReviewQuery(query = {}) {
    let rating = null;
    const rawRating = query.rating;

    if (rawRating != null && rawRating !== '') {
        if (typeof rawRating !== 'string' || !/^[1-5]$/.test(rawRating)) {
            throw requestError('REVIEW_RATING_INVALID');
        }
        rating = Number(rawRating);
    }

    return {
        rating,
        page: readPositiveIntegerQuery(query.page, 'page'),
    };
}

export {
    parseCreateReviewInput,
    parseProductReviewQuery,
};
