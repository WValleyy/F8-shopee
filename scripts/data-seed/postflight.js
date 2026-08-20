import AuthRateLimit from '../../models/auth/auth-rate-limit.model.js';
import AuthSession from '../../models/auth/auth-session.model.js';
import EmailOtpChallenge from '../../models/auth/email-otp-challenge.model.js';
import RefreshRotationGrace from '../../models/auth/refresh-rotation-grace.model.js';
import Category from '../../models/catalog/category.model.js';
import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import Review from '../../models/catalog/review.model.js';
import Cart from '../../models/commerce/cart.model.js';
import CheckoutDraft from '../../models/commerce/checkout-draft.model.js';
import Order from '../../models/commerce/order.model.js';
import OrderReturnRequest from '../../models/commerce/order-return-request.model.js';
import UserNotification from '../../models/user/notification.model.js';
import UserSearchHistory from '../../models/user/search-history.model.js';
import UserAddress from '../../models/user/user-address.model.js';
import User from '../../models/user/user.model.js';
import WishList from '../../models/user/wish-list.model.js';

function mapAggregation(rows) {
    return new Map(rows.map(row => [row._id.toString(), row]));
}

async function verifyProductCounters() {
    const [products, wishlistRows, soldRows, ratingRows] = await Promise.all([
        Product.find({}).select('likes sold rating').lean(),
        WishList.aggregate([
            { $group: { _id: '$product', count: { $sum: 1 } } },
        ]),
        Order.aggregate([
            { $match: { status: { $in: ['SHIPPING', 'COMPLETED'] } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    sold: {
                        $sum: {
                            $subtract: [
                                '$items.quantity',
                                { $ifNull: ['$items.returnedQuantity', 0] },
                            ],
                        },
                    },
                },
            },
        ]),
        Review.aggregate([
            { $match: { isPublished: true } },
            {
                $group: {
                    _id: '$product',
                    sum: { $sum: '$rating' },
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);
    const wishlistByProduct = mapAggregation(wishlistRows);
    const soldByProduct = mapAggregation(soldRows);
    const ratingByProduct = mapAggregation(ratingRows);

    products.forEach((product) => {
        const id = product._id.toString();
        const expectedLikes = wishlistByProduct.get(id)?.count || 0;
        const expectedSold = soldByProduct.get(id)?.sold || 0;
        const expectedRating = ratingByProduct.get(id) || { sum: 0, count: 0 };
        const expectedAverage = expectedRating.count
            ? expectedRating.sum / expectedRating.count
            : 0;

        if (product.likes !== expectedLikes) {
            throw new Error(
                `Wishlist counter mismatch for product ${id}: `
                + `${product.likes} !== ${expectedLikes}.`,
            );
        }
        if (product.sold !== expectedSold) {
            throw new Error(
                `Sold counter mismatch for product ${id}: `
                + `${product.sold} !== ${expectedSold}.`,
            );
        }
        if (
            product.rating.sum !== expectedRating.sum
            || product.rating.count !== expectedRating.count
            || product.rating.average !== expectedAverage
        ) {
            throw new Error(`Rating counter mismatch for product ${id}.`);
        }
    });
}

async function verifyVariantStocks(activity) {
    const variants = await ProductVariant.find({}).select('stock sku').lean();

    variants.forEach((variant) => {
        const expected = activity.inventory.remainingByVariantId.get(
            variant._id.toString(),
        );

        if (variant.stock !== expected) {
            throw new Error(
                `Stock mismatch for ${variant.sku}: `
                + `${variant.stock} !== ${expected}.`,
            );
        }
    });
}

async function verifyReturnedQuantities() {
    const [orders, returns] = await Promise.all([
        Order.find({}).select('items.variant items.returnedQuantity').lean(),
        OrderReturnRequest.find({}).select('order items.variant items.quantity').lean(),
    ]);
    const returnedByOrderVariant = new Map();

    returns.forEach((request) => {
        request.items.forEach((item) => {
            const key = `${request.order}:${item.variant}`;
            returnedByOrderVariant.set(
                key,
                (returnedByOrderVariant.get(key) || 0) + item.quantity,
            );
        });
    });

    orders.forEach((order) => {
        order.items.forEach((item) => {
            const key = `${order._id}:${item.variant}`;
            const expected = returnedByOrderVariant.get(key) || 0;

            if (item.returnedQuantity !== expected) {
                throw new Error(
                    `Returned quantity mismatch for ${key}: `
                    + `${item.returnedQuantity} !== ${expected}.`,
                );
            }
        });
    });
}

async function verifyNoTechnicalSeed() {
    const counts = await Promise.all([
        AuthRateLimit.countDocuments({}),
        AuthSession.countDocuments({}),
        EmailOtpChallenge.countDocuments({}),
        RefreshRotationGrace.countDocuments({}),
        CheckoutDraft.countDocuments({}),
    ]);

    if (counts.some(Boolean)) {
        throw new Error(
            'Auth session/OTP/rate-limit/checkout-draft data must remain empty.',
        );
    }
}

async function verifyUserAddresses(users) {
    const addressRows = await UserAddress.aggregate([
        {
            $group: {
                _id: '$user',
                count: { $sum: 1 },
                defaultCount: {
                    $sum: { $cond: ['$isDefault', 1, 0] },
                },
            },
        },
    ]);
    const addressByUser = mapAggregation(addressRows);
    const expectedAddressUsers = [
        ...users.synthetic,
        users.demoCustomer,
        users.demoEdge,
    ];

    expectedAddressUsers.forEach((user) => {
        const row = addressByUser.get(user._id.toString());

        if (!row || row.count !== 1 || row.defaultCount !== 1) {
            throw new Error(
                `Seed user ${user.email} must have exactly one default address.`,
            );
        }
    });

    if (addressByUser.has(users.admin._id.toString()))
        throw new Error('Admin seed account must not have a shipping address.');
}

async function runPostflight(sourceSummary, catalog, users, activity) {
    await Promise.all([
        verifyProductCounters(),
        verifyVariantStocks(activity),
        verifyReturnedQuantities(),
        verifyNoTechnicalSeed(),
        verifyUserAddresses(users),
    ]);

    const [
        categories,
        products,
        variants,
        userCount,
        addresses,
        wishlist,
        carts,
        orders,
        returns,
        reviews,
        searchHistories,
        notifications,
        negativeStock,
    ] = await Promise.all([
        Category.countDocuments({}),
        Product.countDocuments({}),
        ProductVariant.countDocuments({}),
        User.countDocuments({}),
        UserAddress.countDocuments({}),
        WishList.countDocuments({}),
        Cart.countDocuments({}),
        Order.countDocuments({}),
        OrderReturnRequest.countDocuments({}),
        Review.countDocuments({}),
        UserSearchHistory.countDocuments({}),
        UserNotification.countDocuments({}),
        ProductVariant.countDocuments({ stock: { $lt: 0 } }),
    ]);
    const expectedCategoryCount = sourceSummary.parentCount
        + sourceSummary.leafCount;
    const expectedUserCount = users.synthetic.length + 3;
    const expectedAddressCount = users.synthetic.length + 2;

    const expectations = [
        ['categories', categories, expectedCategoryCount],
        ['products', products, sourceSummary.productCount],
        ['variants', variants, sourceSummary.variantCount],
        ['users', userCount, expectedUserCount],
        ['addresses', addresses, expectedAddressCount],
        ['wishlist', wishlist, activity.wishlistDocs.length],
        ['carts', carts, activity.cartDocs.length],
        ['orders', orders, activity.orders.length],
        ['returns', returns, activity.returnDocs.length],
        ['reviews', reviews, activity.reviewDocs.length],
        ['search histories', searchHistories, activity.searchHistoryDocs.length],
        ['notifications', notifications, activity.notificationDocs.length],
    ];

    expectations.forEach(([label, actual, expected]) => {
        if (actual !== expected)
            throw new Error(`Expected ${expected} ${label}; got ${actual}.`);
    });

    if (negativeStock)
        throw new Error('Seed produced variants with negative stock.');
    if (catalog.products.length !== products)
        throw new Error('In-memory and persisted product counts diverged.');

    return {
        categories,
        products,
        variants,
        users: userCount,
        addresses,
        wishlist,
        carts,
        orders,
        returns,
        reviews,
        searchHistories,
        notifications,
    };
}

export { runPostflight };
