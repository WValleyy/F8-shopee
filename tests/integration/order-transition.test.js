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

const notificationMocks = vi.hoisted(() => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/user/notification.service.js', () => notificationMocks);

import Category from '../../models/catalog/category.model.js';
import Order from '../../models/commerce/order.model.js';
import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import User from '../../models/user/user.model.js';
import { transitionOrderStatus } from '../../services/commerce/order/order-transition.service.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

describe('order transition integration', { concurrency: false }, () => {
    const fixtureIds = {
        categories: [],
        orders: [],
        products: [],
        users: [],
    };

    before(connectTestDatabase);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    after(async () => {
        if (mongoose.connection.readyState !== 1)
            return;

        await Order.deleteMany({ _id: { $in: fixtureIds.orders } });
        await ProductVariant.deleteMany({ product: { $in: fixtureIds.products } });
        await Product.deleteMany({ _id: { $in: fixtureIds.products } });
        await Category.deleteMany({ _id: { $in: fixtureIds.categories } });
        await User.deleteMany({ _id: { $in: fixtureIds.users } });
        await disconnectTestDatabase();
    });

    async function createFixture() {
        const fixtureSuffix = crypto.randomUUID().slice(0, 8);
        const category = await Category.create({
            name: `Transition category ${fixtureSuffix}`,
            slug: `transition-category-${fixtureSuffix}`,
            isActive: true,
        });
        fixtureIds.categories.push(category._id);

        const product = await Product.create({
            name: `Transition product ${fixtureSuffix}`,
            slug: `transition-product-${fixtureSuffix}`,
            category: category._id,
            images: [{
                url: 'https://example.com/transition.jpg',
                publicId: `test/products/${fixtureSuffix}`,
            }],
            isPublished: true,
            sold: 2,
        });
        fixtureIds.products.push(product._id);

        const variant = await ProductVariant.create({
            product: product._id,
            sku: `TRANSITION-${fixtureSuffix}`,
            price: 100000,
            originalPrice: 100000,
            stock: 0,
            image: {
                url: 'https://example.com/transition.jpg',
                publicId: `test/variants/${fixtureSuffix}`,
            },
            isPublished: true,
        });
        const user = await User.create({
            userName: `transition-user-${fixtureSuffix}`,
            name: 'Transition Test User',
            email: `transition-${fixtureSuffix}@example.com`,
            passwordHash: 'test-hash',
        });
        fixtureIds.users.push(user._id);
        const order = await Order.create({
            user: user._id,
            items: [{
                product: product._id,
                variant: variant._id,
                productName: product.name,
                image: variant.image.url,
                price: variant.price,
                quantity: 2,
            }],
            shippingAddress: {
                fullName: 'Transition Test User',
                phone: '0901234567',
                province: 'Test Province',
                ward: 'Test Ward',
                detail: '123 Test Street',
            },
            totalAmount: 200000,
            status: 'SHIPPING',
        });

        fixtureIds.orders.push(order._id);

        return { order, product, user, variant };
    }

    it('cancels a shipping order and restores inventory exactly once', async () => {
        const fixture = await createFixture();

        const results = await Promise.allSettled([
            transitionOrderStatus(
                fixture.user._id,
                fixture.order._id,
                'cancel',
            ),
            transitionOrderStatus(
                fixture.user._id,
                fixture.order._id,
                'cancel',
            ),
        ]);
        const fulfilled = results.filter(result => result.status === 'fulfilled');
        const rejected = results.filter(result => result.status === 'rejected');

        assert.equal(fulfilled.length, 1);
        assert.equal(rejected.length, 1);
        assert.equal(rejected[0].reason.code, 'ORDER_STATUS_UPDATE_FAILED');

        const [cancelled, firstProduct, firstVariant] = await Promise.all([
            Order.findById(fixture.order._id),
            Product.findById(fixture.product._id),
            ProductVariant.findById(fixture.variant._id),
        ]);

        assert.equal(cancelled.status, 'CANCELLED');
        assert.ok(cancelled.inventoryRestoredAt);
        assert.equal(firstProduct.sold, 0);
        assert.equal(firstVariant.stock, 2);
    });

    it('completes a shipping order without restoring inventory', async () => {
        const fixture = await createFixture();

        await transitionOrderStatus(
            fixture.user._id,
            fixture.order._id,
            'complete',
        );

        const [order, product, variant] = await Promise.all([
            Order.findById(fixture.order._id),
            Product.findById(fixture.product._id),
            ProductVariant.findById(fixture.variant._id),
        ]);

        assert.equal(order.status, 'COMPLETED');
        assert.ok(order.completedAt);
        assert.equal(order.inventoryRestoredAt, null);
        assert.equal(product.sold, 2);
        assert.equal(variant.stock, 0);
        assert.equal(notificationMocks.createNotification.mock.calls.length, 1);
    });
});
