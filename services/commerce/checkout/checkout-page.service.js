import { requestError } from '../../../utils/error/app-error.js';
import { listAddresses } from '../../user/address.service.js';
import { buildCheckoutSelection } from './checkout-state.service.js';
import {
    getActiveCheckoutDraft,
    toCheckoutSelection,
} from './checkout-draft.service.js';

async function getCheckoutPageState(userId, draftId) {
    const { selection } = await getAvailableCheckoutDraftState(
        userId,
        draftId,
    );

    const addresses = await listAddresses(userId);
    const selectedAddress = addresses.find(address => address.isDefault)
        || null;
    return {
        items: selection.items,
        address: selectedAddress,
        addresses,
        totalAmount: selection.totalAmount,
    };
}

async function getAvailableCheckoutDraftState(userId, draftId) {
    const draft = await getActiveCheckoutDraft(userId, draftId);
    const draftSelection = toCheckoutSelection(draft);

    if (!draftSelection)
        throw requestError('CHECKOUT_EXPIRED');

    const selection = await buildCheckoutSelection({
        checkoutSource: draftSelection.source,
        selectedItems: draftSelection.items,
    });

    if (selection.hasUnavailableItems)
        throw requestError('CHECKOUT_ITEMS_UNAVAILABLE');

    return { selection };
}

export {
    getCheckoutPageState,
};
