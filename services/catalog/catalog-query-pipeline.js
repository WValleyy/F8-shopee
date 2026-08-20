import { PRODUCT_SEARCH_INDEX_NAME } from '../../config/product-search.js';

import { logAppEvent } from '../../utils/error/app-error-logger.js';
import { escapeRegex } from '../../utils/regex.js';

let mongotUnavailable = false;

async function executeProductSearchWithFallback({
    runMongot,
    runFallback,
    context = {},
}) {
    if (mongotUnavailable)
        return runFallback();

    try {
        return await runMongot();
    } catch (error) {
        const searchUnsupported = error?.code === 31082
            || error?.codeName === 'SearchNotEnabled'
            || (
                error?.code === 40324
                && String(error.message).includes('$search')
            );

        if (!searchUnsupported)
            throw error;

        mongotUnavailable = true;
        await logAppEvent('product-search:auto-fallback', 'warning', {
            source: context.source,
            query: context.query,
            code: error?.code,
            codeName: error?.codeName,
            error: error?.message || String(error),
        });

        return runFallback();
    }
}

function buildProductSearchStage(query, categoryIds = []) {
    const filter = [
        {
            equals: {
                path: 'isPublished',
                value: true,
            },
        },
    ];

    if (categoryIds.length) {
        filter.push({
            in: {
                path: 'category',
                value: categoryIds,
            },
        });
    }

    return {
        $search: {
            index: PRODUCT_SEARCH_INDEX_NAME,
            compound: {
                filter,
                should: [
                    {
                        text: {
                            query,
                            path: 'name',
                            fuzzy: {
                                maxEdits: 1,
                                prefixLength: 1,
                                maxExpansions: 64,
                            },
                            score: { boost: { value: 5 } },
                        },
                    },
                    {
                        text: {
                            query,
                            path: 'brand',
                            fuzzy: {
                                maxEdits: 1,
                                prefixLength: 1,
                                maxExpansions: 32,
                            },
                            score: { boost: { value: 3 } },
                        },
                    },
                    {
                        text: {
                            query,
                            path: 'description',
                            fuzzy: {
                                maxEdits: 1,
                                prefixLength: 1,
                                maxExpansions: 32,
                            },
                        },
                    },
                ],
                minimumShouldMatch: 1,
            },
        },
    };
}

function buildFallbackRegexQuery(query, fields = []) {
    return {
        $or: fields.map(field => ({
            [field]: {
                $regex: escapeRegex(query),
                $options: 'i',
            },
        })),
    };
}

function buildCatalogEligibilityPipeline(
    productQuery = {},
    searchStage = null,
    options = {},
) {
    const {
        searchScoreType = '',
    } = options;

    return [
        ...(searchStage ? [searchStage] : []),
        { $match: productQuery },
        ...(searchScoreType
            ? [{
                $set: {
                    searchScore: {
                        $meta: searchScoreType,
                    },
                },
            }]
            : []),
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
                    {
                        $sort: {
                            price: 1,
                            createdAt: 1,
                            _id: 1,
                        },
                    },
                    { $limit: 1 },
                ],
                as: 'variantDoc',
            },
        },
        { $unwind: '$variantDoc' },
    ];
}

export {
    buildCatalogEligibilityPipeline,
    buildFallbackRegexQuery,
    buildProductSearchStage,
    executeProductSearchWithFallback,
};
