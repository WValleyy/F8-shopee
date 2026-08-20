import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
    findOrder: vi.fn(),
    updateOne: vi.fn(),
}));

vi.mock('../../../models/catalog/review.model.js', () => ({
    default: {
        aggregate: mocks.aggregate,
        countDocuments: mocks.countDocuments,
        create: mocks.create,
        exists: mocks.exists,
        updateOne: mocks.updateOne,
    },
}));

vi.mock('../../../models/commerce/order.model.js', () => ({
    default: {
        findOne: mocks.findOrder,
    },
}));

vi.mock('../../../services/image/cloudinary-image.service.js', () => ({
    cleanupUploadedImages: vi.fn(),
    createPendingCloudinaryImage: vi.fn(),
    uploadCloudinaryImages: vi.fn(),
}));

vi.mock('../../../services/catalog/product-rating.service.js', () => ({
    applyProductRatingDelta: vi.fn(),
}));

import {
    createProductReview,
    listProductReviewsPage,
} from '../../../services/catalog/review.service.js';

function orderQuery(order) {
    const query = {
        lean: vi.fn().mockResolvedValue(order),
        select: vi.fn(),
        session: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.session.mockReturnValue(query);
    return query;
}

// Review operations protect review visibility and purchase eligibility.
describe('catalog review service', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns computed helpful state without exposing order or variant IDs', async () => {
        const productId = new mongoose.Types.ObjectId();
        const currentUserId = new mongoose.Types.ObjectId();
        mocks.countDocuments.mockResolvedValue(1);
        mocks.aggregate.mockResolvedValue([{
            _id: new mongoose.Types.ObjectId(),
            rating: 5,
            content: 'Useful review',
            images: [],
            createdAt: new Date(),
            helpfulCount: 3,
            isHelpful: true,
            reviewer: { name: 'Customer', avatar: '/avatar.jpg' },
        }]);

        const result = await listProductReviewsPage(productId, {
            currentUserId,
        });

        expect(result.reviews[0]).toMatchObject({
            helpfulCount: 3,
            isHelpful: true,
            userName: 'Customer',
        });
        expect(result.reviews[0]).not.toHaveProperty('orderId');
        expect(result.reviews[0]).not.toHaveProperty('variantId');

        const projectStage = mocks.aggregate.mock.calls[0][0]
            .find(stage => stage.$project);
        expect(projectStage.$project.helpfulCount).toBeDefined();
        expect(projectStage.$project.isHelpful).toBeDefined();
        expect(projectStage.$project.likedBy).toBeUndefined();
    });

    it('leaves deleted reviewer display fallback to the presentation layer', async () => {
        mocks.countDocuments.mockResolvedValue(1);
        mocks.aggregate.mockResolvedValue([{
            _id: new mongoose.Types.ObjectId(),
            rating: 5,
            content: '',
            images: [],
            createdAt: new Date(),
            helpfulCount: 0,
            isHelpful: false,
            reviewer: {},
        }]);

        const result = await listProductReviewsPage(
            new mongoose.Types.ObjectId(),
        );

        expect(result.reviews[0].userName).toBeNull();
    });

    it('distinguishes an item outside the completed order', async () => {
        const productId = new mongoose.Types.ObjectId();
        const variantId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();
        mocks.findOrder.mockReturnValue(orderQuery({
            status: 'COMPLETED',
            items: [{
                product: new mongoose.Types.ObjectId(),
                variant: new mongoose.Types.ObjectId(),
                quantity: 1,
                returnedQuantity: 0,
            }],
        }));

        await expect(createProductReview(productId, userId, {
            orderId: new mongoose.Types.ObjectId(),
            variantId,
            rating: 5,
            content: '',
            images: [],
        })).rejects.toMatchObject({
            code: 'REVIEW_ITEM_NOT_PURCHASED',
        });
    });

    it('distinguishes an incomplete order from a missing purchased item', async () => {
        mocks.findOrder.mockReturnValue(orderQuery({
            status: 'CONFIRMED',
            items: [],
        }));

        await expect(createProductReview(
            new mongoose.Types.ObjectId(),
            new mongoose.Types.ObjectId(),
            {
                orderId: new mongoose.Types.ObjectId(),
                variantId: new mongoose.Types.ObjectId(),
                rating: 5,
                content: '',
                images: [],
            },
        )).rejects.toMatchObject({
            code: 'REVIEW_ORDER_NOT_COMPLETED',
        });
    });
});
