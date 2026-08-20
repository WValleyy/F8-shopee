import mongoose from 'mongoose';

import paginationConfig from '../../../config/pagination.js';
import { uploadFolders } from '../../../config/upload-image.js';
import Order from '../../../models/commerce/order.model.js';
import Product from '../../../models/catalog/product.model.js';
import ProductVariant from '../../../models/catalog/product-variant.model.js';
import Attribute from '../../../models/catalog/attribute.model.js';
import WishList from '../../../models/user/wish-list.model.js';
import {
    cleanupUploadedImages,
    createPendingCloudinaryImage,
    uploadCloudinaryImages,
} from '../../image/cloudinary-image.service.js';
import { requestError } from '../../../utils/error/app-error.js';
import { buildPagination } from '../../../utils/pagination.js';
import { escapeRegex } from '../../../utils/regex.js';
import { getCategoryAssignmentState } from '../../catalog/category.service.js';
import { lockCategoryTree } from './admin-category.service.js';
import { refreshProductRatings } from '../../catalog/product-rating.service.js';

async function listAdminProductsPage(options = {}) {
    const {
        q = '',
        category = 'all',
        status = 'all',
        page = 1,
    } = options;
    const productQuery = {};

    if (q) {
        const pattern = new RegExp(escapeRegex(q), 'i');
        productQuery.$or = [
            { name: pattern },
            { brand: pattern },
            { slug: pattern },
        ];
    }

    if (category !== 'all')
        productQuery.category = new mongoose.Types.ObjectId(category);

    if (status !== 'all')
        productQuery.isPublished = status === 'published';

    const totalItems = await Product.countDocuments(productQuery);
    const pagination = buildPagination({
        page,
        limit: paginationConfig.admin,
        totalItems,
    });

    const productDocuments = await Product
        .find(productQuery)
        .select('name brand images category isPublished rating sold createdAt')
        .populate({
            path: 'category',
            select: 'name',
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * paginationConfig.admin)
        .limit(paginationConfig.admin)
        .lean();
    const productIds = productDocuments.map(product => product._id);
    const variantSummaries = productIds.length
        ? await ProductVariant.aggregate([
            {
                $match: {
                    product: { $in: productIds },
                },
            },
            {
                $sort: {
                    product: 1,
                    price: 1,
                    createdAt: 1,
                    _id: 1,
                },
            },
            {
                $group: {
                    _id: '$product',
                    variantCount: { $sum: 1 },
                    stock: { $sum: '$stock' },
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' },
                    variantImage: { $first: '$image.url' },
                },
            },
        ])
        : [];
    const summaryByProductId = new Map(
        variantSummaries.map(item => [item._id.toString(), item]),
    );

    return {
        products: productDocuments.map((product) => {
            const summary = summaryByProductId.get(product._id.toString()) || {};

            return {
                id: product._id.toString(),
                name: product.name,
                brand: product.brand,
                image: product.images?.[0]?.url || summary.variantImage || '',
                categoryName: product.category.name,
                isPublished: Boolean(product.isPublished),
                ratingAverage: product.rating.average,
                ratingCount: product.rating.count,
                sold: product.sold,
                variantCount: summary.variantCount ?? 0,
                stock: summary.stock ?? 0,
                minPrice: summary.minPrice ?? 0,
                maxPrice: summary.maxPrice ?? 0,
            };
        }),
        filters: { q, category, status },
        pagination,
    };
}

async function getAdminProduct(productId) {
    const product = await Product
        .findById(productId)
        .populate('specifications.attribute', 'name category unit')
        .lean();

    if (!product)
        return null;

    const variants = await ProductVariant
        .find({ product: product._id })
        .sort({ createdAt: 1, _id: 1 })
        .lean();

    return {
        id: product._id.toString(),
        name: product.name,
        description: product.description,
        categoryId: product.category.toString(),
        brand: product.brand,
        specifications: (product.specifications || []).map(item => ({
            attributeId: item.attribute?._id?.toString() || '',
            value: String(item.value ?? ''),
        })),
        isPublished: Boolean(product.isPublished),
        updatedAt: product.updatedAt,
        gallery: product.images,
        variants: variants.map(variant => ({
            id: variant._id.toString(),
            updatedAt: variant.updatedAt,
            sku: variant.sku,
            options: variant.options,
            price: variant.price,
            originalPrice: variant.originalPrice,
            stock: variant.stock,
            image: variant.image.url,
            isPublished: Boolean(variant.isPublished),
        })),
    };
}

async function listAdminProductAttributes() {
    const attributes = await Attribute
        .find({})
        .select('name category unit')
        .sort({ category: 1, name: 1 })
        .lean();

    return attributes.map(attribute => ({
        id: attribute._id.toString(),
        name: attribute.name,
        categoryId: attribute.category.toString(),
        unit: attribute.unit,
    }));
}

async function saveAdminProduct(productId, data) {
    // Load and validate the current product state.
    const currentProduct = productId
        ? await getAdminProduct(productId)
        : null;

    if (productId && !currentProduct)
        throw requestError('PRODUCT_NOT_FOUND');

    if (
        data.isPublished
        && !data.variants.some(variant => variant.isPublished)
    ) {
        throw requestError(
            'PUBLISHED_PRODUCT_REQUIRES_PUBLISHED_VARIANT',
        );
    }

    const {
        existingVariantIds,
        submittedVariantIds,
    } = validateSubmittedVariants(currentProduct, data.variants);
    const omittedVariantIds = [...existingVariantIds]
        .filter(id => !submittedVariantIds.has(id));

    // Prepare final image references before writing them to MongoDB.
    const productObjectId = productId
        ? new mongoose.Types.ObjectId(productId)
        : new mongoose.Types.ObjectId();

    const existingGallery = currentProduct?.gallery || [];
    let retainedImages = [];

    if (currentProduct) {
        retainedImages = data.retainedImagePublicIds.map(publicId => (
            existingGallery.find(
                image => image.publicId === publicId,
            )
        ));

        if (retainedImages.some(image => !image))
            throw requestError('PRODUCT_RETAINED_IMAGES_INVALID');
    }

    const pendingProductImages = data.productImageFiles.map(source => ({
        ...createPendingCloudinaryImage(source, {
            folder: `${uploadFolders.product}/${productObjectId}`,
        }),
    }));
    const pendingVariantImages = data.variantImageFiles.map(source => ({
        ...createPendingCloudinaryImage(source, {
            folder: `${uploadFolders.product}/${productObjectId}/variants`,
        }),
    }));

    const finalGallery = [
        ...retainedImages,
        ...pendingProductImages,
    ];
    const pendingImages = [
        ...pendingProductImages,
        ...pendingVariantImages,
    ];

    const session = await mongoose.startSession();
    let outcome;

    // Persist the product and its variants atomically.
    try {
        outcome = await session.withTransaction(async () => {
            // Revalidate mutable category and variant constraints.
            await lockCategoryTree(session);

            const categoryState = await getCategoryAssignmentState(
                data.categoryId,
                { session },
            );

            if (!categoryState.exists || !categoryState.isEffectivelyActive)
                throw requestError('PRODUCT_CATEGORY_UNAVAILABLE');

            if (!categoryState.isLeaf)
                throw requestError('PRODUCT_CATEGORY_NOT_LEAF');

            const specificationAttributeIds = data.specifications.map(
                specification => specification.attributeId,
            );
            const validSpecificationAttributeIds = await Attribute
                .find({
                    _id: { $in: specificationAttributeIds },
                    category: data.categoryId,
                })
                .distinct('_id')
                .session(session);

            if (validSpecificationAttributeIds.length !== new Set(specificationAttributeIds).size)
                throw requestError('FIELD_INVALID', {
                    messageParams: { fieldLabel: 'specifications' },
                });

            if (omittedVariantIds.length) {
                const orderedVariantIds = await findOrderedVariantIds(
                    omittedVariantIds,
                    { session },
                );

                if (orderedVariantIds.length) {
                    throw requestError('PRODUCT_VARIANT_HAS_ORDERS', {
                        meta: {
                            variantIds: orderedVariantIds,
                        },
                    });
                }
            }

            // Create or update the product with optimistic concurrency control.
            let product = null;
            if (currentProduct) {
                product = await Product.findOne({
                    _id: currentProduct.id,
                    updatedAt: currentProduct.updatedAt,
                }).session(session);

                if (!product)
                    throw requestError('PRODUCT_EDIT_CONFLICT');

                product.name = data.name;
                product.description = data.description;
                product.brand = data.brand;
                product.category = data.categoryId;
                product.isPublished = data.isPublished;
                product.specifications = data.specifications.map(specification => ({
                    attribute: specification.attributeId,
                    value: specification.value,
                }));
                product.images = finalGallery.map(image => ({
                    url: image.url,
                    publicId: image.publicId,
                }));
                await product.save({ session });
            } else {
                product = new Product({
                    _id: productObjectId,
                    name: data.name,
                    description: data.description,
                    brand: data.brand,
                    category: data.categoryId,
                    isPublished: data.isPublished,
                    specifications: data.specifications.map(specification => ({
                        attribute: specification.attributeId,
                        value: specification.value,
                    })),
                    images: finalGallery.map(image => ({
                        url: image.url,
                        publicId: image.publicId,
                    })),
                });
                await product.save({ session });
            }

            // Build existing and new variant documents from the submitted rows.
            let existingVariantById = new Map();

            if (submittedVariantIds.size) {
                const existingVariants = await ProductVariant.find({
                    _id: { $in: [...submittedVariantIds] },
                    product: productObjectId,
                }).session(session);

                existingVariantById = new Map(
                    existingVariants.map(variant => [variant._id.toString(), variant]),
                );
            }

            const replacedVariantImages = [];
            const deletedVariantImages = [];

            const newVariantDocuments = [];

            for (const variantData of data.variants) {
                const existingVariant = variantData.variantId
                    ? existingVariantById.get(variantData.variantId)
                    : null;

                if (variantData.variantId && !existingVariant)
                    throw requestError('PRODUCT_EDIT_CONFLICT');

                let variantImageAsset;

                if (variantData.imageFileIndex === null) {
                    variantImageAsset = {
                        url: existingVariant.image.url,
                        publicId: existingVariant.image.publicId,
                    };
                } else {
                    const pendingImage = pendingVariantImages[
                        variantData.imageFileIndex
                    ];

                    if (existingVariant) {
                        replacedVariantImages.push({
                            variantId: existingVariant._id.toString(),
                            url: existingVariant.image.url,
                            publicId: existingVariant.image.publicId,
                        });
                    }

                    variantImageAsset = {
                        url: pendingImage.url,
                        publicId: pendingImage.publicId,
                    };
                }

                const variantValues = {
                    sku: variantData.sku,
                    options: variantData.options,
                    price: variantData.price,
                    originalPrice: variantData.originalPrice,
                    stock: variantData.stock,
                    image: {
                        url: variantImageAsset.url,
                        publicId: variantImageAsset.publicId,
                    },
                    isPublished: variantData.isPublished,
                };

                if (!existingVariant) {
                    newVariantDocuments.push(new ProductVariant({
                        product: product._id,
                        ...variantValues,
                    }));
                    continue;
                }

                // Prevent a stale editor payload from overwriting stock reserved by an Order.
                const updateResult = await ProductVariant.updateOne(
                    {
                        _id: existingVariant._id,
                        product: product._id,
                        updatedAt: variantData.updatedAt,
                    },
                    { $set: variantValues },
                    { session, runValidators: true },
                );

                if (updateResult.matchedCount !== 1)
                    throw requestError('PRODUCT_EDIT_CONFLICT');
            }

            if (newVariantDocuments.length) {
                await ProductVariant.bulkSave(
                    newVariantDocuments,
                    { session },
                );
            }

            // Remove variants omitted from the submitted editor state.
            if (omittedVariantIds.length) {
                const omittedVariants = await ProductVariant.find({
                    _id: { $in: omittedVariantIds },
                    product: product._id,
                })
                    .select('image')
                    .session(session)
                    .lean();

                omittedVariants.forEach(variant => {
                    deletedVariantImages.push({
                        url: variant.image.url,
                        publicId: variant.image.publicId,
                    });
                });

                await ProductVariant.deleteMany(
                    {
                        _id: { $in: omittedVariantIds },
                        product: product._id,
                    },
                    { session },
                );
            }

            return {
                replacedVariantImages,
                deletedVariantImages,
            };
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw requestError('PRODUCT_SLUG_CONFLICT', {
                cause: error,
            });
        }

        throw error;
    } finally {
        await session.endSession();
    }

    // Intentional trade-off: MongoDB remains authoritative after commit.
    // Image upload failures are logged and do not roll back product data.
    await uploadCloudinaryImages(pendingImages, {
        rollback: false,
    });

    // Cleanup old images that are no longer referenced by active data or orders.
    const retainedPublicIds = new Set(finalGallery.map(image => image.publicId));
    const removedProductImages = existingGallery.filter(image => (
        !retainedPublicIds.has(image.publicId)
    ));
    const orderedVariantIdSet = new Set(await findOrderedVariantIds(
        outcome.replacedVariantImages.map(image => image.variantId),
    ));
    const unreferencedReplacedVariantImages = outcome.replacedVariantImages
        .filter(image => !orderedVariantIdSet.has(image.variantId));

    await cleanupUploadedImages(
        removedProductImages,
        'removed-product-images',
    );

    await cleanupUploadedImages(
        [
            ...unreferencedReplacedVariantImages,
            ...outcome.deletedVariantImages,
        ],
        'removed-variant-images',
    );
}

async function applyAdminProductBulkAction(productIds, action) {
    if (action === 'REFRESH_RATING') {
        await refreshProductRatings(productIds);
        return;
    }

    if (action !== 'PUBLISH') {
        await Product.updateMany(
            { _id: { $in: productIds } },
            { $set: { isPublished: false } },
        );
        return;
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const publishedVariantProductIds = await ProductVariant.distinct(
                'product',
                {
                    product: { $in: productIds },
                    isPublished: true,
                },
            ).session(session);
            const eligibleProductIdSet = new Set(
                publishedVariantProductIds.map(id => id.toString()),
            );
            const ineligibleProductIds = productIds.filter(
                id => !eligibleProductIdSet.has(id.toString()),
            );

            if (ineligibleProductIds.length) {
                throw requestError(
                    'PUBLISHED_PRODUCT_REQUIRES_PUBLISHED_VARIANT',
                    { meta: { productIds: ineligibleProductIds } },
                );
            }

            await Product.updateMany(
                { _id: { $in: productIds } },
                { $set: { isPublished: true } },
                { session },
            );
        });
    } finally {
        await session.endSession();
    }
}

