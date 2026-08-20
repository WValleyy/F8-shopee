import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
    afterAll as after,
    beforeAll as before,
    describe,
    it,
    vi,
} from 'vitest';

import mongoose from 'mongoose';

import {
    deleteAdminProduct,
} from '../../services/admin/catalog/admin-product.service.js';
import Cart from '../../models/commerce/cart.model.js';
import Category from '../../models/catalog/category.model.js';
import Order from '../../models/commerce/order.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import Product from '../../models/catalog/product.model.js';
import User from '../../models/user/user.model.js';
import WishList from '../../models/user/wish-list.model.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

vi.mock('../../services/image/cloudinary-client.js', () => ({
    default: {
        uploader: {
            destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
        },
    },
}));

describe('admin product hard delete integration', { concurrency: false }, () => {
    const suffix = crypto.randomUUID().slice(0, 10);
    const prefix = `test-product-delete-${suffix}`;
    const fixtureIds = {
        categories: [],
        products: [],
        users: [],
        orders: [],
    };

    before(connectTestDatabase);

    after(async () => {
        if (mongoose.connection.readyState === 1) {
            await Order.deleteMany({ _id: { $in: fixtureIds.orders } });
            await WishList.deleteMany({ user: { $in: fixtureIds.users } });
            await Cart.deleteMany({ user: { $in: fixtureIds.users } });
            await ProductVariant.deleteMany({ product: { $in: fixtureIds.products } });
            await Product.deleteMany({ _id: { $in: fixtureIds.products } });
            await Category.deleteMany({ _id: { $in: fixtureIds.categories } });
            await User.deleteMany({ _id: { $in: fixtureIds.users } });
            await disconnectTestDatabase();
        }
    });

    it('hard-deletes product, variants, and wishlist when product has no order history', async () => {
        const category = await Category.create({
            name: `${prefix}-clean-cat`,
            slug: `${prefix}-clean-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-clean-product`,
            slug: `${prefix}-clean-product`,
            category: category._id,
            images: [{ url: 'https://example.com/clean1.jpg', publicId: 'products/clean1' }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-clean-variant`,
            price: 100000,
            originalPrice: 120000,
            stock: 10,
            image: {
                url: 'https://example.com/variant1.jpg',
                publicId: 'products/variants/variant1',
            },
            isPublished: true,
        });
        const user = await User.create({
            userName: `clean-user-${suffix}`,
            name: 'Clean Delete User',
            email: `clean-${suffix}@example.com`,
            passwordHash: 'test-hash',
        });

        await Cart.create({
            user: user._id,
            items: [{ variant: variant._id, quantity: 1 }],
        });
        await WishList.create({ user: user._id, product: product._id });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);
        fixtureIds.users.push(user._id);

        await deleteAdminProduct(product._id);

        const [storedProduct, storedVariant, storedWishlist, storedCart] = await Promise.all([
            Product.findById(product._id),
            ProductVariant.findById(variant._id),
            WishList.findOne({ user: user._id, product: product._id }),
            Cart.findOne({ user: user._id }).lean(),
        ]);

        assert.equal(storedProduct, null);
        assert.equal(storedVariant, null);
        assert.equal(storedWishlist, null);
        assert.equal(storedCart.items.length, 1);
    });

    it('rejects hard delete with PRODUCT_HAS_ORDERS when product has order history', async () => {
        const category = await Category.create({
            name: `${prefix}-ordered-cat`,
            slug: `${prefix}-ordered-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-ordered-product`,
            slug: `${prefix}-ordered-product`,
            category: category._id,
            images: [{ url: 'https://example.com/ordered.jpg', publicId: 'products/ordered' }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-ordered-variant`,
            price: 150000,
            originalPrice: 150000,
            stock: 5,
            image: {
                url: 'https://example.com/variant-ordered.jpg',
                publicId: 'products/variants/variant-ordered',
            },
            isPublished: true,
        });
        const user = await User.create({
            userName: `ordered-user-${suffix}`,
            name: 'Ordered User',
            email: `ordered-${suffix}@example.com`,
            passwordHash: 'test-hash',
        });

        const order = await Order.create({
            user: user._id,
            items: [{
                product: product._id,
                variant: variant._id,
                productName: product.name,
                image: variant.image.url,
                price: variant.price,
                quantity: 1,
            }],
            shippingAddress: {
                fullName: 'Test User',
                phone: '0901234567',
                province: 'Hà Nội',
                ward: 'Dịch Vọng',
                detail: '123 Test Street',
            },
            totalAmount: 150000,
        });

        await WishList.create({ user: user._id, product: product._id });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);
        fixtureIds.users.push(user._id);
        fixtureIds.orders.push(order._id);

        await assert.rejects(
            deleteAdminProduct(product._id),
            error => error?.code === 'PRODUCT_HAS_ORDERS',
        );

        const [storedProduct, storedVariant, storedWishlist] = await Promise.all([
            Product.findById(product._id),
            ProductVariant.findById(variant._id),
            WishList.findOne({ user: user._id, product: product._id }),
        ]);

        assert.notEqual(storedProduct, null);
        assert.notEqual(storedVariant, null);
        assert.notEqual(storedWishlist, null);
    });

    it('rejects deletion of a non-existent product with PRODUCT_NOT_FOUND', async () => {
        const fakeProductId = new mongoose.Types.ObjectId();

        await assert.rejects(
            deleteAdminProduct(fakeProductId),
            error => error?.code === 'PRODUCT_NOT_FOUND',
        );
    });

    it('retains all DB records when deletion transaction encounters a DB error', async () => {
        const category = await Category.create({
            name: `${prefix}-rollback-cat`,
            slug: `${prefix}-rollback-cat`,
        });
        const product = await Product.create({
            name: `${prefix}-rollback-prod`,
            slug: `${prefix}-rollback-prod`,
            category: category._id,
            images: [{ url: 'https://example.com/rb.jpg', publicId: 'products/rb' }],
        });
        const variant = await ProductVariant.create({
            product: product._id,
            sku: `${prefix}-rb-variant`,
            price: 100000,
            originalPrice: 100000,
            stock: 5,
            image: {
                url: 'https://example.com/v-rb.jpg',
                publicId: 'products/variants/v-rb',
            },
            isPublished: true,
        });
        const user = await User.create({
            userName: `rb-user-${suffix}`,
            name: 'Rollback User',
            email: `rb-${suffix}@example.com`,
            passwordHash: 'test-hash',
        });

        await WishList.create({ user: user._id, product: product._id });

        fixtureIds.categories.push(category._id);
        fixtureIds.products.push(product._id);
        fixtureIds.users.push(user._id);

        const deleteSpy = vi
            .spyOn(Product, 'deleteOne')
            .mockRejectedValue(new Error('Forced MongoDB delete error'));

        try {
            await assert.rejects(
                deleteAdminProduct(product._id),
                /Forced MongoDB delete error/,
            );
        } finally {
            deleteSpy.mockRestore();
        }

        const [storedProduct, storedVariant, storedWishlist] = await Promise.all([
            Product.findById(product._id),
            ProductVariant.findById(variant._id),
            WishList.findOne({ user: user._id, product: product._id }),
        ]);

        assert.notEqual(storedProduct, null);
        assert.notEqual(storedVariant, null);
        assert.notEqual(storedWishlist, null);
    });

});
