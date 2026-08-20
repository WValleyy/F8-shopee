import { catalogSortDefinitions } from '../../config/catalog.js';
import paginationConfig from '../../config/pagination.js';
import { PRODUCT_SEARCH_INDEX_NAME } from '../../config/product-search.js';

import Category from '../../models/catalog/category.model.js';
import Product from '../../models/catalog/product.model.js';

import { buildPagination } from '../../utils/pagination.js';

import { mapWishlistedState } from '../user/wishlist.service.js';

import {
    buildEffectiveActiveCategoryIds,
    buildEffectiveActiveLeafCategoryIds,
    getEffectiveActiveLeafCategoryIds,
} from './category.service.js';
import {
    buildCatalogEligibilityPipeline,
    buildFallbackRegexQuery,
    buildProductSearchStage,
    executeProductSearchWithFallback,
} from './catalog-query-pipeline.js';
import { toProductCardViewModel } from './product-view-model.js';

async function getHomeCatalogState(options = {}) {
    const {
        category = 'all',
        sort: requestedSortCriteria = [],
        q: keyword = '',
        page = 1,
        limit = paginationConfig.catalog,
        currentUserId = '',
    } = options;
    const sortCriteria = requestedSortCriteria.length
        ? requestedSortCriteria
        : keyword
            ? []
            : ['popular'];
    const sort = sortCriteria.join(',');
    const categoryDocuments = await Category
        .find({})
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    const categoryTree = buildActiveCategoryTree(categoryDocuments);
    const categoryIdByString = new Map(
        categoryDocuments.map(categoryDocument => (
            [String(categoryDocument._id), categoryDocument._id]
        )),
    );
    const activeLeafCategoryIdSet = buildEffectiveActiveLeafCategoryIds(
        categoryDocuments,
    );
    const activeCategoryIds = [...activeLeafCategoryIdSet]
        .map(categoryId => categoryIdByString.get(categoryId))
        .filter(Boolean);
    const productQuery = {
        isPublished: true,
        category: { $in: activeCategoryIds },
    };
    let matchedCategory = null;
    let categoryNotFound = false;
    if (category && category !== 'all') {
        matchedCategory = categoryTree.nodeBySlug.get(category) || null;

        if (matchedCategory) {
            productQuery.category = {
                $in: collectCategorySubtreeLeafIds(
                    matchedCategory,
                    activeLeafCategoryIdSet,
                ),
            };
        } else {
            categoryNotFound = true;
        }
    }

    if (categoryNotFound) {
        return {
            categories: serializeCategoryTree(categoryTree.roots),
            products: [],
            filters: {
                category,
                sort,
                q: keyword,
            },
            pagination: buildPagination({
                page,
                limit,
                totalItems: 0,
            }),
        };
    }

    const catalogQueryOptions = {
        productQuery,
        keyword,
        categoryIds: productQuery.category.$in,
        sortCriteria,
        page,
        limit,
    };
    const catalogResult = keyword
        ? await executeProductSearchWithFallback({
            runMongot: () => executeCatalogQuery({
                ...catalogQueryOptions,
                useMongot: true,
            }),
            runFallback: () => executeCatalogQuery({
                ...catalogQueryOptions,
                useMongot: false,
            }),
            context: {
                source: 'catalog',
                query: keyword,
            },
        })
        : await executeCatalogQuery({
            ...catalogQueryOptions,
            useMongot: false,
        });

    const { pagination, rawProducts } = catalogResult;
    const normalizedProducts = rawProducts.map(product => (
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
    const products = await mapWishlistedState(
        normalizedProducts,
        currentUserId,
    );

    return {
        categories: serializeCategoryTree(categoryTree.roots),
        products,
        filters: {
            category,
            sort,
            q: keyword,
        },
        pagination,
    };
}

async function searchProductSuggestions(query, limit = 6) {
    if (query.length < 2)
        return [];

    const activeCategoryIds = await getEffectiveActiveLeafCategoryIds();

    if (!activeCategoryIds.length)
        return [];

    const suggestionTailPipeline = [
        {
            $lookup: {
                from: 'productvariants',
                let: { productId: '$_id' },
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
                as: 'variant',
            },
        },
        { $unwind: '$variant' },
        { $sort: { searchScore: -1, name: 1, _id: 1 } },
        { $limit: limit },
        {
            $project: {
                _id: 0,
                name: 1,
                slug: 1,
                image: {
                    $ifNull: [
                        { $arrayElemAt: ['$images.url', 0] },
                        '$variant.image.url',
                    ],
                },
                price: '$variant.price',
            },
        },
    ];
    const atlasSearchPipeline = [
        {
            $search: {
                index: PRODUCT_SEARCH_INDEX_NAME,
                compound: {
                    must: [
                        {
                            autocomplete: {
                                query,
                                path: 'name',
                                tokenOrder: 'sequential',
                                fuzzy: {
                                    maxEdits: 1,
                                    prefixLength: 1,
                                    maxExpansions: 64,
                                },
                            },
                        },
                    ],
                    filter: [
                        {
                            equals: {
                                path: 'isPublished',
                                value: true,
                            },
                        },
                        {
                            in: {
                                path: 'category',
                                value: activeCategoryIds,
                            },
                        },
                    ],
                },
            },
        },
        { $set: { searchScore: { $meta: 'searchScore' } } },
        ...suggestionTailPipeline,
    ];
    const fallbackSearchPipeline = [
        {
            $match: {
                isPublished: true,
                category: { $in: activeCategoryIds },
                ...buildFallbackRegexQuery(query, ['name']),
            },
        },
        ...suggestionTailPipeline,
    ];
    const products = await executeProductSearchWithFallback({
        runMongot: () => Product.aggregate(atlasSearchPipeline),
        runFallback: () => Product.aggregate(fallbackSearchPipeline),
        context: {
            source: 'autocomplete',
            query,
        },
    });

    return products;
}

async function executeCatalogQuery({
    productQuery,
    keyword,
    categoryIds,
    sortCriteria,
    page,
    limit,
    useMongot,
}) {
    const effectiveProductQuery = {
        ...productQuery,
        ...(!useMongot && keyword
            ? buildFallbackRegexQuery(keyword, ['name', 'brand', 'description'])
            : {}),
    };
    const searchStage = useMongot && keyword
        ? buildProductSearchStage(keyword, categoryIds)
        : null;
    const searchScoreType = keyword && !sortCriteria.length && useMongot
        ? 'searchScore'
        : '';
    const eligibilityPipeline = buildCatalogEligibilityPipeline(
        effectiveProductQuery,
        searchStage,
        { searchScoreType },
    );
    const [result = {}] = await Product.aggregate([
        ...eligibilityPipeline,
        {
            $facet: {
                metadata: [{ $count: 'totalItems' }],
                products: buildCatalogProductsPipeline({
                    sortCriteria,
                    keyword,
                    page,
                    limit,
                }),
            },
        },
    ]);
    const totalItems = result.metadata?.[0]?.totalItems ?? 0;
    const pagination = buildPagination({
        page,
        limit,
        totalItems,
    });
    let rawProducts = result.products || [];

    if (totalItems && pagination.page !== page) {
        rawProducts = await Product.aggregate([
            ...eligibilityPipeline,
            ...buildCatalogProductsPipeline({
                sortCriteria,
                keyword,
                page: pagination.page,
                limit,
            }),
        ]);
    }

    return {
        pagination,
        rawProducts,
    };
}

function buildCatalogProductsPipeline({
    sortCriteria,
    keyword,
    page,
    limit,
}) {
    return [
        { $sort: getCatalogSortStage(sortCriteria, Boolean(keyword)) },
        { $skip: (page - 1) * limit },
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
    ];
}

function getCatalogSortStage(criteria, hasKeyword) {
    const sortStage = {};

    if (hasKeyword && !criteria.length)
        sortStage.searchScore = -1;

    criteria.forEach((criterion) => {
        const definition = catalogSortDefinitions[criterion];

        definition.fields.forEach(([field, direction]) => {
            if (!Object.hasOwn(sortStage, field))
                sortStage[field] = direction;
        });
    });

    if (!Object.hasOwn(sortStage, 'createdAt'))
        sortStage.createdAt = -1;

    sortStage._id = -1;

    return sortStage;
}

function buildActiveCategoryTree(categoryDocuments = []) {
    const nodes = categoryDocuments.map(category => ({
        _id: category._id,
        name: category.name,
        slug: category.slug,
        parent: category.parent,
        isActive: Boolean(category.isActive),
        sortOrder: category.sortOrder,
        children: [],
    }));
    const activeIds = buildEffectiveActiveCategoryIds(nodes);
    const activeNodes = nodes.filter(node => activeIds.has(String(node._id)));
    const activeNodeById = new Map(
        activeNodes.map(node => [String(node._id), node]),
    );

    activeNodes.forEach((node) => {
        if (node.parent)
            activeNodeById.get(String(node.parent)).children.push(node);
    });

    return {
        roots: activeNodes.filter(node => !node.parent),
        activeNodes,
        nodeBySlug: new Map(activeNodes.map(node => [node.slug, node])),
    };
}

function collectCategorySubtreeLeafIds(category, leafCategoryIdSet) {
    const ids = [];
    const stack = [category];

    while (stack.length) {
        const current = stack.pop();

        if (leafCategoryIdSet.has(String(current._id)))
            ids.push(current._id);

        stack.push(...current.children);
    }

    return ids;
}

function serializeCategoryTree(categories = []) {
    return categories.map(category => ({
        slug: category.slug,
        name: category.name,
        children: serializeCategoryTree(category.children),
    }));
}

export {
    getHomeCatalogState,
    searchProductSuggestions,
};
