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
import CheckoutDraft from '../../models/commerce/checkout-draft.model.js';
import Cart from '../../models/commerce/cart.model.js';
import Order from '../../models/commerce/order.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import Product from '../../models/catalog/product.model.js';
import UserAddress from '../../models/user/user-address.model.js';
import User from '../../models/user/user.model.js';
import { placeOrder } from '../../services/commerce/order/order-placement.service.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

describe('order placement integration', { concurrency: false }, () => {
    const fixtureIds = {
        addresses: [],
        carts: [],
        categories: [],
        drafts: [],
        products: [],
        users: [],
    };

    before(connectTestDatabase);

    after(async () => {
        if (mongoose.connection.readyState !== 1)
            return;

        await Order.deleteMany({ user: { $in: fixtureIds.users } });
        await CheckoutDraft.deleteMany({ _id: { $in: fixtureIds.drafts } });
        await Cart.deleteMany({ _id: { $in: fixtureIds.carts } });
        await UserAddress.deleteMany({ _id: { $in: fixtureIds.addresses } });
        await ProductVariant.deleteMany({ product: { $in: fixtureIds.products } });
        await Product.deleteMany({ _id: { $in: fixtureIds.products } });
        await Category.deleteMany({ _id: { $in: fixtureIds.categories } });
        await User.deleteMany({ _id: { $in: fixtureIds.users } });
        await disconnectTestDatabase();
    });

    async function createFixture({ stock = 10, quantity = 2 } = {}) {
        const fixtureSuffix = crypto.randomUUID().slice(0, 8);
        const category = await Category.create({
            name: `Order placement ${fixtureSuffix}`,
            slug: `order-placement-${fixtureSuffix}`,
            isActive: true,
        });
        fixtureIds.categories.push(category._id);

        const product = await Product.create({
            name: `Order placement product ${fixtureSuffix}`,
            slug: `order-placement-product-${fixtureSuffix}`,
            category: category._id,
            images: [{
                url: 'https://example.com/product.jpg',
                publicId: `test/products/${fixtureSuffix}`,
            }],
            isPublished: true,
        });
        fixtureIds.products.push(product._id);

        const variant = await ProductVariant.create({
            product: product._id,
            sku: `ORDER-${fixtureSuffix}`,
            price: 100000,
            originalPrice: 120000,
            stock,
            image: {
                url: 'https://example.com/variant.jpg',
                publicId: `test/variants/${fixtureSuffix}`,
            },
            isPublished: true,
        });
        const user = await User.create({
            userName: `order-user-${fixtureSuffix}`,
            name: 'Order Test User',
            email: `order-${fixtureSuffix}@example.com`,
            passwordHash: 'test-hash',
        });
        fixtureIds.users.push(user._id);

        const address = await UserAddress.create({
            user: user._id,
            fullName: 'Order Test User',
            phone: '0901234567',
            province: 'Hà Nội',
            ward: 'Dịch Vọng',
            detail: '123 Test Street',
            isDefault: true,
        });
        const cart = await Cart.create({
            user: user._id,
            items: [{ variant: variant._id, quantity }],
        });
        const draft = await CheckoutDraft.create({
            user: user._id,
            source: 'cart',
            items: [{ variant: variant._id, quantity, unitPrice: variant.price }],
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        fixtureIds.addresses.push(address._id);
        fixtureIds.carts.push(cart._id);
        fixtureIds.drafts.push(draft._id);
        return { address, cart, draft, product, user, variant };
    }

    it('creates an order and commits inventory/cart/draft changes together', async () => {
        const fixture = await createFixture();

        await placeOrder(fixture.user._id, {
            draftId: fixture.draft._id,
            selectedAddressId: fixture.address._id,
            note: '',
        });

        const [order, variant, product, cart, draft] = await Promise.all([
            Order.findById(fixture.draft._id).lean(),
            ProductVariant.findById(fixture.variant._id).lean(),
            Product.findById(fixture.product._id).lean(),
            Cart.findById(fixture.cart._id).lean(),
            CheckoutDraft.findById(fixture.draft._id).lean(),
        ]);

        assert.equal(order.items.length, 1);
        assert.equal(order.status, 'SHIPPING');
        assert.equal(order.totalAmount, 200000);
        assert.equal(variant.stock, 8);
        assert.equal(product.sold, 2);
        assert.equal(cart.items.length, 0);
        assert.equal(draft, null);
    });

    it('rejects unavailable stock without partial order changes', async () => {
        const fixture = await createFixture({ stock: 1, quantity: 2 });

        await assert.rejects(
            () => placeOrder(fixture.user._id, {
                draftId: fixture.draft._id,
                selectedAddressId: fixture.address._id,
            }),
            error => error?.code === 'CHECKOUT_ITEMS_UNAVAILABLE',
        );

        const [order, variant, product, cart, draft] = await Promise.all([
            Order.findById(fixture.draft._id).lean(),
            ProductVariant.findById(fixture.variant._id).lean(),
            Product.findById(fixture.product._id).lean(),
            Cart.findById(fixture.cart._id).lean(),
            CheckoutDraft.findById(fixture.draft._id).lean(),
        ]);

        assert.equal(order, null);
        assert.equal(variant.stock, 1);
        assert.equal(product.sold, 0);
        assert.equal(cart.items.length, 1);
        assert.ok(draft);
    });

    it('rolls back order, inventory, cart, and draft after a late transaction failure', async () => {
        const fixture = await createFixture();
        const deleteSpy = vi
            .spyOn(CheckoutDraft, 'deleteOne')
            .mockImplementation(() => ({
                session: vi.fn().mockRejectedValue(new Error('Forced draft delete failure')),
            }));

        try {
            await assert.rejects(
                () => placeOrder(fixture.user._id, {
                    draftId: fixture.draft._id,
                    selectedAddressId: fixture.address._id,
                }),
                /Unable to place order/,
            );
        } finally {
            deleteSpy.mockRestore();
        }

        const [order, variant, product, cart, draft] = await Promise.all([
            Order.findById(fixture.draft._id).lean(),
            ProductVariant.findById(fixture.variant._id).lean(),
            Product.findById(fixture.product._id).lean(),
            Cart.findById(fixture.cart._id).lean(),
            CheckoutDraft.findById(fixture.draft._id).lean(),
        ]);

        assert.equal(order, null);
        assert.equal(variant.stock, 10);
        assert.equal(product.sold, 0);
        assert.equal(cart.items.length, 1);
        assert.ok(draft);
    });

    it('does not create or decrement inventory twice for the same draft', async () => {
        const fixture = await createFixture();

        const attempts = [1, 2].map(() => placeOrder(fixture.user._id, {
                draftId: fixture.draft._id,
                selectedAddressId: fixture.address._id,
            }));
        const results = await Promise.allSettled(attempts);
        const fulfilled = results.filter(result => result.status === 'fulfilled');
        const rejected = results.filter(result => result.status === 'rejected');

        assert.equal(fulfilled.length, 1);
        assert.equal(rejected.length, 1);
        assert.equal(
            await Order.countDocuments({ _id: fixture.draft._id }),
            1,
        );
        assert.equal(
            (await ProductVariant.findById(fixture.variant._id).lean()).stock,
            8,
        );
        assert.equal(
            (await Product.findById(fixture.product._id).lean()).sold,
            2,
        );
    });
});
