import { requestError } from '../../../utils/error/app-error.js';
import {
    readRequiredString,
} from '../shared/request-value.js';

const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseProductSlugParam(value) {
    const slug = readRequiredString(value, 'Product slug');
    if (!PRODUCT_SLUG_PATTERN.test(slug))
        throw requestError('PRODUCT_SLUG_INVALID');
    return slug;
}

export {
    parseProductSlugParam,
};
