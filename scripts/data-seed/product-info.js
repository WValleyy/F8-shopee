import fs from 'node:fs/promises';

import inputLimits from '../../config/input-limits.js';
import commerceConfig from '../../config/commerce.js';

function isNonEmptyString(value) {
    return typeof value === 'string' && Boolean(value.trim());
}

function assert(condition, message) {
    if (!condition)
        throw new Error(`Product seed data invalid: ${message}`);
}

function validateImage(image, label) {
    assert(image && typeof image === 'object', `${label} image is missing.`);
    assert(isNonEmptyString(image.url), `${label} image.url is required.`);
    assert(
        isNonEmptyString(image.publicId),
        `${label} image.publicId is required.`,
    );
}

function validateVariant(variant, label, skuSet) {
    assert(isNonEmptyString(variant.sku), `${label} SKU is required.`);
    assert(
        variant.sku.length <= inputLimits.productVariant.skuMaxLength,
        `${label} SKU is too long.`,
    );
    assert(!skuSet.has(variant.sku), `duplicate SKU ${variant.sku}.`);
    skuSet.add(variant.sku);

    assert(Array.isArray(variant.options), `${label} options must be an array.`);
    variant.options.forEach((option, index) => {
        assert(
            isNonEmptyString(option?.name),
            `${label} option ${index} name is required.`,
        );
        assert(
            isNonEmptyString(option?.value),
            `${label} option ${index} value is required.`,
        );
        assert(
            option.name.length <= inputLimits.productVariant.optionNameMaxLength,
            `${label} option name is too long.`,
        );
        assert(
            option.value.length <= inputLimits.productVariant.optionValueMaxLength,
            `${label} option value is too long.`,
        );
    });

    for (const [field, value] of [
        ['price', variant.price],
        ['originalPrice', variant.originalPrice],
        ['stock', variant.stock],
    ]) {
        assert(
            Number.isSafeInteger(value) && value >= 0,
            `${label} ${field} must be a non-negative integer.`,
        );
    }
    assert(
        variant.price <= variant.originalPrice,
        `${label} price cannot exceed originalPrice.`,
    );
    assert(
        variant.price <= commerceConfig.order.maxUnitPrice,
        `${label} price exceeds the order unit-price limit.`,
    );

    validateImage(variant.image, label);
}

function validateProduct(product, index, state) {
    const label = `product[${index}]`;
    const productCode = product?.source?.productCode;
    const parent = product?.category?.parent;
    const leaf = product?.category?.leaf;

    assert(isNonEmptyString(productCode), `${label} productCode is required.`);
    assert(
        !state.productCodes.has(productCode),
        `duplicate productCode ${productCode}.`,
    );
    state.productCodes.add(productCode);

    assert(isNonEmptyString(product.name), `${label} name is required.`);
    assert(
        product.name.length <= inputLimits.product.nameMaxLength,
        `${productCode} name is too long.`,
    );
    const normalizedName = product.name.trim().toLocaleLowerCase('en-US');
    assert(
        !state.productNames.has(normalizedName),
        `duplicate product name ${product.name}.`,
    );
    state.productNames.add(normalizedName);

    assert(isNonEmptyString(product.slug), `${productCode} slug is required.`);
    assert(!state.slugs.has(product.slug), `duplicate slug ${product.slug}.`);
    state.slugs.add(product.slug);

    assert(
        typeof product.description === 'string',
        `${productCode} description must be a string.`,
    );
    assert(
        product.description.length <= inputLimits.product.descriptionMaxLength,
        `${productCode} description is too long.`,
    );
    assert(
        typeof product.brand === 'string'
        && product.brand.length <= inputLimits.product.brandMaxLength,
        `${productCode} brand is invalid.`,
    );

    for (const [category, categoryLabel] of [
        [parent, 'parent category'],
        [leaf, 'leaf category'],
    ]) {
        assert(
            isNonEmptyString(category?.name),
            `${productCode} ${categoryLabel} name is required.`,
        );
        assert(
            isNonEmptyString(category?.slug),
            `${productCode} ${categoryLabel} slug is required.`,
        );
    }
    assert(
        parent.slug !== leaf.slug,
        `${productCode} parent and leaf slugs must differ.`,
    );

    const knownLeafParent = state.leafParentBySlug.get(leaf.slug);
    if (knownLeafParent) {
        assert(
            knownLeafParent === parent.slug,
            `${leaf.slug} is assigned to multiple parents.`,
        );
    } else {
        state.leafParentBySlug.set(leaf.slug, parent.slug);
    }

    assert(
        Array.isArray(product.images) && product.images.length > 0,
        `${productCode} must contain at least one product image.`,
    );
    product.images.forEach((image, imageIndex) => {
        validateImage(image, `${productCode} product image ${imageIndex}`);
    });

    assert(
        Array.isArray(product.specifications),
        `${productCode} specifications must be an array.`,
    );
    const specificationNames = new Set();
    product.specifications.forEach((specification, specificationIndex) => {
        const specLabel = `${productCode} specification ${specificationIndex}`;
        assert(
            isNonEmptyString(specification?.attribute),
            `${specLabel} attribute is required.`,
        );
        assert(
            specification.value !== undefined
            && specification.value !== null
            && String(specification.value).trim(),
            `${specLabel} value is required.`,
        );
        assert(
            !specificationNames.has(specification.attribute),
            `${productCode} has duplicate specification ${specification.attribute}.`,
        );
        specificationNames.add(specification.attribute);
    });

    assert(
        Array.isArray(product.variants) && product.variants.length > 0,
        `${productCode} must contain at least one variant.`,
    );
    product.variants.forEach((variant, variantIndex) => {
        validateVariant(
            variant,
            `${productCode} variant ${variantIndex}`,
            state.skus,
        );
    });
}

function validateProductInfo(products) {
    assert(Array.isArray(products), 'product-info.json must contain an array.');
    assert(products.length > 0, 'product-info.json contains no products.');

    const state = {
        productCodes: new Set(),
        productNames: new Set(),
        slugs: new Set(),
        skus: new Set(),
        leafParentBySlug: new Map(),
    };

    products.forEach((product, index) => validateProduct(product, index, state));

    return {
        productCount: products.length,
        variantCount: products.reduce(
            (total, product) => total + product.variants.length,
            0,
        ),
        parentCount: new Set(
            products.map(product => product.category.parent.slug),
        ).size,
        leafCount: state.leafParentBySlug.size,
    };
}

async function loadProductInfo(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    const products = JSON.parse(raw);
    const summary = validateProductInfo(products);

    return { products, summary };
}

export {
    loadProductInfo,
    validateProductInfo,
};
