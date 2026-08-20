import { describe, expect, it } from 'vitest';
import inputLimits from '../../../config/input-limits.js';
import { parseProductInput } from '../../../controllers/requests-parser/admin/product.request.js';

const VARIANT_UPDATED_AT = '2026-08-11T00:00:00.000Z';

function expectRequestError(callback, code) {
    let thrownError = null;

    try {
        callback();
    } catch (error) {
        thrownError = error;
    }

    expect(thrownError).toMatchObject({ code });
}

// Admin product input parsing validates and normalizes request payloads.
describe('parseProductInput', () => {
    const validBody = {
        name: 'Test Product',
        description: 'Description',
        brand: 'Brand',
        categoryId: '507f1f77bcf86cd799439011',
        isPublished: 'true',
        retainedImagePublicIds: '["key-1"]',
        variants: JSON.stringify([
            {
                variantId: '507f1f77bcf86cd799439012',
                updatedAt: VARIANT_UPDATED_AT,
                sku: 'SKU-1',
                options: 'Color: Red',
                price: 100000,
                originalPrice: 120000,
                stock: 10,
                imageFileIndex: null,
                isPublished: true,
            },
        ]),
    };

    it('parses valid input with existing variant keeping image', () => {
        const result = parseProductInput(validBody);

        expect(result.name).toBe('Test Product');
        expect(result.variants[0].imageFileIndex).toBeNull();
        expect(result.variants[0].updatedAt).toEqual(
            new Date(VARIANT_UPDATED_AT),
        );
    });

    it('defaults a product to draft when publication is omitted', () => {
        const { isPublished, ...body } = validBody;
        const result = parseProductInput(body);

        expect(result.isPublished).toBe(false);
    });

    it.each([
        ['name', inputLimits.product.nameMaxLength],
        ['description', inputLimits.product.descriptionMaxLength],
        ['brand', inputLimits.product.brandMaxLength],
    ])('rejects an oversized product %s', (field, maxLength) => {
        expectRequestError(
            () => parseProductInput({
                ...validBody,
                [field]: 'x'.repeat(maxLength + 1),
            }),
            'FIELD_LENGTH_INVALID',
        );
    });

    it('rejects an oversized variant SKU', () => {
        expectRequestError(
            () => parseProductInput({
                ...validBody,
                variants: JSON.stringify([{
                    ...JSON.parse(validBody.variants)[0],
                    sku: 'x'.repeat(
                        inputLimits.productVariant.skuMaxLength + 1,
                    ),
                }]),
            }),
            'FIELD_LENGTH_INVALID',
        );
    });

    it.each([
        ['name', inputLimits.productVariant.optionNameMaxLength],
        ['value', inputLimits.productVariant.optionValueMaxLength],
    ])('rejects an oversized option %s', (field, maxLength) => {
        const option = {
            name: 'Color',
            value: 'Red',
            [field]: 'x'.repeat(maxLength + 1),
        };

        expectRequestError(
            () => parseProductInput({
                ...validBody,
                variants: JSON.stringify([{
                    ...JSON.parse(validBody.variants)[0],
                    options: [option],
                }]),
            }),
            'FIELD_LENGTH_INVALID',
        );
    });

    it('parses valid input with variant assigning uploaded file index', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([
                {
                    sku: 'NEW-SKU',
                    options: 'Color: Blue',
                    price: 150000,
                    originalPrice: 150000,
                    stock: 5,
                    imageFileIndex: 0,
                    isPublished: true,
                },
            ]),
        };
        const files = {
            productImages: [],
            variantImages: [{ originalname: 'var1.jpg', size: 100 }],
        };

        const result = parseProductInput(body, files);

        expect(result.variants[0].imageFileIndex).toBe(0);
    });

    it('throws error when new variant does not specify image file index', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([
                {
                    sku: 'NEW-SKU',
                    options: 'Color: Blue',
                    price: 150000,
                    originalPrice: 150000,
                    stock: 5,
                    imageFileIndex: null,
                    isPublished: true,
                },
            ]),
        };

        expectRequestError(
            () => parseProductInput(body),
            'PRODUCT_VARIANT_IMAGE_REQUIRED',
        );
    });

    it('throws error when variant image file index is out of bounds', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([
                {
                    sku: 'NEW-SKU',
                    options: 'Color: Blue',
                    price: 150000,
                    originalPrice: 150000,
                    stock: 5,
                    imageFileIndex: 2,
                    isPublished: true,
                },
            ]),
        };
        const files = {
            productImages: [],
            variantImages: [{ originalname: 'var1.jpg', size: 100 }],
        };

        expectRequestError(
            () => parseProductInput(body, files),
            'PRODUCT_VARIANT_IMAGE_NOT_FOUND',
        );
    });

    it('throws error when two variants claim the same variant image file index', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([
                {
                    variantId: '507f1f77bcf86cd799439012',
                    updatedAt: VARIANT_UPDATED_AT,
                    sku: 'SKU-1',
                    options: 'Color: Red',
                    price: 100000,
                    originalPrice: 120000,
                    stock: 10,
                    imageFileIndex: 0,
                    isPublished: true,
                },
                {
                    sku: 'SKU-2',
                    options: 'Color: Blue',
                    price: 100000,
                    originalPrice: 120000,
                    stock: 10,
                    imageFileIndex: 0,
                    isPublished: true,
                },
            ]),
        };
        const files = {
            productImages: [],
            variantImages: [{ originalname: 'var1.jpg', size: 100 }],
        };

        expectRequestError(
            () => parseProductInput(body, files),
            'PRODUCT_VARIANT_IMAGE_DUPLICATED',
        );
    });

    it('throws error when variant image file index is negative', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([
                {
                    sku: 'NEW-SKU',
                    options: 'Color: Blue',
                    price: 150000,
                    originalPrice: 150000,
                    stock: 5,
                    imageFileIndex: -1,
                    isPublished: true,
                },
            ]),
        };
        const files = {
            productImages: [],
            variantImages: [{ originalname: 'var1.jpg', size: 100 }],
        };

        expectRequestError(
            () => parseProductInput(body, files),
            'FIELD_OUT_OF_RANGE',
        );
    });

    it('throws error when an uploaded variant image is unassigned', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([
                {
                    variantId: '507f1f77bcf86cd799439012',
                    updatedAt: VARIANT_UPDATED_AT,
                    sku: 'SKU-1',
                    options: 'Color: Red',
                    price: 100000,
                    originalPrice: 120000,
                    stock: 10,
                    imageFileIndex: null,
                    isPublished: true,
                },
            ]),
        };
        const files = {
            productImages: [],
            variantImages: [{ originalname: 'unassigned.jpg', size: 100 }],
        };

        expectRequestError(
            () => parseProductInput(body, files),
            'PRODUCT_VARIANT_IMAGE_UNASSIGNED',
        );
    });

    it('throws error when variants array exceeds maxVariants limit', () => {
        const limit = inputLimits.adminProduct.maxVariants;
        const body = {
            ...validBody,
            variants: JSON.stringify(
                Array.from({ length: limit + 1 }, (_, index) => ({
                    variantId: `507f1f77bcf86cd7994390${(10 + index).toString(16)}`,
                    updatedAt: VARIANT_UPDATED_AT,
                    sku: `SKU-${index}`,
                    options: 'Color: Red',
                    price: 100000,
                    originalPrice: 120000,
                    stock: 10,
                    imageFileIndex: null,
                    isPublished: true,
                })),
            ),
        };

        expectRequestError(
            () => parseProductInput(body),
            'PRODUCT_VARIANT_LIMIT_REACHED',
        );
    });

    it('requires a concurrency token for an existing variant', () => {
        const body = {
            ...validBody,
            variants: JSON.stringify([{
                variantId: '507f1f77bcf86cd799439012',
                sku: 'SKU-1',
                options: 'Color: Red',
                price: 100000,
                originalPrice: 120000,
                stock: 10,
                imageFileIndex: null,
                isPublished: true,
            }]),
        };

        expectRequestError(
            () => parseProductInput(body),
            'FIELD_REQUIRED',
        );
    });
});
