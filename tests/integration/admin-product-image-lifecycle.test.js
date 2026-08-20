import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
    afterAll as after,
    beforeEach,
    beforeAll as before,
    describe,
    it,
    vi,
} from 'vitest';

import mongoose from 'mongoose';

import {
    getAdminProduct,
    saveAdminProduct,
} from '../../services/admin/catalog/admin-product.service.js';
import Category from '../../models/catalog/category.model.js';
import Order from '../../models/commerce/order.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import Product from '../../models/catalog/product.model.js';
import User from '../../models/user/user.model.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';
import cloudinary from '../../services/image/cloudinary-client.js';
import { logAppEvent } from '../../utils/error/app-error-logger.js';

vi.mock('../../services/image/cloudinary-client.js', () => ({
    default: {
        url: vi.fn(publicId => `https://res.cloudinary.com/test/image/upload/${publicId}`),
        uploader: {
            destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
            upload_stream: vi.fn(),
        },
    },
}));

vi.mock('../../utils/error/app-error-logger.js', () => ({
    logAppEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('admin product image lifecycle & transaction boundary integration', { concurrency: false }, () => {
    const suffix = crypto.randomUUID().slice(0, 10);
    const prefix = `test-lifecycle-${suffix}`;
    const fixtureIds = {
        categories: [],
        products: [],
        users: [],
        orders: [],
    };

    before(connectTestDatabase);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    after(async () => {
        if (mongoose.connection.readyState === 1) {
            await Order.deleteMany({ _id: { $in: fixtureIds.orders } });
            await ProductVariant.deleteMany({ product: { $in: fixtureIds.products } });
            await Product.deleteMany({ _id: { $in: fixtureIds.products } });
            await Category.deleteMany({ _id: { $in: fixtureIds.categories } });
            await User.deleteMany({ _id: { $in: fixtureIds.users } });
            await disconnectTestDatabase();
        }
    });

    it('retains existing variant image and publicId when imageFileIndex is null', async () => {
        const category = await Category.create({
            name: `${prefix}-retain-var-cat`,
            slug: `${prefix}-retain-var-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-retain-var-product`,
            slug: `${prefix}-retain-var-product`,
            category: category._id,
            images: [{ url: 'https://example.com/retain.jpg', publicId: 'products/retain' }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-retain-sku`,
            price: 100000,
            originalPrice: 120000,
            stock: 10,
            image: {
                url: 'https://example.com/variant-retained.jpg',
                publicId: 'products/variants/variant-retained',
            },
            isPublished: true,
        });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);

        await saveAdminProduct(product._id, {
            name: product.name,
            description: 'Retained image test',
            brand: 'F8',
            categoryId: category.id,
            isPublished: true,
            retainedImagePublicIds: [product.images[0].publicId],
            productImageFiles: [],
            variantImageFiles: [],
            variants: [{
                variantId: variant.id,
                sku: variant.sku,
                options: [{ name: 'Size', value: 'M' }],
                updatedAt: variant.updatedAt,
                price: 110000,
                originalPrice: 130000,
                stock: 15,
                imageFileIndex: null,
                isPublished: true,
            }],
        });

        const updatedVariant = await ProductVariant.findById(variant._id).lean();

        assert.equal(updatedVariant.image.url, 'https://example.com/variant-retained.jpg');
        assert.equal(updatedVariant.image.publicId, 'products/variants/variant-retained');
        assert.equal(updatedVariant.stock, 15);
    });

    it('rejects stale variant stock after inventory is reserved', async () => {
        const category = await Category.create({
            name: `${prefix}-stock-conflict-cat`,
            slug: `${prefix}-stock-conflict-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-stock-conflict-product`,
            slug: `${prefix}-stock-conflict-product`,
            category: category._id,
            images: [{
                url: 'https://example.com/stock-conflict.jpg',
                publicId: 'products/stock-conflict',
            }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-stock-conflict-sku`,
            price: 100000,
            originalPrice: 100000,
            stock: 10,
            image: {
                url: 'https://example.com/stock-conflict-variant.jpg',
                publicId: 'products/variants/stock-conflict',
            },
            isPublished: true,
        });
        const editorState = await getAdminProduct(product._id);
        const editorVariant = editorState.variants[0];

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);

        await new Promise(resolve => setTimeout(resolve, 5));
        await ProductVariant.updateOne(
            { _id: variant._id, stock: { $gte: 1 } },
            { $inc: { stock: -1 } },
        );

        await assert.rejects(
            () => saveAdminProduct(product._id, {
                name: `${product.name}-stale-edit`,
                description: '',
                brand: '',
                categoryId: category.id,
                isPublished: true,
                retainedImagePublicIds: [product.images[0].publicId],
                productImageFiles: [],
                variantImageFiles: [],
                variants: [{
                    variantId: editorVariant.id,
                    updatedAt: editorVariant.updatedAt,
                    sku: editorVariant.sku,
                    options: editorVariant.options,
                    price: editorVariant.price,
                    originalPrice: editorVariant.originalPrice,
                    stock: editorVariant.stock,
                    imageFileIndex: null,
                    isPublished: editorVariant.isPublished,
                }],
            }),
            error => error?.code === 'PRODUCT_EDIT_CONFLICT',
        );

        const [storedProduct, storedVariant] = await Promise.all([
            Product.findById(product._id).lean(),
            ProductVariant.findById(variant._id).lean(),
        ]);

        assert.equal(storedProduct.name, product.name);
        assert.equal(storedVariant.stock, 9);
    });

    it('blocks variant deletion in the transaction when variant has order history', async () => {
        const category = await Category.create({
            name: `${prefix}-order-conflict-cat`,
            slug: `${prefix}-order-conflict-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-order-conflict-prod`,
            slug: `${prefix}-order-conflict-prod`,
            category: category._id,
            images: [{ url: 'https://example.com/orig.jpg', publicId: 'products/orig' }],
        });
        const [v1, v2] = await ProductVariant.create([
            {
                product: product._id,
                sku: `${prefix}-v1-free`,
                price: 100000,
                originalPrice: 100000,
                stock: 10,
                image: {
                    url: 'https://example.com/v1.jpg',
                    publicId: 'products/variants/v1',
                },
                isPublished: true,
            },
            {
                product: product._id,
                sku: `${prefix}-v2-ordered`,
                price: 200000,
                originalPrice: 200000,
                stock: 10,
                image: {
                    url: 'https://example.com/v2.jpg',
                    publicId: 'products/variants/v2',
                },
                isPublished: true,
            },
        ]);
        const user = await User.create({
            userName: `conflict-user-${suffix}`,
            name: 'Conflict User',
            email: `conflict-${suffix}@example.com`,
            passwordHash: 'test-hash',
        });

        const order = await Order.create({
            user: user._id,
            items: [{
                product: product._id,
                variant: v2._id,
                productName: product.name,
                image: v2.image,
                price: v2.price,
                quantity: 1,
            }],
            shippingAddress: {
                fullName: 'Test User',
                phone: '0901234567',
                province: 'Hà Nội',
                ward: 'Dịch Vọng',
                detail: '123 Test Street',
            },
            totalAmount: 200000,
        });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);
        fixtureIds.users.push(user._id);
        fixtureIds.orders.push(order._id);

        // Attempt save that omits v2 (trying to delete v2 which has an order)
        await assert.rejects(
            () => saveAdminProduct(product._id, {
                name: `${prefix}-order-conflict-prod-updated`,
                description: '',
                brand: '',
                categoryId: category.id,
                isPublished: true,
                retainedImagePublicIds: [product.images[0].publicId],
                productImageFiles: [],
                variantImageFiles: [],
                variants: [{
                    variantId: v1.id,
                    sku: v1.sku,
                    options: [],
                    updatedAt: v1.updatedAt,
                    price: 150000,
                    originalPrice: 150000,
                    stock: 20,
                    imageFileIndex: null,
                    isPublished: true,
                }],
            }),
            error => (
                error?.code === 'PRODUCT_VARIANT_HAS_ORDERS'
                && error.meta?.variantIds?.includes(v2.id)
            ),
        );

        const [storedProduct, storedV1, storedV2] = await Promise.all([
            Product.findById(product._id).lean(),
            ProductVariant.findById(v1._id).lean(),
            ProductVariant.findById(v2._id).lean(),
        ]);

        // Pre-check: Product name and v1 stock should not have been updated.
        assert.equal(storedProduct.name, `${prefix}-order-conflict-prod`);
        assert.equal(storedV1.stock, 10);
        assert.notEqual(storedV2, null);
    });

    it('hard-deletes an omitted variant when it has no order history', async () => {
        const category = await Category.create({
            name: `${prefix}-omit-var-cat`,
            slug: `${prefix}-omit-var-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-omit-var-prod`,
            slug: `${prefix}-omit-var-prod`,
            category: category._id,
            images: [{ url: 'https://example.com/omit.jpg', publicId: 'products/omit' }],
        });
        const [v1, v2] = await ProductVariant.create([
            {
                product: product._id,
                sku: `${prefix}-v1-keep`,
                price: 100000,
                originalPrice: 100000,
                stock: 10,
                image: {
                    url: 'https://example.com/v1-keep.jpg',
                    publicId: 'products/variants/v1-keep',
                },
                isPublished: true,
            },
            {
                product: product._id,
                sku: `${prefix}-v2-delete`,
                price: 200000,
                originalPrice: 200000,
                stock: 10,
                image: {
                    url: 'https://example.com/v2-delete.jpg',
                    publicId: 'products/variants/v2-delete',
                },
                isPublished: true,
            },
        ]);

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);

        await saveAdminProduct(product._id, {
            name: product.name,
            description: '',
            brand: '',
            categoryId: category.id,
            isPublished: true,
            retainedImagePublicIds: [product.images[0].publicId],
            productImageFiles: [],
            variantImageFiles: [],
            variants: [{
                variantId: v1.id,
                sku: v1.sku,
                options: [],
                updatedAt: v1.updatedAt,
                price: v1.price,
                originalPrice: v1.originalPrice,
                stock: v1.stock,
                imageFileIndex: null,
                isPublished: true,
            }],
        });

        assert.equal(await ProductVariant.findById(v1._id).then(doc => Boolean(doc)), true);
        assert.equal(await ProductVariant.findById(v2._id).then(doc => Boolean(doc)), false);
    });

    it('keeps the committed product update when a post-commit image upload fails', async () => {
        const category = await Category.create({
            name: `${prefix}-upload-fail-cat`,
            slug: `${prefix}-upload-fail-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-upload-fail-prod`,
            slug: `${prefix}-upload-fail-prod`,
            category: category._id,
            images: [{
                url: 'https://example.com/upload-fail-old.jpg',
                publicId: 'products/upload-fail-old',
            }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-upload-fail-sku`,
            price: 100000,
            originalPrice: 100000,
            stock: 5,
            image: {
                url: 'https://example.com/upload-fail-variant.jpg',
                publicId: 'products/variants/upload-fail',
            },
            isPublished: true,
        });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);
        cloudinary.uploader.upload_stream.mockImplementationOnce((options, callback) => {
            callback(new Error('Cloudinary upload unavailable'));
            return { end: vi.fn() };
        });

        await saveAdminProduct(product._id, {
            name: `${prefix}-upload-fail-prod-updated`,
            description: '',
            brand: '',
            categoryId: category.id,
            isPublished: true,
            retainedImagePublicIds: [],
            productImageFiles: [{
                buffer: Buffer.from('valid-image-buffer'),
                mimetype: 'image/jpeg',
            }],
            variantImageFiles: [],
            variants: [{
                variantId: variant.id,
                updatedAt: variant.updatedAt,
                sku: variant.sku,
                options: [],
                price: variant.price,
                originalPrice: variant.originalPrice,
                stock: variant.stock,
                imageFileIndex: null,
                isPublished: true,
            }],
        });
        const updatedProduct = await Product.findById(product._id).lean();

        assert.equal(updatedProduct.name, `${prefix}-upload-fail-prod-updated`);
        assert.match(
            updatedProduct.images[0].publicId,
            new RegExp(`^f8-shopee/products/${product.id}/[0-9a-f-]{36}$`),
        );
        assert.equal(
            updatedProduct.images[0].url,
            `https://res.cloudinary.com/test/image/upload/${updatedProduct.images[0].publicId}`,
        );
        assert.equal(cloudinary.uploader.upload_stream.mock.calls.length, 1);
        assert.equal(logAppEvent.mock.calls[0][0], 'cloudinary-image-upload-failed');
    });

    it('does not upload pending product images when the database transaction fails', async () => {
        const category = await Category.create({
            name: `${prefix}-db-fail-cat`,
            slug: `${prefix}-db-fail-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-db-fail-prod`,
            slug: `${prefix}-db-fail-prod`,
            category: category._id,
            images: [{
                url: 'https://example.com/db-fail-old.jpg',
                publicId: 'products/db-fail-old',
            }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-db-fail-sku`,
            price: 100000,
            originalPrice: 100000,
            stock: 5,
            image: {
                url: 'https://example.com/db-fail-variant.jpg',
                publicId: 'products/variants/db-fail',
            },
            isPublished: true,
        });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);

        await assert.rejects(() => saveAdminProduct(product._id, {
            name: '',
            description: '',
            brand: '',
            categoryId: category.id,
            isPublished: true,
            retainedImagePublicIds: [],
            productImageFiles: [{
                buffer: Buffer.from('valid-image-buffer'),
                mimetype: 'image/jpeg',
            }],
            variantImageFiles: [],
            variants: [{
                variantId: variant.id,
                updatedAt: variant.updatedAt,
                sku: variant.sku,
                options: [],
                price: variant.price,
                originalPrice: variant.originalPrice,
                stock: variant.stock,
                imageFileIndex: null,
                isPublished: true,
            }],
        }));

        const storedProduct = await Product.findById(product._id).lean();

        assert.equal(storedProduct.name, `${prefix}-db-fail-prod`);
        assert.equal(cloudinary.uploader.upload_stream.mock.calls.length, 0);
    });
});
