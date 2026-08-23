import mongoose from 'mongoose';

import commerceConfig from '../../../config/commerce.js';
import Product from '../../../models/catalog/product.model.js';
import ProductVariant from '../../../models/catalog/product-variant.model.js';
import {
    incidentError,
    isAppError,
    requestError,
} from '../../../utils/error/app-error.js';
import Order from '../../../models/commerce/order.model.js';
import OrderReturnRequest from '../../../models/commerce/order-return-request.model.js';
import User from '../../../models/user/user.model.js';
import { isOrderReturnWindowOpen } from './order-policy.js';

async function createOrderReturnRequest(userId, orderId, data) {
    const { items } = data;

    if (!items.length)
        throw requestError('RETURN_ITEMS_REQUIRED');
    if (items.length > commerceConfig.cart.maxItems) {
        throw requestError('RETURN_ITEMS_LIMIT_EXCEEDED', {
            messageParams: { limit: commerceConfig.cart.maxItems },
        });
    }

    const quantities = new Map();

    for (const item of items) {
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
            throw requestError('RETURN_QUANTITY_INVALID');

        const quantity = (quantities.get(item.variantId) || 0) + item.quantity;

        if (!Number.isSafeInteger(quantity))
            throw requestError('RETURN_QUANTITY_INVALID');

        quantities.set(item.variantId, quantity);
    }

    const selectedItems = [...quantities]
        .map(([variantId, quantity]) => ({ variantId, quantity }))
        .sort((left, right) => left.variantId.localeCompare(right.variantId));

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const userGuard = await User.updateOne(
                {
                    _id: userId,
                    role: 'USER',
                    isActive: true,
                    purgeAfter: null,
                },
                { $currentDate: { updatedAt: true } },
                { session },
            );

            if (userGuard.matchedCount !== 1)
                throw requestError('ORDER_RETURN_NOT_ALLOWED');

            const order = await Order.findOne({
                _id: orderId,
                user: userId,
                status: 'COMPLETED',
            }).session(session);

            if (!order)
                throw requestError('ORDER_RETURN_NOT_ALLOWED');

            if (!isOrderReturnWindowOpen(order))
                throw requestError('ORDER_RETURN_PERIOD_EXPIRED');

            const orderItemByVariant = new Map(
                order.items.map(item => [item.variant.toString(), item]),
            );
            const requestItems = [];
            let amount = 0;

            for (const selectedItem of selectedItems) {
                const orderItem = orderItemByVariant.get(selectedItem.variantId);

                if (!orderItem)
                    throw requestError('ORDER_RETURN_ITEM_INVALID');

                const returnedQuantity = orderItem.returnedQuantity;

                if (
                    returnedQuantity + selectedItem.quantity
                    > orderItem.quantity
                ) {
                    throw requestError(
                        'ORDER_RETURN_QUANTITY_EXCEEDED',
                        {
                            messageParams: {
                                productName: orderItem.productName,
                            },
                        },
                    );
                }

                const itemAmount = orderItem.price * selectedItem.quantity;

                requestItems.push({
                    product: orderItem.product,
                    variant: orderItem.variant,
                    productName: orderItem.productName,
                    productSlug: orderItem.productSlug,
                    image: orderItem.image,
                    options: orderItem.options,
                    quantity: selectedItem.quantity,
                    amount: itemAmount,
                });
                amount += itemAmount;
                orderItem.returnedQuantity = returnedQuantity
                    + selectedItem.quantity;
            }

            if (!Number.isSafeInteger(amount) || amount < 0)
                throw new Error(
                    'Calculated return amount must be a non-negative safe integer.',
                );

            await OrderReturnRequest.create([{
                order: order._id,
                user: order.user,
                items: requestItems,
                amount,
            }], { session });

            for (const item of requestItems) {
                const variantResult = await ProductVariant.updateOne(
                    { _id: item.variant },
                    { $inc: { stock: item.quantity } },
                    { session },
                );
                const productResult = await Product.updateOne(
                    {
                        _id: item.product,
                        sold: { $gte: item.quantity },
                    },
                    { $inc: { sold: -item.quantity } },
                    { session },
                );

                if (
                    variantResult.matchedCount !== 1
                    || productResult.modifiedCount !== 1
                ) {
                    throw incidentError(
                        'Inventory changed while the return was being created.',
                        { code: 'RETURN_INVENTORY_RESTORE_FAILED' },
                    );
                }
            }

            await order.save({ session });
        });
    } catch (error) {
        if (isAppError(error))
            throw error;

        throw incidentError('Unable to create order return request.', {
            code: 'RETURN_SYSTEM_ERROR',
            cause: error,
            context: {
                userId: String(userId || ''),
                orderId: String(orderId || ''),
            },
        });
    } finally {
        await session.endSession();
    }

}

export {
    createOrderReturnRequest,
};
