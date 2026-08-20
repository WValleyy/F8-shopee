import mongoose from 'mongoose';

import commerceConfig from '../../../config/commerce.js';
import CheckoutDraft from '../../../models/commerce/checkout-draft.model.js';
import User from '../../../models/user/user.model.js';
import { requestError } from '../../../utils/error/app-error.js';

import { buildCheckoutSelection } from './checkout-state.service.js';

async function createCheckoutDraft(userId, source, items) {
    const selectedItems = normalizeCheckoutDraftItems(items);
    const selection = await buildCheckoutSelection({
        checkoutSource: source,
        selectedItems,
    });

    if (selection.hasUnavailableItems)
        throw requestError('CHECKOUT_ITEMS_UNAVAILABLE');

    const snapshotItems = selection.items.map(item => ({
        variant: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
    }));

    const subtotal = snapshotItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
    );
    const exceedsOrderLimit = snapshotItems.some(item => (
        item.quantity > commerceConfig.order.maxItemQuantity
        || item.unitPrice > commerceConfig.order.maxUnitPrice
    )) || !Number.isSafeInteger(subtotal)
        || subtotal > commerceConfig.order.maxTotalAmount;

    if (exceedsOrderLimit)
        throw requestError('CHECKOUT_ORDER_LIMIT_EXCEEDED');

    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const userLock = await User.updateOne(
                { _id: userId, isActive: true, role: 'USER' },
                { $currentDate: { updatedAt: true } },
                { session },
            );

            if (userLock.matchedCount !== 1)
                throw requestError('SESSION_REVOKED');

            const now = new Date();
            const activeDraftFilter = {
                user: userId,
                expiresAt: { $gt: now },
            };
            const activeDraftCount = await CheckoutDraft.countDocuments(
                activeDraftFilter,
            ).session(session);

            if (activeDraftCount >= commerceConfig.checkoutDraft.maxActive) {
                const oldestDraft = await CheckoutDraft.findOne(
                    activeDraftFilter,
                )
                    .sort({ createdAt: 1, _id: 1 })
                    .select('_id')
                    .session(session)
                    .lean();

                if (oldestDraft) {
                    await CheckoutDraft.deleteOne({
                        _id: oldestDraft._id,
                        user: userId,
                    }).session(session);
                }
            }

            const [draft] = await CheckoutDraft.create([{
                user: userId,
                source,
                items: snapshotItems,
                expiresAt: new Date(
                    Date.now()
                    + commerceConfig.checkoutDraft.ttlMinutes * 60 * 1000,
                ),
            }], { session });

            return { draftId: draft._id.toString() };
        });
    } finally {
        await session.endSession();
    }
}

async function getActiveCheckoutDraft(userId, draftId, options = {}) {
    const {
        session,
    } = options;
    const filter = {
        _id: draftId,
        user: userId,
        expiresAt: { $gt: new Date() },
    };

    const query = CheckoutDraft.findOne(filter)
        .select('source items.variant items.quantity items.unitPrice')
        .lean();

    if (session)
        query.session(session);

    return query;
}

async function deleteCheckoutDraftInTransaction(
    userId,
    draftId,
    session,
) {
    const result = await CheckoutDraft.deleteOne({
        _id: draftId,
        user: userId,
        expiresAt: { $gt: new Date() },
    }).session(session);

    if (result.deletedCount !== 1)
        throw requestError('CHECKOUT_EXPIRED');
}

function toCheckoutSelection(draft) {
    if (!draft)
        return null;

    return {
        source: draft.source,
        items: draft.items.map(item => ({
            variantId: String(item.variant),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        })),
    };
}

function normalizeCheckoutDraftItems(items) {
    const quantities = new Map();

    for (const { variantId, quantity } of items) {
        const nextQuantity = (quantities.get(variantId) || 0) + quantity;

        if (
            !Number.isSafeInteger(nextQuantity)
            || nextQuantity < 1
            || nextQuantity > commerceConfig.order.maxItemQuantity
        )
            throw requestError('CART_ITEM_QUANTITY_INVALID');

        quantities.set(variantId, nextQuantity);
    }

    if (quantities.size > commerceConfig.cart.maxItems) {
        throw requestError('CART_ITEM_LIMIT_REACHED', {
            messageParams: { limit: commerceConfig.cart.maxItems },
        });
    }

    return [...quantities].map(([variantId, quantity]) => ({
        variantId,
        quantity,
    }));
}

export {
    createCheckoutDraft,
    deleteCheckoutDraftInTransaction,
    getActiveCheckoutDraft,
    toCheckoutSelection,
};
