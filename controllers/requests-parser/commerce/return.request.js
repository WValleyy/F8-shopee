import { requestError } from '../../../utils/error/app-error.js';
import {
    readNumber,
    readObjectBody,
    readObjectId,
} from '../shared/request-value.js';

function parseReturnRequestInput(rawBody) {
    const body = readObjectBody(rawBody);
    if (!Array.isArray(body.items))
        throw requestError('FIELD_MUST_BE_ARRAY', {
            messageParams: { fieldLabel: 'items' },
        });

    const items = body.items.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            throw requestError('RETURN_ITEM_INVALID');
        const variantId = readObjectId(
            item.variantId,
            `items[${index}].variantId`,
        );
        const quantity = readNumber(
            item.quantity,
            `items[${index}].quantity`,
            { integer: true },
        );

        return { variantId, quantity };
    });

    return {
        items,
    };
}

export { parseReturnRequestInput };