async function deleteAdminProduct(productId) {
    const session = await mongoose.startSession();
    let outcome;

    try {
        outcome = await session.withTransaction(async () => {
            const product = await Product.findById(productId)
                .select('images')
                .session(session)
                .lean();

            if (!product)
                throw requestError('PRODUCT_NOT_FOUND');

            const existingOrder = await Order.exists({
                'items.product': product._id,
            }).session(session);

            if (existingOrder)
                throw requestError('PRODUCT_HAS_ORDERS');

            const variants = await ProductVariant.find({ product: product._id })
                .select('_id image')
                .session(session)
                .lean();

            const galleryAssets = product.images.map(image => ({
                url: image.url,
                publicId: image.publicId,
            }));

            const variantAssets = variants.map(variant => ({
                url: variant.image.url,
                publicId: variant.image.publicId,
            }));

            const uniqueImageAssets = [
                ...new Map(
                    [...galleryAssets, ...variantAssets].map(image => [image.publicId, image]),
                ).values(),
            ];

            await WishList.deleteMany(
                { product: product._id },
                { session },
            );

            await ProductVariant.deleteMany(
                { product: product._id },
                { session },
            );

            const productResult = await Product.deleteOne(
                { _id: product._id },
                { session },
            );

            if (productResult.deletedCount !== 1)
                throw requestError('PRODUCT_DELETE_CONFLICT');

            return {
                imageAssets: uniqueImageAssets,
            };
        });
    } finally {
        await session.endSession();
    }

    await cleanupUploadedImages(
        outcome.imageAssets,
        'deleted-product-images',
    );
}

