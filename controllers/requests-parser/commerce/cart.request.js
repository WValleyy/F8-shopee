import {
    readNumber,
    readObjectBody,
    readObjectId,
    readObjectIdArray,
} from '../shared/request-value.js';
import { requestError } from '../../../utils/error/app-error.js';

function parseAddCartItemInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        variantId: readObjectId(body.variantId, 'variantId'),
        quantity: readNumber(body.quantity, 'quantity', {
            required: false,
            defaultValue: 1,
            integer: true,
        }),
    };
}

function parseUpdateCartItemInput(rawBody) {
    const body = readObjectBody(rawBody);
    if (!Object.hasOwn(body, 'quantity'))
        throw requestError('NO_FIELDS_TO_UPDATE');
    return {
        quantity: readNumber(body.quantity, 'quantity', {
            integer: true,
        }),
    };
}

function parseRemoveCartItemsInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        variantIds: readObjectIdArray(body.variantIds, 'variantIds'),
    };
}

export {
    parseAddCartItemInput,
    parseRemoveCartItemsInput,
    parseUpdateCartItemInput,
};
