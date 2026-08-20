import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
    afterAll as after,
    beforeAll as before,
    describe,
    it,
} from 'vitest';
import mongoose from 'mongoose';

import Product from '../../models/catalog/product.model.js';
import Review from '../../models/catalog/review.model.js';
import { setAdminReviewPublication } from '../../services/admin/catalog/admin-review.service.js';
import {
    applyProductRatingDelta,
    refreshProductRatings,
} from '../../services/catalog/product-rating.service.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

describe('product rating counters integration', { concurrency: false }, () => {
    const suffix = crypto.randomUUID().slice(0, 10);
    let product = null;
    let review = null;
    let concurrentProduct = null;

    before(async () => {
        await connectTestDatabase();
        product = await Product.create({
            name: `rating-counter-${suffix}`,
            slug: `rating-counter-${suffix}`,
            category: new mongoose.Types.ObjectId(),
            images: [{ url: 'https://example.com/p.jpg', publicId: 'products/p' }],
        });
        review = await Review.create({
            product: product._id,
            user: new mongoose.Types.ObjectId(),
            order: new mongoose.Types.ObjectId(),
            variant: new mongoose.Types.ObjectId(),
            rating: 5,
            isPublished: true,
        });
        concurrentProduct = await Product.create({
            name: `rating-concurrent-${suffix}`,
            slug: `rating-concurrent-${suffix}`,
            category: new mongoose.Types.ObjectId(),
            images: [{ url: 'https://example.com/p2.jpg', publicId: 'products/p2' }],
        });
    });

    after(async () => {
        if (product) {
            await Review.deleteMany({ product: product._id });
            await Product.deleteOne({ _id: product._id });
        }

        if (concurrentProduct)
            await Product.deleteOne({ _id: concurrentProduct._id });

        await disconnectTestDatabase();
    });

    it('rebuilds rating and applies a concurrent unpublish transition once', async () => {
        await refreshProductRatings([product._id]);

        let storedProduct = await Product.findById(product._id).lean();
        assert.deepEqual(storedProduct.rating, {
            sum: 5,
            count: 1,
            average: 5,
        });

        await Promise.all([
            setAdminReviewPublication(review._id, false),
            setAdminReviewPublication(review._id, false),
        ]);

        storedProduct = await Product.findById(product._id).lean();
        assert.deepEqual(storedProduct.rating, {
            sum: 0,
            count: 0,
            average: 0,
        });

        await setAdminReviewPublication(review._id, true);

        storedProduct = await Product.findById(product._id).lean();
        assert.deepEqual(storedProduct.rating, {
            sum: 5,
            count: 1,
            average: 5,
        });
    });

    it('serializes concurrent counter updates for one product', async () => {
        async function addRating(rating) {
            const session = await mongoose.startSession();

            try {
                return await session.withTransaction(() => (
                    applyProductRatingDelta(concurrentProduct._id, rating, 1, session)
                ));
            } finally {
                await session.endSession();
            }
        }

        await Promise.all([
            addRating(4),
            addRating(5),
        ]);

        const storedProduct = await Product.findById(concurrentProduct._id).lean();
        assert.deepEqual(storedProduct.rating, {
            sum: 9,
            count: 2,
            average: 4.5,
        });
    });
});
