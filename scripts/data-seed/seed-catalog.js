import mongoose from 'mongoose';

import Attribute from '../../models/catalog/attribute.model.js';
import Category from '../../models/catalog/category.model.js';
import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import { dateDaysAgo } from '../../utils/date.js';
import { createRandom } from '../../utils/random.js';

function categoryKey(categoryId, attributeName) {
    return `${categoryId.toString()}:${attributeName}`;
}

function buildCategoryDefinitions(products) {
    const parents = [];
    const parentBySlug = new Map();
    const leaves = [];
    const leafBySlug = new Map();

    products.forEach((product) => {
        const parent = product.category.parent;
        const leaf = product.category.leaf;

        if (!parentBySlug.has(parent.slug)) {
            const definition = {
                name: parent.name,
                slug: parent.slug,
                sortOrder: parents.length,
            };
            parents.push(definition);
            parentBySlug.set(parent.slug, definition);
        }

        if (!leafBySlug.has(leaf.slug)) {
            const definition = {
                name: leaf.name,
                slug: leaf.slug,
                parentSlug: parent.slug,
                sortOrder: leaves.filter(
                    item => item.parentSlug === parent.slug,
                ).length,
            };
            leaves.push(definition);
            leafBySlug.set(leaf.slug, definition);
        }
    });

    return { parents, leaves };
}

async function seedCategories(products) {
    const definitions = buildCategoryDefinitions(products);
    const now = new Date();
    const parentDocs = definitions.parents.map(definition => ({
        _id: new mongoose.Types.ObjectId(),
        name: definition.name,
        slug: definition.slug,
        parent: null,
        isActive: true,
        sortOrder: definition.sortOrder,
        createdAt: now,
        updatedAt: now,
    }));

    await Category.insertMany(parentDocs);

    const parentBySlug = new Map(
        parentDocs.map(document => [document.slug, document]),
    );
    const leafDocs = definitions.leaves.map(definition => ({
        _id: new mongoose.Types.ObjectId(),
        name: definition.name,
        slug: definition.slug,
        parent: parentBySlug.get(definition.parentSlug)._id,
        isActive: true,
        sortOrder: definition.sortOrder,
        createdAt: now,
        updatedAt: now,
    }));

    await Category.insertMany(leafDocs);

    return {
        parentBySlug,
        leafBySlug: new Map(
            leafDocs.map(document => [document.slug, document]),
        ),
    };
}

async function seedAttributes(products, categoryState) {
    const definitions = new Map();

    products.forEach((product) => {
        const category = categoryState.leafBySlug.get(
            product.category.leaf.slug,
        );

        product.specifications.forEach((specification) => {
            const key = categoryKey(category._id, specification.attribute);

            if (!definitions.has(key)) {
                definitions.set(key, {
                    _id: new mongoose.Types.ObjectId(),
                    name: specification.attribute,
                    category: category._id,
                    unit: '',
                });
            }
        });
    });

    const docs = [...definitions.values()];
    await Attribute.insertMany(docs);

    return new Map(docs.map(attribute => [
        categoryKey(attribute.category, attribute.name),
        attribute,
    ]));
}

function buildSpecifications(sourceProduct, categoryId, attributeByKey) {
    return sourceProduct.specifications.map((specification) => {
        const attribute = attributeByKey.get(
            categoryKey(categoryId, specification.attribute),
        );

        if (!attribute) {
            throw new Error(
                `Missing attribute ${specification.attribute} for `
                + `${sourceProduct.source.productCode}.`,
            );
        }

        return {
            attribute: attribute._id,
            value: specification.value,
        };
    });
}

async function seedCatalog(config, sourceProducts) {
    const random = createRandom();
    const categoryState = await seedCategories(sourceProducts);
    const attributeByKey = await seedAttributes(
        sourceProducts,
        categoryState,
    );
    const productDocs = [];
    const productMetaById = new Map();

    sourceProducts.forEach((sourceProduct) => {
        const category = categoryState.leafBySlug.get(
            sourceProduct.category.leaf.slug,
        );
        const productId = new mongoose.Types.ObjectId();
        const createdAt = dateDaysAgo(
            random.int(120, 360),
            random.int(8, 18),
        );
        const document = {
            _id: productId,
            name: sourceProduct.name,
            slug: sourceProduct.slug,
            description: sourceProduct.description || '',
            category: category._id,
            brand: sourceProduct.brand || '',
            images: sourceProduct.images.map(image => ({
                url: image.url,
                publicId: image.publicId,
            })),
            specifications: buildSpecifications(
                sourceProduct,
                category._id,
                attributeByKey,
            ),
            rating: { sum: 0, average: 0, count: 0 },
            likes: 0,
            sold: 0,
            isPublished: sourceProduct.isPublished !== false,
            createdAt,
            updatedAt: createdAt,
        };

        productDocs.push(document);
        productMetaById.set(productId.toString(), {
            source: sourceProduct,
            document,
        });
    });

    // product-info.json has already passed a strict preflight. Using the raw
    // collection here intentionally preserves the deterministic source slug;
    // Product's pre-validate hook otherwise rebuilds slugs from names.
    await Product.collection.insertMany(productDocs, { ordered: true });

    const variantDocs = [];
    const variantMetaById = new Map();
    const variantsByProductId = new Map();
    const initialStockByVariantId = new Map();

    for (const productDoc of productDocs) {
        const productId = productDoc._id.toString();
        const sourceProduct = productMetaById.get(productId).source;
        const productVariants = sourceProduct.variants.map((sourceVariant) => {
            const variantId = new mongoose.Types.ObjectId();
            const variant = {
                _id: variantId,
                product: productDoc._id,
                sku: sourceVariant.sku,
                options: sourceVariant.options.map(option => ({
                    name: option.name,
                    value: option.value,
                })),
                price: sourceVariant.price,
                originalPrice: sourceVariant.originalPrice,
                stock: sourceVariant.stock,
                image: {
                    url: sourceVariant.image.url,
                    publicId: sourceVariant.image.publicId,
                },
                isPublished: sourceVariant.isPublished !== false,
                createdAt: productDoc.createdAt,
                updatedAt: productDoc.updatedAt,
            };

            variantDocs.push(variant);
            variantMetaById.set(variantId.toString(), {
                source: sourceVariant,
                document: variant,
                product: productDoc,
            });
            initialStockByVariantId.set(
                variantId.toString(),
                sourceVariant.stock,
            );
            return variant;
        });

        variantsByProductId.set(productId, productVariants);
    }

    await ProductVariant.insertMany(variantDocs);

    return {
        categories: categoryState,
        products: productDocs,
        productMetaById,
        variants: variantDocs,
        variantMetaById,
        variantsByProductId,
        initialStockByVariantId,
    };
}

export { seedCatalog };
