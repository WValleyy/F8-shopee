import mongoose from 'mongoose';

import paginationConfig from '../../config/pagination.js';
import Product from '../../models/catalog/product.model.js';
import WishList from '../../models/user/wish-list.model.js';
import { requestError } from '../../utils/error/app-error.js';
import { buildPagination } from '../../utils/pagination.js';
import { escapeRegex } from '../../utils/regex.js';
import {
    getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf,
} from '../catalog/category.service.js';
import { toProductCardViewModel } from '../catalog/product-view-model.js';

async function setProductWishlistState(productId, userId, isWishlisted) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const existingWishListItem = await WishList.findOne({
                user: userId,
                product: productId,
            }).session(session);

            if (isWishlisted) {
                const product = await Product
                    .findOne({
                        _id: productId,
                        isPublished: true,
                    })
                    .session(session);

                if (!product)
                    throw requestError('PRODUCT_NOT_FOUND');

                const categoryIsActive = await isCategoryEffectivelyActiveLeaf(
                    product.category,
                    { session },
                );

                if (!categoryIsActive)
                    throw requestError('PRODUCT_NOT_FOUND');

                if (!existingWishListItem) {
                    await WishList.create([{
                        user: userId,
                        product: productId,
                    }], { session });

                    product.likes += 1;
                    await product.save({ session });
                }

                return;
            }

            if (!existingWishListItem)
                return;

            await WishList.deleteOne(
                { _id: existingWishListItem._id },
                { session },
            );

            const product = await Product.findById(productId).session(session);

            if (product) {
                product.likes -= 1;
                await product.save({ session });
            }
        });
    } catch (error) {
        // A concurrent add may lose the unique { user, product } index race.
        // The winning transaction already established the requested state.
        if (isWishlisted && error?.code === 11000)
            return;

        throw error;
    } finally {
        await session.endSession();
    }

}

async function listWishListPage(userId, options) {
    const currentQuery = options.q;
    const { page } = options;
    const limit = paginationConfig.wishlist;

    const aggregateMatch = {
        user: new mongoose.Types.ObjectId(userId),
    };
    const searchMatch = currentQuery
        ? {
            'productDoc.name': {
                $regex: escapeRegex(currentQuery),
                $options: 'i',
            },
        }
        : {};
    const activeCategoryIds = await getEffectiveActiveLeafCategoryIds();
    const eligibleProductPipeline = [
        { $match: aggregateMatch },
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productDoc',
            },
        },
        { $unwind: '$productDoc' },
        {
            $match: {
                'productDoc.isPublished': true,
                ...searchMatch,
            },
        },
        {
            $lookup: {
                from: 'categories',
                localField: 'productDoc.category',
                foreignField: '_id',
                as: 'categoryDoc',
            },
        },
        { $unwind: '$categoryDoc' },
        { $match: { 'categoryDoc._id': { $in: activeCategoryIds } } },
    ];
    const [countResult] = await WishList.aggregate([
        ...eligibleProductPipeline,
        { $count: 'totalItems' },
    ]);
    const totalItems = countResult?.totalItems ?? 0;
    const pagination = buildPagination({
        page,
        limit,
        totalItems,
    });

    const items = await WishList.aggregate([
        ...eligibleProductPipeline,
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (pagination.page - 1) * limit },
        { $limit: limit },
        {
            $lookup: {
                from: 'productvariants',
                let: { productId: '$productDoc._id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$product', '$$productId'] },
                                    { $eq: ['$isPublished', true] },
                                ],
                            },
                        },
                    },
                    { $sort: { price: 1, createdAt: 1, _id: 1 } },
                    { $limit: 1 },
                ],
                as: 'variantDoc',
            },
        },
        { $unwind: '$variantDoc' },
    ]);
    const products = items.map((item) => {
        const product = item.productDoc;
        const variant = item.variantDoc;

        return toProductCardViewModel({
            _id: product._id,
            slug: product.slug,
            name: product.name,
            productImage: product.images?.[0]?.url,
            variantImage: variant.image.url,
            price: variant.price,
            originalPrice: variant.originalPrice,
            sold: product.sold,
            rating: product.rating.average,
            isWishlisted: true,
        });
    });

    return {
        products,
        currentQuery,
        pagination,
    };
}

async function isProductWishlisted(productId, userId) {
    if (!userId)
        return false;

    return Boolean(await WishList.exists({
        user: userId,
        product: productId,
    }));
}

async function mapWishlistedState(products = [], currentUserId = '') {
    if (!currentUserId || !products.length) {
        return products.map(product => ({
            ...product,
            isWishlisted: false,
        }));
    }

    const wishedProducts = await WishList.find({
        user: currentUserId,
        product: {
            $in: products.map(product => product.id),
        },
    })
        .select('product')
        .lean();
    const wishedProductIdSet = new Set(
        wishedProducts.map(item => item.product.toString()),
    );

    return products.map(product => ({
        ...product,
        isWishlisted: wishedProductIdSet.has(product.id),
    }));
}

export {
    isProductWishlisted,
    listWishListPage,
    mapWishlistedState,
    setProductWishlistState,
};
