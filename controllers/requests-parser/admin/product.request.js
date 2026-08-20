import inputLimits from '../../../config/input-limits.js';
import { uploadLimits } from '../../../config/upload-image.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    readBoolean,
    readEnum,
    readFormBoolean,
    readFormJsonArray,
    readNumber,
    readObjectBody,
    readObjectId,
    readObjectIdArray,
    readOptionalString,
    readRequiredString,
} from '../shared/request-value.js';
import { parseAdminListQuery } from './admin-list-query.js';

function parseAdminProductQuery(query = {}) {
    return {
        ...parseAdminListQuery(query),
        category: query.category == null || query.category === 'all'
            ? 'all'
            : readObjectId(query.category, 'category'),
        status: readEnum(
            query.status,
            'status',
            ['all', 'published', 'hidden'],
            { defaultValue: 'all' },
        ),
    };
}

function parseVariantOptions(value, label) {
    let options;

    if (Array.isArray(value)) {
        options = value.map((option, index) => {
            if (!option || typeof option !== 'object' || Array.isArray(option))
                throw requestError('FIELD_INVALID', {
                    messageParams: { fieldLabel: label },
                });
            return {
                name: readRequiredString(
                    option.name,
                    `${label}[${index}].name`,
                    {
                        maxLength:
                            inputLimits.productVariant.optionNameMaxLength,
                    },
                ),
                value: readRequiredString(
                    option.value,
                    `${label}[${index}].value`,
                    {
                        maxLength:
                            inputLimits.productVariant.optionValueMaxLength,
                    },
                ),
            };
        });
    } else {
        const source = readOptionalString(value, label);

        options = source
            ? source.split(';').map((item, index) => {
                const separatorIndex = item.indexOf(':');

                if (separatorIndex < 1) {
                    throw requestError('FIELD_INVALID', {
                        messageParams: { fieldLabel: label },
                    });
                }

                return {
                    name: readRequiredString(
                        item.slice(0, separatorIndex),
                        `${label}[${index}].name`,
                        {
                            maxLength:
                                inputLimits.productVariant.optionNameMaxLength,
                        },
                    ),
                    value: readRequiredString(
                        item.slice(separatorIndex + 1),
                        `${label}[${index}].value`,
                        {
                            maxLength:
                                inputLimits.productVariant.optionValueMaxLength,
                        },
                    ),
                };
            })
            : [];
    }

    return options;
}

function parseImageFileIndex(value, label) {
    if (value === null || value === undefined)
        return null;

    return readNumber(value, label, {
        integer: true,
        min: 0,
    });
}

function parseProductVariant(variant, index) {
    const label = `variants[${index}]`;
    if (!variant || typeof variant !== 'object' || Array.isArray(variant))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        });
    const variantId = readObjectId(
        variant.variantId,
        `${label}.variantId`,
        { required: false },
    );
    const price = readNumber(variant.price, `${label}.price`, {
        integer: true,
        min: 0,
    });
    const originalPrice = readNumber(
        variant.originalPrice,
        `${label}.originalPrice`,
        { integer: true, min: 0 },
    );
    const imageFileIndex = parseImageFileIndex(
        variant.imageFileIndex,
        `${label}.imageFileIndex`,
    );

    if (!variantId && imageFileIndex === null) {
        throw requestError('PRODUCT_VARIANT_IMAGE_REQUIRED');
    }

    let updatedAt = null;

    if (variantId) {
        const updatedAtValue = readRequiredString(
            variant.updatedAt,
            `${label}.updatedAt`,
            { maxLength: 64 },
        );
        const updatedAtTime = Date.parse(updatedAtValue);

        if (!Number.isFinite(updatedAtTime)) {
            throw requestError('FIELD_INVALID', {
                messageParams: { fieldLabel: `${label}.updatedAt` },
            });
        }

        updatedAt = new Date(updatedAtTime);
    }

    return {
        variantId,
        updatedAt,
        sku: readOptionalString(variant.sku, `${label}.sku`, {
            maxLength: inputLimits.productVariant.skuMaxLength,
        }),
        options: parseVariantOptions(variant.options, `${label}.options`),
        price,
        originalPrice,
        stock: readNumber(variant.stock, `${label}.stock`, {
            integer: true,
            min: 0,
        }),
        imageFileIndex,
        isPublished: readBoolean(
            variant.isPublished,
            `${label}.isPublished`,
            true,
        ),
    };
}

