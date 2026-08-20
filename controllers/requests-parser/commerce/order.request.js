import inputLimits from '../../../config/input-limits.js';
import {
    readEnum,
    readObjectBody,
    readObjectId,
    readOptionalString,
} from '../shared/request-value.js';

function readOrderSelection(body) {
    return {
        note: readOptionalString(body.note, 'note', {
            maxLength: inputLimits.order.noteMaxLength,
        }),
        draftId: readObjectId(body.draftId, 'draftId'),
        selectedAddressId: readObjectId(
            body.selectedAddressId,
            'selectedAddressId',
        ),
    };
}

function parseCreateOrderInput(rawBody) {
    const body = readObjectBody(rawBody);
    return readOrderSelection(body);
}

function parseUserOrderActionInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        action: readEnum(body.action, 'action', ['cancel', 'complete']),
    };
}

export {
    parseCreateOrderInput,
    parseUserOrderActionInput,
};
