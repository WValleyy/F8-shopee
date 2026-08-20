import { requestError } from '../../../utils/error/app-error.js';
import {
    readEnum,
    readNumber,
    readObjectBody,
    readObjectId,
} from '../shared/request-value.js';

function parseCreateCheckoutDraftInput(rawBody) {
    const body = readObjectBody(rawBody);

    if (!Array.isArray(body.items) || !body.items.length) {
        throw requestError('FIELD_MUST_BE_NON_EMPTY_ARRAY', {
            messageParams: { fieldLabel: 'items' },
        });
    }

    return {
        source: readEnum(body.source, 'source', ['cart', 'buy-now']),
        items: body.items.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw requestError('FIELD_INVALID', {
                    messageParams: { fieldLabel: 'items' },
                });
            }

            return {
                variantId: readObjectId(
                    item.variantId,
                    `items[${index}].variantId`,
                ),
                quantity: readNumber(
                    item.quantity,
                    `items[${index}].quantity`,
                    { integer: true },
                ),
            };
        }),
    };
}

export {
    parseCreateCheckoutDraftInput,
};

function parseCheckoutPageQuery(query = {}) {
    return {
        draftId: readObjectId(query.draft, 'draft'),
    };
}

function parseCheckoutAddressQuery(query = {}) {
    return {
        selectedAddressId: readObjectId(
            query.selectedAddressId,
            'selectedAddressId',
            { required: false },
        ),
    };
}

export {
    parseCheckoutAddressQuery,
    parseCheckoutPageQuery,
};
