import mongoose from 'mongoose';

import { requestError } from '../../utils/error/app-error.js';
import { logAppEvent } from '../../utils/error/app-error-logger.js';

import commerceConfig from '../../config/commerce.js';
import Cart from '../../models/commerce/cart.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import {
    getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf,
} from '../catalog/category.service.js';
import { toLineItemViewModel } from './line-item-view-model.js';

async function getCartState(userId) {
    const items = await listCartItems(userId);

    return {
        items,
        itemCount: items.length,
    };
}

async function getCartPreview(userId) {
    const items = await listCartItems(userId);

    return {
        itemCount: items.length,
        items: items.slice(0, 3).map(item => ({
            variantId: item.variantId,
            productName: item.productName,
            image: item.image,
            options: item.options,
            price: item.price,
            quantity: item.quantity,
            isAvailable: item.isAvailable,
            unavailableReason: item.unavailableReason,
        })),
    };
}

async function getCartPreviewAfterMutation(userId) {
    try {
        return await getCartPreview(userId);
    } catch (error) {
        // A preview failure must not report a committed cart command as failed.
        await logAppEvent('cart:preview-after-mutation-failed', 'warning', {
            userId,
            error: error?.message || String(error),
        }).catch(() => {});

        return null;
    }
}

async function addCartItem(userId, variantId, quantity) {
    validateCartQuantity(quantity);

    const variant = await getPurchasableVariant(variantId);

    if (!variant)
        throw requestError('CART_ITEM_INVALID');

    const maxQuantity = Math.min(
        variant.stock,
        commerceConfig.order.maxItemQuantity,
    );

    if (quantity > maxQuantity)
        throw requestError('CART_ITEM_QUANTITY_INVALID');

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const variantObjectId = new mongoose.Types.ObjectId(variant._id);

    try {
        await Cart.updateOne(
            { user: userObjectId },
            {
                $setOnInsert: {
                    user: userObjectId,
                    items: [],
                },
            },
            { upsert: true },
        );
    } catch (error) {
        if (error?.code !== 11000)
            throw error;
    }

    const cart = await Cart.findOneAndUpdate(
        {
            user: userObjectId,
            $or: [
                {
                    items: {
                        $elemMatch: {
                            variant: variantObjectId,
                            quantity: { $lte: maxQuantity - quantity },
                        },
                    },
                },
                {
                    $and: [
                        { 'items.variant': { $ne: variantObjectId } },
                        {
                            $expr: {
                                $lt: [
                                    { $size: '$items' },
                                    commerceConfig.cart.maxItems,
                                ],
                            },
                        },
                    ],
                },
            ],
        },
        buildAddCartItemPipeline(variantObjectId, quantity, new Date()),
        {
            returnDocument: 'after',
            updatePipeline: true,
        },
    );

    if (cart)
        return;

    const currentCart = await Cart
        .findOne({ user: userObjectId })
        .select('items')
        .lean();
    const containsVariant = currentCart.items.some(
        item => item.variant.toString() === variantId,
    );

    if (!containsVariant && currentCart.items.length >= commerceConfig.cart.maxItems) {
        throw requestError('CART_ITEM_LIMIT_REACHED', {
            messageParams: { limit: commerceConfig.cart.maxItems },
        });
    }

    throw requestError('CART_ITEM_QUANTITY_INVALID');
}

async function updateCartItem(userId, variantId, quantity) {
    validateCartQuantity(quantity);

    const variant = await getPurchasableVariant(variantId);

    if (!variant)
        throw requestError('CART_ITEM_INVALID');

    if (quantity > variant.stock)
        throw requestError('CART_ITEM_QUANTITY_INVALID');

    const result = await Cart.updateOne(
        {
            user: new mongoose.Types.ObjectId(userId),
            'items.variant': new mongoose.Types.ObjectId(variant._id),
        },
        {
            $set: {
                'items.$.quantity': quantity,
            },
        },
    );

    if (result.matchedCount !== 1)
        throw requestError('CART_ITEM_NOT_FOUND');
}

async function removeCartItem(userId, variantId) {
    const result = await Cart.updateOne(
        { user: new mongoose.Types.ObjectId(userId) },
        {
            $pull: {
                items: {
                    variant: new mongoose.Types.ObjectId(variantId),
                },
            },
        },
    );

    if (result.modifiedCount !== 1)
        throw requestError('CART_ITEM_NOT_FOUND');
}