async function findOrderedVariantIds(variantIds, { session } = {}) {
    const normalizedIds = [...new Set(variantIds.map(String))];

    if (!normalizedIds.length)
        return [];

    const query = Order.find({
        'items.variant': { $in: normalizedIds },
    })
        .select('items.variant')
        .lean();

    if (session)
        query.session(session);

    const orders = await query;
    const requestedIdSet = new Set(normalizedIds);
    const orderedIdSet = new Set();

    for (const order of orders) {
        for (const item of order.items) {
            const variantId = item.variant.toString();

            if (requestedIdSet.has(variantId))
                orderedIdSet.add(variantId);
        }
    }

    return [...orderedIdSet];
}

function validateSubmittedVariants(currentProduct, variants) {
    const existingVariantIds = new Set(
        (currentProduct?.variants || []).map(variant => variant.id),
    );
    const submittedVariantIds = new Set();
    const variantLabelByOptionKey = new Map();
    let expectedOptionNamesKey = null;
    const messages = [];

    for (const [index, variant] of variants.entries()) {
        const variantLabel = variant.sku
            ? `SKU "${variant.sku}"`
            : `ở dòng ${index + 1}`;
        const optionNames = new Set();

        if (variant.originalPrice < variant.price) {
            throw requestError('FIELD_OUT_OF_RANGE', {
                messageParams: {
                    fieldLabel: `Giá gốc của phiên bản ${variantLabel}`,
                },
            });
        }

        for (const option of variant.options) {
            const normalizedName = option.name.toLowerCase();

            if (optionNames.has(normalizedName)) {
                throw requestError('PRODUCT_VARIANT_OPTION_NAME_DUPLICATED', {
                    messageParams: { optionName: option.name },
                });
            }

            optionNames.add(normalizedName);
        }
        const optionKey = JSON.stringify(
            variant.options
                .map(option => [
                    option.name,
                    option.value.toLowerCase(),
                ])
                .sort(([leftName, leftValue], [rightName, rightValue]) => (
                    leftName.localeCompare(rightName)
                    || leftValue.localeCompare(rightValue)
                )),
        );
        const optionNamesKey = JSON.stringify(
            variant.options
                .map(option => option.name)
                .sort((left, right) => left.localeCompare(right)),
        );
        const duplicateVariantLabel = variantLabelByOptionKey.get(optionKey);

        if (expectedOptionNamesKey === null) {
            expectedOptionNamesKey = optionNamesKey;
        } else if (optionNamesKey !== expectedOptionNamesKey) {
            messages.push(
                `Phiên bản ${variantLabel} không có cùng nhóm phân loại với các phiên bản khác.`,
            );
        }

        if (duplicateVariantLabel) {
            messages.push(
                `Phiên bản ${variantLabel} trùng tổ hợp phân loại với phiên bản ${duplicateVariantLabel}.`,
            );
        } else {
            variantLabelByOptionKey.set(optionKey, variantLabel);
        }

        if (!variant.variantId)
            continue;

        if (!existingVariantIds.has(variant.variantId)) {
            messages.push(`Phiên bản ${variantLabel} không thuộc sản phẩm này.`);
            continue;
        }

        if (submittedVariantIds.has(variant.variantId)) {
            messages.push(`Phiên bản ${variantLabel} bị lặp.`);
            continue;
        }

        submittedVariantIds.add(variant.variantId);
    }

    if (messages.length) {
        throw requestError('PRODUCT_VALIDATION_FAILED', {
            meta: { messages },
        });
    }

    return {
        existingVariantIds,
        submittedVariantIds,
    };
}

export {
    applyAdminProductBulkAction,
    deleteAdminProduct,
    getAdminProduct,
    listAdminProductAttributes,
    listAdminProductsPage,
    saveAdminProduct,
};
