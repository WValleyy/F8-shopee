import inputLimits from '../../../config/input-limits.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    readNumber,
    readObjectBody,
    readObjectId,
    readRequiredString,
} from '../shared/request-value.js';

function parseReturnRequestInput(rawBody, headerRequestKey = '') {
    const body = readObjectBody(rawBody);
    const requestKey = readRequiredString(
        headerRequestKey,
        'X-Request-Key',
        { maxLength: inputLimits.return.requestKeyMaxLength },
    );
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
        requestKey,
        items,
    };
}

export { parseReturnRequestInput };
