import mongoose from 'mongoose';

import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import { incidentError } from '../../utils/error/app-error.js';

import {
    isProductWishlisted,
    mapWishlistedState,
} from '../user/wishlist.service.js';

import {
    getEffectiveActiveLeafCategoryIds,
    isCategoryEffectivelyActiveLeaf,
} from './category.service.js';
import { buildCatalogEligibilityPipeline } from './catalog-query-pipeline.js';
import { toProductCardViewModel } from './product-view-model.js';

async function getProductDetailBySlug(slug, options = {}) {
    const {
        currentUserId = '',
    } = options;
    const product = await Product
        .findOne({
            slug,
            isPublished: true,
        })
        .populate('category')
        .populate('specifications.attribute')
        .lean();

    if (!product)
        return null;

    if (
        !product.category.isActive
        || !await isCategoryEffectivelyActiveLeaf(product.category._id)
    ) {
        return null;
    }

    const variants = await ProductVariant
        .find({
            product: product._id,
            isPublished: true,
        })
        .sort({ createdAt: 1, _id: 1 })
        .lean();

    // A published storefront product must always have at least one published
    // variant. Reaching this branch means persisted data broke that invariant.
    if (!variants.length) {
        throw incidentError(
            'Published product has no published variants.',
            {
                code: 'PUBLISHED_PRODUCT_HAS_NO_PUBLISHED_VARIANTS',
                context: {
                    productId: product._id.toString(),
                    slug: product.slug,
                },
            },
        );
    }

    const optionGroups = buildOptionGroups(variants);
    const normalizedVariants = variants.map((variant) => {
        const optionMap = variant.options.reduce((acc, option) => {
            acc[option.name] = option.value;

            return acc;
        }, {});

        return {
            id: variant._id.toString(),
            optionMap,
            price: variant.price,
            originalPrice: variant.originalPrice,
            stock: variant.stock,
            image: variant.image.url,
        };
    });
    const activeVariant = variants.length === 1
        && variants[0].options.length === 0
        ? normalizedVariants[0]
        : null;
    const prices = normalizedVariants.map(item => item.price);
    const originalPrices = normalizedVariants.map(item => item.originalPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minOriginalPrice = Math.min(...originalPrices);
    const maxOriginalPrice = Math.max(...originalPrices);
    const productImages = buildProductImages(product.images, normalizedVariants);
    const wishlisted = await isProductWishlisted(product._id, currentUserId);

    return {
        id: product._id.toString(),
        slug: product.slug,
        name: product.name,
        description: product.description,
        brand: product.brand,
        categoryId: product.category._id.toString(),
        categoryName: product.category.name,
        categorySlug: product.category.slug,
        isWishlisted: wishlisted,
        images: productImages,
        likes: product.likes,
        ratingAverage: product.rating.average,
        ratingCount: product.rating.count,
        sold: product.sold,
        priceRange: {
            min: minPrice,
            max: maxPrice,
        },
        originalPriceRange: {
            min: minOriginalPrice,
            max: maxOriginalPrice,
        },
        totalStock: normalizedVariants.reduce(
            (total, variant) => total + Number(variant.stock || 0),
            0,
        ),
        activeVariant,
        optionGroups,
        variants: normalizedVariants,
        specifications: product.specifications.map(item => ({
            name: item.attribute.name,
            value: item.value,
            unit: item.attribute.unit,
        })),
    };
}

async function getStorefrontProductBySlug(slug) {
    const activeCategoryIds = await getEffectiveActiveLeafCategoryIds();

    return Product.findOne({
        slug,
        isPublished: true,
        category: { $in: activeCategoryIds },
    })
        .select('_id')
        .lean();
}

async function listCatalogRecommendations(options = {}) {
    const {
        categoryId,
        excludeProductId,
        limit = 4,
        currentUserId = '',
        sort,
    } = options;
    const excludedProductObjectId = new mongoose.Types.ObjectId(
        excludeProductId,
    );
    const productQuery = {
        _id: { $ne: excludedProductObjectId },
        isPublished: true,
    };

    if (categoryId)
        productQuery.category = new mongoose.Types.ObjectId(categoryId);

    const products = await Product.aggregate([
        ...buildCatalogEligibilityPipeline(productQuery),
        { $sort: sort },
        { $limit: limit },
        {
            $project: {
                _id: 1,
                slug: 1,
                name: 1,
                sold: 1,
                images: 1,
                rating: 1,
                variantPrice: '$variantDoc.price',
                variantOriginalPrice: '$variantDoc.originalPrice',
                variantImage: '$variantDoc.image.url',
            },
        },
    ]);
    const normalizedProducts = products.map(product => (
        toProductCardViewModel({
            _id: product._id,
            slug: product.slug,
            name: product.name,
            productImage: product.images?.[0]?.url,
            variantImage: product.variantImage,
            price: product.variantPrice,
            originalPrice: product.variantOriginalPrice,
            sold: product.sold,
            rating: product.rating.average,
        })
    ));

    return mapWishlistedState(normalizedProducts, currentUserId);
}

async function listRelatedProducts(options = {}) {
    return listCatalogRecommendations({
        ...options,
        sort: {
            sold: -1,
            createdAt: -1,
            _id: -1,
        },
    });
}

async function listFeaturedProducts(options = {}) {
    return listCatalogRecommendations({
        ...options,
        sort: { sold: -1 },
    });
}

function buildOptionGroups(variants) {
    const groupMap = new Map();

    variants.forEach((variant) => {
        variant.options.forEach((option) => {
            const currentValues = groupMap.get(option.name) || [];

            if (!currentValues.includes(option.value))
                currentValues.push(option.value);

            groupMap.set(option.name, currentValues);
        });
    });

    return [...groupMap.entries()].map(([name, values]) => ({
        name,
        values,
    }));
}

function buildProductImages(productImages = [], variants) {
    const mergedImages = [];
    const seenImages = new Set();
    const productUrls = productImages.map(image => image.url);
    const variantUrls = variants.map(variant => variant.image);

    [...productUrls, ...variantUrls].forEach((image) => {
        if (seenImages.has(image))
            return;

        seenImages.add(image);
        mergedImages.push(image);
    });

    return mergedImages;
}

export {
    getProductDetailBySlug,
    getStorefrontProductBySlug,
    listFeaturedProducts,
    listRelatedProducts,
};
