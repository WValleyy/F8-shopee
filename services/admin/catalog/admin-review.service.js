import mongoose from 'mongoose';

import paginationConfig from '../../../config/pagination.js';
import Product from '../../../models/catalog/product.model.js';
import Review from '../../../models/catalog/review.model.js';
import { requestError } from '../../../utils/error/app-error.js';
import { buildPagination } from '../../../utils/pagination.js';
import { escapeRegex } from '../../../utils/regex.js';
import { applyProductRatingDelta } from '../../catalog/product-rating.service.js';

const REVIEW_PAGE_LIMIT = paginationConfig.adminReviews;

async function listAdminReviewsPage(options = {}) {
    const page = options.page || 1;
    const filters = {
        q: options.q || '',
        status: options.status || 'all',
        rating: options.rating || 'all',
        images: options.images || 'all',
        sort: options.sort || 'newest',
        product: options.product || '',
    };
    const products = await Product
        .find({})
        .select('name')
        .sort({ name: 1 })
        .lean();
    const productOptions = products.map(product => ({
        id: product._id.toString(),
        name: product.name,
    }));

    const reviewQuery = {};

    if (filters.status !== 'all')
        reviewQuery.isPublished = filters.status === 'published';

    if (filters.rating !== 'all')
        reviewQuery.rating = Number(filters.rating);

    if (filters.images === 'with-images')
        reviewQuery['images.0'] = { $exists: true };
    else if (filters.images === 'without-images')
        reviewQuery['images.0'] = { $exists: false };

    if (filters.product)
        reviewQuery.product = new mongoose.Types.ObjectId(filters.product);

    if (filters.q) {
        const pattern = new RegExp(escapeRegex(filters.q), 'i');
        const matchedProducts = await Product.find({ name: pattern }).select('_id').lean();
        const conditions = [
            { content: pattern },
            { product: { $in: matchedProducts.map(product => product._id) } },
        ];

        if (mongoose.isValidObjectId(filters.q))
            conditions.push({ order: new mongoose.Types.ObjectId(filters.q) });

        reviewQuery.$or = conditions;
    }

    const totalItems = await Review.countDocuments(reviewQuery);
    const pagination = buildPagination({
        page,
        limit: REVIEW_PAGE_LIMIT,
        totalItems,
    });

    const sortStage = filters.sort === 'oldest'
        ? { createdAt: 1, _id: 1 }
        : filters.sort === 'helpful'
            ? { helpfulCount: -1, createdAt: -1, _id: -1 }
            : { createdAt: -1, _id: -1 };
    const reviews = await Review.aggregate([
        { $match: reviewQuery },
        { $set: { helpfulCount: { $size: { $ifNull: ['$likedBy', []] } } } },
        { $sort: sortStage },
        { $skip: (pagination.page - 1) * REVIEW_PAGE_LIMIT },
        { $limit: REVIEW_PAGE_LIMIT },
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
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDoc',
            },
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'productvariants',
                localField: 'variant',
                foreignField: '_id',
                as: 'variantDoc',
            },
        },
        { $unwind: '$variantDoc' },
    ]);

    return {
        reviews: reviews.map(review => ({
            id: review._id.toString(),
            productId: review.product.toString(),
            productName: review.productDoc.name,
            productImage: review.variantDoc.image.url,
            orderId: review.order.toString(),
            userName: review.userDoc?.name || null,
            userAvatar: review.userDoc?.avatar || '',
            rating: review.rating,
            content: review.content,
            images: review.images.map(img => img.url),
            helpfulCount: review.helpfulCount,
            isPublished: Boolean(review.isPublished),
            createdAt: review.createdAt,
        })),
        products: productOptions,
        filters,
        pagination,
    };
}

async function setAdminReviewPublication(reviewId, isPublished) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const review = await Review.findById(reviewId).session(session);

            if (!review)
                throw requestError('REVIEW_NOT_FOUND');

            const nextIsPublished = isPublished;

            if (review.isPublished === nextIsPublished)
                return;

            const countDelta = nextIsPublished ? 1 : -1;
            const ratingDelta = countDelta * review.rating;

            review.isPublished = nextIsPublished;
            await review.save({ session });
            await applyProductRatingDelta(
                review.product,
                ratingDelta,
                countDelta,
                session,
            );

        });
    } finally {
        await session.endSession();
    }
}

export {
    listAdminReviewsPage,
    setAdminReviewPublication,
};
