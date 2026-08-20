import assert from 'node:assert/strict';
import {
    afterEach,
    describe,
    it,
    vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
    endSession: vi.fn(),
    getEffectiveActiveLeafCategoryIds: vi.fn(),
    isCategoryEffectivelyActiveLeaf: vi.fn(),
    productFindOne: vi.fn(),
    productFindById: vi.fn(),
    startSession: vi.fn(),
    wishListCreate: vi.fn(),
    wishListAggregate: vi.fn(),
    wishListDeleteOne: vi.fn(),
    wishListFindOne: vi.fn(),
    toProductCardViewModel: vi.fn(),
}));

vi.mock('mongoose', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        default: {
            ...actual.default,
            startSession: mocks.startSession,
        },
    };
});

vi.mock('../../../models/catalog/product.model.js', () => ({
    default: {
        findById: mocks.productFindById,
        findOne: mocks.productFindOne,
    },
}));

vi.mock('../../../models/user/wish-list.model.js', () => ({
    default: {
        aggregate: mocks.wishListAggregate,
        create: mocks.wishListCreate,
        deleteOne: mocks.wishListDeleteOne,
        findOne: mocks.wishListFindOne,
    },
}));

vi.mock('../../../services/catalog/category.service.js', () => ({
    getEffectiveActiveLeafCategoryIds:
        mocks.getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf: mocks.isCategoryEffectivelyActiveLeaf,
}));

vi.mock('../../../services/catalog/product-view-model.js', () => ({
    toProductCardViewModel: mocks.toProductCardViewModel,
}));

import {
    listWishListPage,
    setProductWishlistState,
} from '../../../services/user/wishlist.service.js';

// Wishlist mutations remain idempotent under concurrent requests.
describe('wishlist service', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('treats a duplicate key from a concurrent add as success', async () => {
        const session = {
            withTransaction: callback => callback(),
            endSession: mocks.endSession,
        };
        const product = {
            category: 'category-1',
            likes: 0,
            save: vi.fn(),
        };
        const duplicateError = Object.assign(new Error('duplicate key'), {
            code: 11000,
        });

        mocks.startSession.mockResolvedValue(session);
        mocks.productFindOne.mockReturnValue({
            session: vi.fn().mockResolvedValue(product),
        });
        mocks.isCategoryEffectivelyActiveLeaf.mockResolvedValue(true);
        mocks.wishListFindOne.mockReturnValue({
            session: vi.fn().mockResolvedValue(null),
        });
        mocks.wishListCreate.mockRejectedValue(duplicateError);

        const result = await setProductWishlistState(
            'product-1',
            'user-1',
            true,
        );

        assert.equal(result, undefined);
        assert.equal(mocks.endSession.mock.calls.length, 1);
    });

    it('removes an existing item when the product no longer exists', async () => {
        const session = {
            withTransaction: callback => callback(),
            endSession: mocks.endSession,
        };

        mocks.startSession.mockResolvedValue(session);
        mocks.wishListFindOne.mockReturnValue({
            session: vi.fn().mockResolvedValue({ _id: 'wishlist-1' }),
        });
        mocks.wishListDeleteOne.mockResolvedValue({ deletedCount: 1 });
        mocks.productFindById.mockReturnValue({
            session: vi.fn().mockResolvedValue(null),
        });

        const result = await setProductWishlistState(
            'product-1',
            'user-1',
            false,
        );

        assert.equal(result, undefined);
        assert.equal(mocks.productFindOne.mock.calls.length, 0);
        assert.equal(mocks.wishListDeleteOne.mock.calls.length, 1);
    });

    it('looks up variant pricing only after wishlist pagination', async () => {
        mocks.getEffectiveActiveLeafCategoryIds.mockResolvedValue([]);
        mocks.wishListAggregate
            .mockResolvedValueOnce([{ totalItems: 1 }])
            .mockResolvedValueOnce([{
                productDoc: {
                    _id: 'product-1',
                    slug: 'product-1',
                    name: 'Product 1',
                    images: [],
                    sold: 0,
                    rating: { average: 0 },
                },
                variantDoc: {
                    price: 100000,
                    originalPrice: 120000,
                    image: { url: '/variant.jpg' },
                },
            }]);
        mocks.toProductCardViewModel.mockImplementation(product => product);

        await listWishListPage('507f1f77bcf86cd799439011', {
            q: '',
            page: 1,
        });

        const countPipeline = mocks.wishListAggregate.mock.calls[0][0];
        const pagePipeline = mocks.wishListAggregate.mock.calls[1][0];
        const variantLookupIndex = pagePipeline.findIndex(stage => (
            stage.$lookup?.from === 'productvariants'
        ));
        const limitIndex = pagePipeline.findIndex(stage => '$limit' in stage);

        assert.equal(
            countPipeline.some(stage => (
                stage.$lookup?.from === 'productvariants'
            )),
            false,
        );
        assert.equal(variantLookupIndex > limitIndex, true);
    });

});
