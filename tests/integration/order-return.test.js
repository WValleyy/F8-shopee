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

import Category from '../../models/catalog/category.model.js';
import Order from '../../models/commerce/order.model.js';
import OrderReturnRequest from '../../models/commerce/order-return-request.model.js';
import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import User from '../../models/user/user.model.js';
import { createOrderReturnRequest } from '../../services/commerce/order/order-return.service.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

describe('order return integration', { concurrency: false }, () => {
    const fixtureIds = {
        categories: [],
        orders: [],
        products: [],
        users: [],
    };

    before(connectTestDatabase);

    after(async () => {
        if (mongoose.connection.readyState !== 1)
            return;

        await OrderReturnRequest.deleteMany({ order: { $in: fixtureIds.orders } });
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
            name: `Return category ${fixtureSuffix}`,
            slug: `return-category-${fixtureSuffix}`,
            isActive: true,
        });
        fixtureIds.categories.push(category._id);

        const product = await Product.create({
            name: `Return product ${fixtureSuffix}`,
            slug: `return-product-${fixtureSuffix}`,
            category: category._id,
            images: [{
                url: 'https://example.com/return.jpg',
                publicId: `test/products/${fixtureSuffix}`,
            }],
            isPublished: true,
            sold: 2,
        });
        fixtureIds.products.push(product._id);

        const variant = await ProductVariant.create({
            product: product._id,
            sku: `RETURN-${fixtureSuffix}`,
            price: 100000,
            originalPrice: 100000,
            stock: 0,
            image: {
                url: 'https://example.com/return.jpg',
                publicId: `test/variants/${fixtureSuffix}`,
            },
            isPublished: true,
        });
        const user = await User.create({
            userName: `return-user-${fixtureSuffix}`,
            name: 'Return Test User',
            email: `return-${fixtureSuffix}@example.com`,
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
                fullName: 'Return Test User',
                phone: '0901234567',
                province: 'Test Province',
                ward: 'Test Ward',
                detail: '123 Test Street',
            },
            totalAmount: 200000,
            status: 'COMPLETED',
            completedAt: new Date(),
        });

        fixtureIds.orders.push(order._id);

        return { order, product, user, variant };
    }

    function returnData(variantId, quantity = 1) {
        return {
            items: [{ variantId: variantId.toString(), quantity }],
        };
    }

    it('restores inventory and records returned quantity on a successful return', async () => {
        const fixture = await createFixture();

        await createOrderReturnRequest(
            fixture.user._id,
            fixture.order._id,
            returnData(fixture.variant._id),
        );

        const [request, order, product, variant] = await Promise.all([
            OrderReturnRequest.findOne({ order: fixture.order._id }),
            Order.findById(fixture.order._id),
            Product.findById(fixture.product._id),
            ProductVariant.findById(fixture.variant._id),
        ]);

        assert.ok(request);
        assert.equal(request.amount, 100000);
        assert.equal(order.items[0].returnedQuantity, 1);
        assert.equal(product.sold, 1);
        assert.equal(variant.stock, 1);
    });

    it('rolls back the return when inventory restoration fails', async () => {
        const fixture = await createFixture();
        const updateSpy = vi
            .spyOn(ProductVariant, 'updateOne')
            .mockResolvedValue({ matchedCount: 0 });

        try {
            await assert.rejects(
                () => createOrderReturnRequest(
                    fixture.user._id,
                    fixture.order._id,
                    returnData(fixture.variant._id),
                ),
                error => error?.code === 'RETURN_INVENTORY_RESTORE_FAILED',
            );
        } finally {
            updateSpy.mockRestore();
        }

        const [request, order, product, variant] = await Promise.all([
            OrderReturnRequest.findOne({ order: fixture.order._id }),
            Order.findById(fixture.order._id),
            Product.findById(fixture.product._id),
            ProductVariant.findById(fixture.variant._id),
        ]);

        assert.equal(request, null);
        assert.equal(order.items[0].returnedQuantity, 0);
        assert.equal(product.sold, 2);
        assert.equal(variant.stock, 0);
    });
});
