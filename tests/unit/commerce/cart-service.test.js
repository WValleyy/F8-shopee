import assert from 'node:assert/strict';
import {
    afterEach,
    describe,
    it,
    vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findById: vi.fn(),
    getEffectiveActiveLeafCategoryIds: vi.fn(),
    isCategoryEffectivelyActiveLeaf: vi.fn(),
    updateOne: vi.fn(),
}));

vi.mock('../../../models/commerce/cart.model.js', () => ({
    default: {
        findOne: mocks.findOne,
        findOneAndUpdate: mocks.findOneAndUpdate,
        updateOne: mocks.updateOne,
    },
}));

vi.mock('../../../models/catalog/product-variant.model.js', () => ({
    default: {
        find: mocks.find,
        findById: mocks.findById,
    },
}));

vi.mock('../../../services/catalog/category.service.js', () => ({
    getEffectiveActiveLeafCategoryIds: mocks.getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf: mocks.isCategoryEffectivelyActiveLeaf,
}));

import {
    addCartItem,
    getCartState,
} from '../../../services/commerce/cart.service.js';

// Cart upsert behavior remains correct when first-insert operations race.
describe('cart service', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('continues when another request creates the cart first', async () => {
        const variant = {
            _id: '507f1f77bcf86cd799439012',
            stock: 5,
            isPublished: true,
            image: {
                url: 'https://example.com/variant.jpg',
                publicId: 'demo/variant',
            },
            product: {
                isPublished: true,
                category: '507f1f77bcf86cd799439013',
            },
        };
        const query = {
            select: vi.fn(),
            populate: vi.fn(),
            lean: vi.fn().mockResolvedValue(variant),
        };

        query.select.mockReturnValue(query);
        query.populate.mockReturnValue(query);
        mocks.findById.mockReturnValue(query);
        mocks.isCategoryEffectivelyActiveLeaf.mockResolvedValue(true);
        mocks.updateOne.mockRejectedValue(Object.assign(
            new Error('duplicate key'),
            { code: 11000 },
        ));
        mocks.findOneAndUpdate.mockResolvedValue({});

        const result = await addCartItem(
            '507f1f77bcf86cd799439011',
            '507f1f77bcf86cd799439012',
            1,
        );

        assert.equal(result, undefined);
        assert.equal(mocks.updateOne.mock.calls.length, 1);
        assert.equal(mocks.findOneAndUpdate.mock.calls.length, 1);
    });
});

// The cart read model marks deleted or unpublished variants as unavailable.
describe('cart service read model', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('keeps deleted and unpublished variants as unavailable items', async () => {
        const deletedVariantId = '507f1f77bcf86cd799439012';
        const hiddenVariantId = '507f1f77bcf86cd799439013';
        const categoryId = '507f1f77bcf86cd799439014';
        const cartQuery = {
            select: vi.fn(),
            lean: vi.fn().mockResolvedValue({
                items: [
                    { variant: deletedVariantId, quantity: 1 },
                    { variant: hiddenVariantId, quantity: 2 },
                ],
            }),
        };
        const variantQuery = {
            select: vi.fn(),
            populate: vi.fn(),
            lean: vi.fn().mockResolvedValue([{
                _id: hiddenVariantId,
                image: { url: 'https://example.com/variant.jpg' },
                isPublished: false,
                options: [{ name: 'Size', value: 'M' }],
                price: 100000,
                stock: 10,
                product: {
                    _id: '507f1f77bcf86cd799439015',
                    category: categoryId,
                    isPublished: true,
                    name: 'Product',
                    slug: 'product',
                },
            }]),
        };

        cartQuery.select.mockReturnValue(cartQuery);
        mocks.findOne.mockReturnValue(cartQuery);
        variantQuery.select.mockReturnValue(variantQuery);
        variantQuery.populate.mockReturnValue(variantQuery);
        mocks.find.mockReturnValue(variantQuery);
        mocks.getEffectiveActiveLeafCategoryIds.mockResolvedValue([categoryId]);

        const state = await getCartState('507f1f77bcf86cd799439011');

        assert.equal(state.itemCount, 2);
        assert.equal(state.items[0].variantId, deletedVariantId);
        assert.equal(state.items[0].unavailableReason, 'VARIANT_NOT_FOUND');
        assert.equal(state.items[1].productName, 'Product');
        assert.equal(state.items[1].unavailableReason, 'VARIANT_HIDDEN');
        assert.equal(mocks.updateOne.mock.calls.length, 0);
    });
});
