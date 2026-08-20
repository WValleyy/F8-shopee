import mongoose from 'mongoose';

import commerceConfig from '../../../config/commerce.js';
import User from '../../../models/user/user.model.js';
import Product from '../../../models/catalog/product.model.js';
import ProductVariant from '../../../models/catalog/product-variant.model.js';
import UserAddress from '../../../models/user/user-address.model.js';
import Cart from '../../../models/commerce/cart.model.js';
import Order from '../../../models/commerce/order.model.js';
import {
    incidentError,
    isAppError,
    requestError,
} from '../../../utils/error/app-error.js';
import { buildCheckoutSelection } from '../checkout/checkout-state.service.js';
import {
    deleteCheckoutDraftInTransaction,
    getActiveCheckoutDraft,
    toCheckoutSelection,
} from '../checkout/checkout-draft.service.js';

const ORDER_PLACEMENT_REJECTED = 'ORDER_PLACEMENT_REJECTED';
const CHECKOUT_ALREADY_CREATED = 'CHECKOUT_ALREADY_CREATED';

async function placeOrder(userId, data) {
    const session = await mongoose.startSession();

    try {
        const existingDraftOrder = await Order.findOne({
            _id: data.draftId,
            user: userId,
        }).select('_id').lean();

        if (existingDraftOrder)
            throw requestError(CHECKOUT_ALREADY_CREATED);

        const initialDraft = await getActiveCheckoutDraft(
            userId,
            data.draftId,
        );

        if (!initialDraft)
            throw requestError('CHECKOUT_EXPIRED');

        const shippingAddress = await prepareOrderAddress(
            userId,
            data.selectedAddressId,
        );

        if (!shippingAddress) {
            throw requestError(
                data.selectedAddressId
                    ? 'ADDRESS_NOT_FOUND'
                    : 'SHIPPING_ADDRESS_REQUIRED',
            );
        }

        await session.withTransaction(async () => {
            const existingOrder = await Order.findOne({
                _id: data.draftId,
                user: userId,
            }).session(session);

            if (existingOrder) {
                throw createOrderPlacementError(CHECKOUT_ALREADY_CREATED);
            }

            const transactionDraft = await getActiveCheckoutDraft(
                userId,
                data.draftId,
                { session },
            );

            if (!transactionDraft) {
                throw createOrderPlacementError('CHECKOUT_EXPIRED');
            }

            const transactionSelection = toCheckoutSelection(transactionDraft);

            const userGuard = await User.updateOne(
                {
                    _id: userId,
                    isActive: true,
                    role: 'USER',
                },
                { $currentDate: { updatedAt: true } },
                { session },
            );

            if (userGuard.matchedCount !== 1) {
                const user = await User.findById(userId)
                    .select('role isActive')
                    .session(session)
                    .lean();

                throw createOrderPlacementError(
                    user?.role === 'ADMIN'
                        ? 'CUSTOMER_ACCOUNT_REQUIRED'
                        : 'CHECKOUT_USER_UNAVAILABLE',
                );
            }

            const checkoutState = await buildCheckoutSelection({
                checkoutSource: transactionSelection.source,
                selectedItems: transactionSelection.items,
                session,
            });

            if (checkoutState.hasUnavailableItems) {
                throw createOrderPlacementError('CHECKOUT_ITEMS_UNAVAILABLE');
            }

            validateOrderBusinessLimits(
                checkoutState.items,
                checkoutState.totalAmount,
            );

            const orderItems = checkoutState.items.map(item => ({
                product: item.productId,
                variant: item.variantId,
                productName: item.productName,
                productSlug: item.productSlug,
                image: item.image,
                options: item.options,
                price: item.price,
                quantity: item.quantity,
            }));
            const createdOrder = new Order({
                _id: data.draftId,
                user: userId,
                items: orderItems,
                shippingAddress,
                note: data.note || '',
                totalAmount: checkoutState.totalAmount,
                status: 'SHIPPING',
            });

            await createdOrder.save({ session });

            for (const item of orderItems) {
                const stockResult = await ProductVariant.updateOne(
                    {
                        _id: item.variant,
                        isPublished: true,
                        stock: { $gte: item.quantity },
                    },
                    { $inc: { stock: -item.quantity } },
                    { session },
                );

                if (stockResult.modifiedCount !== 1) {
                    throw createOrderPlacementError(
                        'CHECKOUT_ITEMS_UNAVAILABLE',
                    );
                }

                const productResult = await Product.updateOne(
                    { _id: item.product },
                    { $inc: { sold: item.quantity } },
                    { session },
                );

                if (productResult.matchedCount !== 1) {
                    throw createOrderPlacementError(
                        'CHECKOUT_ITEMS_UNAVAILABLE',
                    );
                }
            }

            if (checkoutState.source === 'cart') {
                await Cart.updateOne(
                    { user: userId },
                    {
                        $pull: {
                            items: {
                                variant: {
                                    $in: orderItems.map(item => item.variant),
                                },
                            },
                        },
                    },
                    { session },
                );
            }

            await deleteCheckoutDraftInTransaction(
                userId,
                data.draftId,
                session,
            );

        });

    } catch (error) {
        if (error?.code === ORDER_PLACEMENT_REJECTED) {
            throw requestError(error.errorCode, {
                ...(error.messageParams
                    ? { messageParams: error.messageParams }
                    : {}),
                cause: error,
            });
        }

        if (isAppError(error))
            throw error;

        throw incidentError('Unable to place order.', {
            cause: error,
            context: {
                userId: String(userId || ''),
            },
        });
    } finally {
        await session.endSession();
    }
}

async function prepareOrderAddress(userId, selectedAddressId) {
    if (!selectedAddressId)
        return null;

    const address = await UserAddress.findOne({
        _id: selectedAddressId,
        user: userId,
    })
        .select('fullName phone province ward detail')
        .lean();

    if (!address)
        return null;

    return {
        fullName: address.fullName,
        phone: address.phone,
        province: address.province,
        ward: address.ward,
        detail: address.detail,
    };
}

function createOrderPlacementError(errorCode, messageParams = undefined) {
    const error = new Error(`Order placement was rejected: ${errorCode}`);
    error.code = ORDER_PLACEMENT_REJECTED;
    error.errorCode = errorCode;

    if (messageParams)
        error.messageParams = messageParams;

    return error;
}

function validateOrderBusinessLimits(items, totalAmount) {
    const exceedsItemLimit = items.some(item => (
        item.quantity > commerceConfig.order.maxItemQuantity
        || item.price > commerceConfig.order.maxUnitPrice
    ));
    const exceedsTotalLimit = totalAmount > commerceConfig.order.maxTotalAmount;

    if (exceedsItemLimit || exceedsTotalLimit)
        throw createOrderPlacementError('CHECKOUT_ORDER_LIMIT_EXCEEDED');
}

export { placeOrder };
