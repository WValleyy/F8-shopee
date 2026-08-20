import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    aggregateProducts: vi.fn(),
    buildCatalogEligibilityPipeline: vi.fn(),
    findProduct: vi.fn(),
    findVariants: vi.fn(),
    getEffectiveActiveLeafCategoryIds: vi.fn(),
    isCategoryEffectivelyActiveLeaf: vi.fn(),
    isProductWishlisted: vi.fn(),
    mapWishlistedState: vi.fn(),
}));

vi.mock('../../../models/catalog/product.model.js', () => ({
    default: {
        aggregate: mocks.aggregateProducts,
        findOne: mocks.findProduct,
    },
}));

vi.mock('../../../models/catalog/product-variant.model.js', () => ({
    default: {
        find: mocks.findVariants,
    },
}));

vi.mock('../../../services/catalog/category.service.js', () => ({
    getEffectiveActiveLeafCategoryIds: mocks.getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf: mocks.isCategoryEffectivelyActiveLeaf,
}));

vi.mock('../../../services/user/wishlist.service.js', () => ({
    isProductWishlisted: mocks.isProductWishlisted,
    mapWishlistedState: mocks.mapWishlistedState,
}));

vi.mock('../../../services/catalog/catalog-query-pipeline.js', () => ({
    buildCatalogEligibilityPipeline: mocks.buildCatalogEligibilityPipeline,
}));

import {
    getProductDetailBySlug,
    listRelatedProducts,
} from '../../../services/catalog/product-query.service.js';

function productQuery(product) {
    const query = {
        lean: vi.fn().mockResolvedValue(product),
        populate: vi.fn(),
    };
    query.populate.mockReturnValue(query);
    return query;
}

function variantQuery(variants) {
    const query = {
        lean: vi.fn().mockResolvedValue(variants),
        sort: vi.fn(),
    };
    query.sort.mockReturnValue(query);
    return query;
}

function productFixture() {
    return {
        _id: { toString: () => 'product-1' },
        slug: 'phone',
        name: 'Phone',
        description: '',
        brand: 'Brand',
        category: {
            _id: { toString: () => 'category-1' },
            name: 'Phones',
            slug: 'phones',
            isActive: true,
        },
        images: [{ url: '/phone.jpg' }],
        likes: 0,
        rating: { average: 0, count: 0 },
        sold: 0,
        specifications: [],
    };
}

function variantFixture(options = []) {
    return {
        _id: { toString: () => 'variant-1' },
        options,
        price: 100000,
        originalPrice: 120000,
        stock: 5,
        image: { url: '/variant.jpg' },
    };
}

// Product queries compose catalog eligibility and wishlist presentation state.
describe('storefront product detail query', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('does not preselect a variant that requires an option choice', async () => {
        const query = variantQuery([
            variantFixture([{ name: 'Color', value: 'Red' }]),
        ]);
        mocks.findProduct.mockReturnValue(productQuery(productFixture()));
        mocks.findVariants.mockReturnValue(query);
        mocks.isCategoryEffectivelyActiveLeaf.mockResolvedValue(true);
        mocks.isProductWishlisted.mockResolvedValue(false);

        const product = await getProductDetailBySlug('phone');

        expect(product.activeVariant).toBeNull();
        expect(product.categorySlug).toBe('phones');
        expect(query.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    });

    it('preselects the only variant when it has no options', async () => {
        mocks.findProduct.mockReturnValue(productQuery(productFixture()));
        mocks.findVariants.mockReturnValue(variantQuery([variantFixture()]));
        mocks.isCategoryEffectivelyActiveLeaf.mockResolvedValue(true);
        mocks.isProductWishlisted.mockResolvedValue(false);

        const product = await getProductDetailBySlug('phone');

        expect(product.activeVariant.id).toBe('variant-1');
    });

    it('deduplicates product and variant gallery images', async () => {
        mocks.findProduct.mockReturnValue(productQuery(productFixture()));
        mocks.findVariants.mockReturnValue(variantQuery([{
            ...variantFixture(),
            image: { url: '/phone.jpg' },
        }]));
        mocks.isCategoryEffectivelyActiveLeaf.mockResolvedValue(true);
        mocks.isProductWishlisted.mockResolvedValue(false);

        const product = await getProductDetailBySlug('phone');

        expect(product.images).toEqual(['/phone.jpg']);
    });

    it('uses variant images when the product has no product images', async () => {
        const productWithoutImages = {
            ...productFixture(),
            images: [],
        };
        mocks.findProduct.mockReturnValue(
            productQuery(productWithoutImages),
        );
        mocks.findVariants.mockReturnValue(
            variantQuery([variantFixture()]),
        );
        mocks.isCategoryEffectivelyActiveLeaf.mockResolvedValue(true);
        mocks.isProductWishlisted.mockResolvedValue(false);

        const product = await getProductDetailBySlug('phone');

        expect(product.images).toEqual(['/variant.jpg']);
    });

    it('orders related products by popularity and delegates wishlist mapping', async () => {
        const categoryId = new mongoose.Types.ObjectId();
        const excludeProductId = new mongoose.Types.ObjectId();
        const rawProducts = [{
            _id: new mongoose.Types.ObjectId(),
            slug: 'related-phone',
            name: 'Related phone',
            images: [{ url: '/related.jpg' }],
            variantPrice: 90000,
            variantOriginalPrice: 100000,
            sold: 10,
            rating: { average: 4 },
        }];
        mocks.aggregateProducts.mockResolvedValue(rawProducts);
        mocks.buildCatalogEligibilityPipeline.mockReturnValue([]);
        mocks.mapWishlistedState.mockImplementation(async products => products);
        const currentUserId = new mongoose.Types.ObjectId();

        const products = await listRelatedProducts({
            categoryId,
            excludeProductId,
            limit: 4,
            currentUserId,
        });

        expect(products).toHaveLength(1);
        expect(products[0].image).toBe('/related.jpg');
        const pipeline = mocks.aggregateProducts.mock.calls[0][0];
        expect(pipeline).toContainEqual({
            $sort: { sold: -1, createdAt: -1, _id: -1 },
        });
        expect(pipeline).toContainEqual({ $limit: 4 });
        expect(mocks.buildCatalogEligibilityPipeline).toHaveBeenCalledWith({
            _id: { $ne: excludeProductId },
            category: categoryId,
            isPublished: true,
        });
        expect(mocks.mapWishlistedState).toHaveBeenCalledWith(
            expect.any(Array),
            currentUserId,
        );
    });

    it('uses the representative variant image for related products without images', async () => {
        const categoryId = new mongoose.Types.ObjectId();
        const excludeProductId = new mongoose.Types.ObjectId();
        mocks.aggregateProducts.mockResolvedValue([{
            _id: new mongoose.Types.ObjectId(),
            slug: 'related-phone',
            name: 'Related phone',
            images: [],
            variantImage: '/cheap-variant.jpg',
            variantPrice: 90000,
            variantOriginalPrice: 100000,
            sold: 10,
            rating: { average: 4 },
        }]);
        mocks.buildCatalogEligibilityPipeline.mockReturnValue([]);
        mocks.mapWishlistedState.mockImplementation(async products => products);

        const products = await listRelatedProducts({
            categoryId,
            excludeProductId,
            currentUserId: '',
        });

        expect(products[0].image).toBe('/cheap-variant.jpg');
    });
});