function parseProductSpecifications(value) {
    const specifications = readFormJsonArray(value, 'specifications').map((item, index) => {
        const label = `specifications[${index}]`;

        if (!item || typeof item !== 'object' || Array.isArray(item))
            throw requestError('FIELD_INVALID', {
                messageParams: { fieldLabel: label },
            });

        return {
            attributeId: readObjectId(item.attributeId, `${label}.attributeId`),
            value: readRequiredString(item.value, `${label}.value`, {
                maxLength: inputLimits.adminProduct.specificationValueMaxLength,
            }),
        };
    });

    if (specifications.length > inputLimits.adminProduct.maxSpecifications)
        throw requestError('FIELD_ITEM_COUNT_INVALID', {
            messageParams: { fieldLabel: 'specifications' },
        });

    const attributeIds = specifications.map(specification => specification.attributeId);
    if (new Set(attributeIds).size !== attributeIds.length)
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: 'specifications' },
        });

    return specifications;
}

function parseProductInput(rawBody, files = {}) {
    const body = readObjectBody(rawBody);
    const productImageFiles = Array.isArray(files)
        ? files
        : (files?.productImages || []);
    const variantImageFiles = Array.isArray(files)
        ? []
        : (files?.variantImages || []);

    const retainedImagePublicIds = readFormJsonArray(
        body.retainedImagePublicIds,
        'retainedImagePublicIds',
    ).map((key, index) => readRequiredString(
        key,
        `retainedImagePublicIds[${index}]`,
    ));
    const rawVariants = readFormJsonArray(body.variants, 'variants', {
        required: true,
    });
    if (!rawVariants.length)
        throw requestError('PRODUCT_REQUIRES_VARIANT');
    if (rawVariants.length > inputLimits.adminProduct.maxVariants) {
        throw requestError('PRODUCT_VARIANT_LIMIT_REACHED', {
            messageParams: { limit: inputLimits.adminProduct.maxVariants },
        });
    }

    const parsedVariants = rawVariants.map(parseProductVariant);
    const claimedIndexes = new Set();

    for (const variant of parsedVariants) {
        const fileIndex = variant.imageFileIndex;

        if (fileIndex === null)
            continue;

        if (fileIndex >= variantImageFiles.length) {
            throw requestError('PRODUCT_VARIANT_IMAGE_NOT_FOUND');
        }

        if (claimedIndexes.has(fileIndex)) {
            throw requestError('PRODUCT_VARIANT_IMAGE_DUPLICATED');
        }

        claimedIndexes.add(fileIndex);
    }

    if (claimedIndexes.size !== variantImageFiles.length) {
        throw requestError('PRODUCT_VARIANT_IMAGE_UNASSIGNED');
    }

    if (retainedImagePublicIds.length + productImageFiles.length > uploadLimits.product.maxFiles)
        throw requestError('PRODUCT_IMAGE_LIMIT_REACHED');

    return {
        name: readRequiredString(body.name, 'name', {
            maxLength: inputLimits.product.nameMaxLength,
        }),
        description: readOptionalString(body.description, 'description', {
            maxLength: inputLimits.product.descriptionMaxLength,
        }),
        brand: readOptionalString(body.brand, 'brand', {
            maxLength: inputLimits.product.brandMaxLength,
        }),
        categoryId: readObjectId(body.categoryId, 'categoryId'),
        isPublished: readFormBoolean(body.isPublished, 'isPublished', false),
        specifications: parseProductSpecifications(body.specifications),
        retainedImagePublicIds: [...new Set(retainedImagePublicIds)],
        productImageFiles,
        variantImageFiles,
        variants: parsedVariants,
    };
}

function parseProductBulkActionInput(rawBody) {
    const body = readObjectBody(rawBody);
    return {
        productIds: readObjectIdArray(body.productIds, 'productIds', {
            maxItems: inputLimits.adminProduct.bulkActionMaxItems,
        }),
        action: (() => {
            const action = readRequiredString(body.action, 'action');
            if (!['REFRESH_RATING', 'PUBLISH', 'UNPUBLISH'].includes(action))
                throw requestError('PRODUCT_ACTION_INVALID');
            return action;
        })(),
    };
}

export {
    parseAdminProductQuery,
    parseProductBulkActionInput,
    parseProductInput,
};
