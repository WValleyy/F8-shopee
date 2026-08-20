import mongoose from 'mongoose';

import paginationConfig from '../../config/pagination.js';
import { uploadFolders } from '../../config/upload-image.js';

import Review from '../../models/catalog/review.model.js';
import Order from '../../models/commerce/order.model.js';

import { requestError } from '../../utils/error/app-error.js';
import { buildPagination } from '../../utils/pagination.js';

import {
    cleanupUploadedImages,
    createPendingCloudinaryImage,
    uploadCloudinaryImages,
} from '../image/cloudinary-image.service.js';

import { applyProductRatingDelta } from './product-rating.service.js';

async function listProductReviewsPage(productId, options = {}) {
    const {
        currentUserId = '',
        page = 1,
        rating = null,
    } = options;
    const limit = paginationConfig.productReviews;
    const productObjectId = new mongoose.Types.ObjectId(String(productId));
    const currentUserObjectId = currentUserId
        ? new mongoose.Types.ObjectId(String(currentUserId))
        : null;
    const reviewQuery = {
        product: productObjectId,
        isPublished: true,
        ...(rating ? { rating } : {}),
    };
    const totalItems = await Review.countDocuments(reviewQuery);
    const pagination = buildPagination({ page, limit, totalItems });
    const reviews = await Review.aggregate([
        { $match: reviewQuery },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (pagination.page - 1) * limit },
        { $limit: limit },
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDocument',
            },
        },
        {
            $unwind: {
                path: '$userDocument',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                rating: 1,
                content: 1,
                images: 1,
                createdAt: 1,
                helpfulCount: {
                    $size: { $ifNull: ['$likedBy', []] },
                },
                isHelpful: currentUserObjectId
                    ? {
                        $in: [
                            currentUserObjectId,
                            { $ifNull: ['$likedBy', []] },
                        ],
                    }
                    : { $literal: false },
                reviewer: {
                    name: '$userDocument.name',
                    userName: '$userDocument.userName',
                    avatar: '$userDocument.avatar',
                },
            },
        },
    ]);

    return {
        reviews: reviews.map(toReviewViewModel),
        pagination,
    };
}

async function createProductReview(productId, userId, data) {
    const reviewGate = await getPurchaseReviewGate({
        productId,
        userId,
        orderId: data.orderId,
        variantId: data.variantId,
    });

    if (!reviewGate.canReview)
        throw requestError(reviewGate.errorCode);

    const {
        rating,
        content,
        images,
    } = data;
    const pendingImages = images.map(image => createPendingCloudinaryImage(image, {
        folder: `${uploadFolders.review}/${userId}`,
    }));

    await uploadCloudinaryImages(pendingImages, {
        rollback: true,
        cleanupScope: 'review-upload-rollback',
    });

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const currentGate = await getPurchaseReviewGate({
                productId,
                userId,
                orderId: data.orderId,
                variantId: data.variantId,
                session,
            });

            if (!currentGate.canReview)
                throw requestError(currentGate.errorCode);

            await Review.create([{
                product: productId,
                user: userId,
                order: data.orderId,
                variant: data.variantId,
                rating,
                content,
                images: pendingImages.map(image => ({
                    url: image.url,
                    publicId: image.publicId,
                })),
                isPublished: true,
            }], { session });
            await applyProductRatingDelta(productId, rating, 1, session);
        });
    } catch (error) {
        await cleanupUploadedImages(pendingImages, 'review-database-rollback');

        if (error?.code === 11000)
            throw requestError('REVIEW_ALREADY_EXISTS', { cause: error });

        throw error;
    } finally {
        await session.endSession();
    }
}

async function setReviewHelpful(reviewId, userId, isHelpful) {
    const result = await Review.updateOne(
        {
            _id: reviewId,
            isPublished: true,
        },
        isHelpful
            ? { $addToSet: { likedBy: userId } }
            : { $pull: { likedBy: userId } },
    );

    if (result.matchedCount !== 1)
        throw requestError('REVIEW_NOT_FOUND');
}

async function getPurchaseReviewGate({
    productId,
    userId,
    orderId,
    variantId,
    session = null,
}) {
    const orderQuery = Order.findOne({
        _id: orderId,
        user: userId,
    }).select('status items.product items.variant items.quantity items.returnedQuantity');

    if (session)
        orderQuery.session(session);

    const orderDocument = await orderQuery.lean();

    if (!orderDocument) {
        return {
            canReview: false,
            errorCode: 'REVIEW_ORDER_NOT_FOUND',
        };
    }

    if (orderDocument.status !== 'COMPLETED') {
        return {
            canReview: false,
            errorCode: 'REVIEW_ORDER_NOT_COMPLETED',
        };
    }

    const purchasedItem = orderDocument.items.find(item => (
        item.product.toString() === productId.toString()
        && item.variant.toString() === variantId.toString()
    ));

    if (!purchasedItem) {
        return {
            canReview: false,
            errorCode: 'REVIEW_ITEM_NOT_PURCHASED',
        };
    }

    if (purchasedItem.returnedQuantity >= purchasedItem.quantity) {
        return {
            canReview: false,
            errorCode: 'REVIEW_ITEM_FULLY_RETURNED',
        };
    }

    const existingReviewQuery = Review.exists({
        user: userId,
        order: orderId,
        product: productId,
        variant: variantId,
    });

    if (session)
        existingReviewQuery.session(session);

    const existingReview = await existingReviewQuery;

    return existingReview
        ? {
            canReview: false,
            errorCode: 'REVIEW_ALREADY_EXISTS',
        }
        : { canReview: true };
}

function toReviewViewModel(review) {
    const reviewer = review.reviewer || null;

    return {
        id: review._id.toString(),
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt,
        images: review.images.map(image => image.url),
        helpfulCount: review.helpfulCount,
        isHelpful: review.isHelpful,
        userName: reviewer?.name || reviewer?.userName || null,
        userAvatar: reviewer?.avatar || '',
    };
}

export {
    createProductReview,
    listProductReviewsPage,
    setReviewHelpful,
};
