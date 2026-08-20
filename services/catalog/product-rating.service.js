import mongoose from 'mongoose';

import Product from '../../models/catalog/product.model.js';
import Review from '../../models/catalog/review.model.js';

const REFRESH_BATCH_SIZE = 50;

async function applyProductRatingDelta(
    productId,
    ratingDelta,
    countDelta,
    session,
) {
    if (
        !productId
        || !session
        || !Number.isSafeInteger(ratingDelta)
        || !Number.isSafeInteger(countDelta)
        || Math.abs(countDelta) !== 1
        || Math.abs(ratingDelta) < 1
        || Math.abs(ratingDelta) > 5
        || Math.sign(ratingDelta) !== Math.sign(countDelta)
    ) {
        throw new Error('Product rating delta is invalid.');
    }

    const product = await Product.findById(productId).session(session);

    if (!product)
        throw new Error('Reviewed product was not found.');

    const current = readRatingState(product.rating);
    const nextCount = current.count + countDelta;
    const nextSum = current.sum + ratingDelta;

    if (
        nextCount < 0
        || nextSum < 0
        || (nextCount === 0 && nextSum !== 0)
        || (nextCount > 0 && (nextSum < nextCount || nextSum > nextCount * 5))
    ) {
        throw new Error('Product rating counter is invalid.');
    }

    product.rating = buildRating(nextSum, nextCount);
    await product.save({ session });
}

async function refreshProductRatings(productIds = []) {
    const uniqueProductIds = [...new Set(productIds.map(id => String(id)))];

    for (let index = 0; index < uniqueProductIds.length; index += REFRESH_BATCH_SIZE) {
        const batch = uniqueProductIds.slice(index, index + REFRESH_BATCH_SIZE);
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(() => (
                refreshProductRatingsInTransaction(batch, session)
            ));
        } finally {
            await session.endSession();
        }
    }
}

async function refreshProductRatingsInTransaction(productIds, session) {
    const products = await Product.find({
        _id: { $in: productIds },
    }).select('_id').session(session).lean();
    const foundProductIds = products.map(product => product._id);

    if (!foundProductIds.length)
        return;

    const summaries = await Review.aggregate([
        {
            $match: {
                product: { $in: foundProductIds },
                isPublished: true,
            },
        },
        {
            $group: {
                _id: '$product',
                sum: { $sum: '$rating' },
                count: { $sum: 1 },
            },
        },
    ]).session(session);
    const summaryByProductId = new Map(
        summaries.map(summary => [summary._id.toString(), summary]),
    );
    const operations = foundProductIds.map((productId) => {
        const summary = summaryByProductId.get(productId.toString());
        const rating = buildRating(
            summary ? summary.sum : 0,
            summary ? summary.count : 0,
        );

        return {
            updateOne: {
                filter: { _id: productId },
                update: { $set: { rating } },
            },
        };
    });

    await Product.bulkWrite(operations, { session, ordered: true });
}

function readRatingState(rating = {}) {
    const { sum, count } = rating;

    if (
        !Number.isSafeInteger(sum)
        || sum < 0
        || !Number.isSafeInteger(count)
        || count < 0
        || (count === 0 && sum !== 0)
        || (count > 0 && (sum < count || sum > count * 5))
    ) {
        throw new Error('Product rating state is invalid.');
    }

    return { sum, count };
}

function buildRating(sum, count) {
    readRatingState({ sum, count });

    if (count === 0) {
        return {
            sum: 0,
            count: 0,
            average: 0,
        };
    }

    return {
        sum,
        count,
        average: sum / count,
    };
}

export {
    applyProductRatingDelta,
    refreshProductRatings,
};