async function removeCartItems(userId, variantIds) {
    const variantObjectIds = variantIds.map(
        variantId => new mongoose.Types.ObjectId(variantId),
    );
    const result = await Cart.updateOne(
        {
            user: new mongoose.Types.ObjectId(userId),
            $and: variantObjectIds.map(variantObjectId => ({
                'items.variant': variantObjectId,
            })),
        },
        {
            $pull: {
                items: {
                    variant: { $in: variantObjectIds },
                },
            },
        },
    );

    if (result.modifiedCount !== 1)
        throw requestError('CART_ITEMS_NOT_FOUND');
}

async function listCartItems(userId) {
    if (!userId)
        return [];

    const cart = await Cart
        .findOne({ user: userId })
        .select('items')
        .lean();

    if (!cart)
        return [];

    if (!cart.items.length)
        return [];

    const variantIds = cart.items.map(item => item.variant);
    const [variants, activeCategoryIds] = await Promise.all([
        ProductVariant
            .find({ _id: { $in: variantIds } })
            .select('_id product image isPublished options price stock')
            .populate({
                path: 'product',
                select: '_id category isPublished name slug',
            })
            .lean(),
        getEffectiveActiveLeafCategoryIds(),
    ]);
    const variantById = new Map(
        variants.map(variant => [variant._id.toString(), variant]),
    );
    const activeCategoryIdSet = new Set(activeCategoryIds.map(String));

    return cart.items.map(item => toCartItemViewModel(
        item,
        variantById.get(item.variant.toString()),
        activeCategoryIdSet,
    ));
}

function toCartItemViewModel(cartItem, variant, activeCategoryIds) {
    const variantId = cartItem.variant.toString();

    if (!variant || !variant.product) {
        return {
            variantId,
            productName: null,
            image: null,
            options: [],
            price: null,
            quantity: cartItem.quantity,
            total: null,
            maxQuantity: null,
            isAvailable: false,
            unavailableReason: 'VARIANT_NOT_FOUND',
        };
    }

    const lineItem = toLineItemViewModel({
        variant,
        quantity: cartItem.quantity,
    });
    let unavailableReason = '';

    if (!variant.isPublished)
        unavailableReason = 'VARIANT_HIDDEN';
    else if (!variant.product.isPublished)
        unavailableReason = 'PRODUCT_HIDDEN';
    else if (!activeCategoryIds.has(variant.product.category.toString()))
        unavailableReason = 'CATEGORY_UNAVAILABLE';
    else if (variant.stock < cartItem.quantity)
        unavailableReason = 'INSUFFICIENT_STOCK';

    return {
        variantId: lineItem.variantId,
        productSlug: lineItem.productSlug,
        productName: lineItem.productName,
        image: lineItem.image,
        options: lineItem.options,
        price: lineItem.price,
        quantity: lineItem.quantity,
        total: lineItem.total,
        maxQuantity: Math.min(
            variant.stock,
            commerceConfig.order.maxItemQuantity,
        ),
        isAvailable: !unavailableReason,
        unavailableReason,
    };
}

async function getPurchasableVariant(variantId) {
    const variant = await ProductVariant
        .findById(variantId)
        .select('_id product image isPublished stock')
        .populate({
            path: 'product',
            select: '_id category isPublished',
        })
        .lean();

    if (
        !variant
        || !variant.isPublished
        || !variant.product
        || !variant.product.isPublished
        || !await isCategoryEffectivelyActiveLeaf(variant.product.category)
    )
        return null;

    return variant;
}

function buildAddCartItemPipeline(variantObjectId, quantity, now) {
    return [
        {
            $set: {
                updatedAt: now,
                items: {
                    $cond: [
                        {
                            $in: [
                                variantObjectId,
                                {
                                    $map: {
                                        input: '$items',
                                        as: 'item',
                                        in: '$$item.variant',
                                    },
                                },
                            ],
                        },
                        {
                            $map: {
                                input: '$items',
                                as: 'item',
                                in: {
                                    $cond: [
                                        { $eq: ['$$item.variant', variantObjectId] },
                                        {
                                            variant: '$$item.variant',
                                            quantity: {
                                                $add: ['$$item.quantity', quantity],
                                            },
                                        },
                                        '$$item',
                                    ],
                                },
                            },
                        },
                        {
                            $concatArrays: [
                                '$items',
                                [{ variant: variantObjectId, quantity }],
                            ],
                        },
                    ],
                },
            },
        },
    ];
}

function validateCartQuantity(quantity) {
    if (
        !Number.isSafeInteger(quantity)
        || quantity < 1
        || quantity > commerceConfig.order.maxItemQuantity
    )
        throw requestError('CART_ITEM_QUANTITY_INVALID');
}

export {
    addCartItem,
    getCartPreview,
    getCartPreviewAfterMutation,
    getCartState,
    removeCartItem,
    removeCartItems,
    updateCartItem,
};
