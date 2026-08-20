import mongoose from 'mongoose';

import Product from '../../models/catalog/product.model.js';
import ProductVariant from '../../models/catalog/product-variant.model.js';
import Review from '../../models/catalog/review.model.js';
import Cart from '../../models/commerce/cart.model.js';
import Order from '../../models/commerce/order.model.js';
import OrderReturnRequest from '../../models/commerce/order-return-request.model.js';
import UserNotification from '../../models/user/notification.model.js';
import UserSearchHistory from '../../models/user/search-history.model.js';
import WishList from '../../models/user/wish-list.model.js';
import { addDays, dateDaysAgo } from '../../utils/date.js';
import { createRandom } from '../../utils/random.js';

const REVIEW_TEXTS = Object.freeze({
    5: Object.freeze([
        'Sản phẩm đẹp, đúng mô tả và chất liệu ổn. Mình khá hài lòng.',
        'Màu sắc giống hình, form dễ mặc và đóng gói cẩn thận.',
        'Chất lượng tốt trong tầm giá, sẽ cân nhắc mua thêm màu khác.',
    ]),
    4: Object.freeze([
        'Sản phẩm ổn, màu đẹp và mặc thoải mái.',
        'Khá hài lòng với chất lượng tổng thể, form đúng mong đợi.',
    ]),
    3: Object.freeze([
        'Sản phẩm dùng ổn, chất lượng ở mức khá so với giá.',
        'Màu và kiểu dáng ổn, phần hoàn thiện có thể tốt hơn một chút.',
    ]),
    2: Object.freeze([
        'Sản phẩm dùng được nhưng chưa thật sự phù hợp với mong đợi.',
    ]),
});

function increment(map, key, amount) {
    map.set(key, (map.get(key) || 0) + amount);
}

function variantKey(variant) {
    return variant._id.toString();
}

function productKey(product) {
    return product._id.toString();
}

function addressSnapshot(address) {
    return {
        fullName: address.fullName,
        phone: address.phone,
        province: address.province,
        ward: address.ward,
        detail: address.detail,
    };
}

function createInventory(catalog) {
    return {
        remainingByVariantId: new Map(catalog.initialStockByVariantId),
    };
}

function getRemainingStock(inventory, variant) {
    return inventory.remainingByVariantId.get(variantKey(variant)) || 0;
}

function changeRemainingStock(inventory, variantId, delta) {
    const key = variantId.toString();
    const current = inventory.remainingByVariantId.get(key);

    if (!Number.isSafeInteger(current))
        throw new Error(`Missing seed inventory state for variant ${key}.`);

    const next = current + delta;

    if (!Number.isSafeInteger(next) || next < 0)
        throw new Error(`Seed inventory would become negative for ${key}.`);

    inventory.remainingByVariantId.set(key, next);
}

function getPurchasableVariants(catalog, inventory, minimumStock = 1) {
    return catalog.variants.filter(variant => (
        variant.isPublished !== false
        && getRemainingStock(inventory, variant) >= minimumStock
    ));
}

function selectFeaturedVariant(catalog, inventory) {
    const candidates = getPurchasableVariants(catalog, inventory, 12)
        .sort((left, right) => (
            getRemainingStock(inventory, right)
            - getRemainingStock(inventory, left)
        ));

    if (!candidates.length) {
        throw new Error(
            'Product seed needs at least one variant with stock >= 12 '
            + 'to build deterministic demo activity.',
        );
    }

    return candidates[0];
}

function pickDistinctVariants({
    catalog,
    inventory,
    random,
    itemCount,
    forcedVariant = null,
    firstItemMinQuantity = 1,
}) {
    const picked = [];
    const used = new Set();

    if (forcedVariant) {
        if (getRemainingStock(inventory, forcedVariant) < firstItemMinQuantity) {
            throw new Error(
                `Forced variant ${forcedVariant.sku} lacks seed stock.`,
            );
        }
        picked.push(forcedVariant);
        used.add(variantKey(forcedVariant));
    } else {
        const firstCandidates = getPurchasableVariants(
            catalog,
            inventory,
            firstItemMinQuantity,
        );

        if (!firstCandidates.length)
            throw new Error('No in-stock variant is available for seed orders.');

        const first = random.pick(firstCandidates);
        picked.push(first);
        used.add(variantKey(first));
    }

    const candidates = random.shuffle(
        getPurchasableVariants(catalog, inventory),
    );

    for (const variant of candidates) {
        if (picked.length >= itemCount)
            break;
        if (used.has(variantKey(variant)))
            continue;

        used.add(variantKey(variant));
        picked.push(variant);
    }

    if (picked.length < itemCount) {
        throw new Error(
            `Only ${picked.length} distinct in-stock variants are available; `
            + `${itemCount} required.`,
        );
    }

    return picked;
}

function toOrderItem(catalog, variant, quantity) {
    const meta = catalog.variantMetaById.get(variantKey(variant));

    if (!meta)
        throw new Error(`Missing variant metadata for ${variant._id}.`);

    return {
        product: meta.product._id,
        variant: variant._id,
        productName: meta.product.name,
        productSlug: meta.product.slug,
        image: variant.image.url,
        options: variant.options.map(option => ({
            name: option.name,
            value: option.value,
        })),
        price: variant.price,
        quantity,
        returnedQuantity: 0,
    };
}

function buildOrder({
    catalog,
    inventory,
    ledgers,
    user,
    address,
    random,
    status,
    createdDaysAgo,
    itemCount,
    forcedVariant = null,
    firstItemMinQuantity = 1,
}) {
    const variants = pickDistinctVariants({
        catalog,
        inventory,
        random,
        itemCount,
        forcedVariant,
        firstItemMinQuantity,
    });
    const items = variants.map((variant, index) => {
        const minimum = index === 0 ? firstItemMinQuantity : 1;
        const maximum = Math.min(2, getRemainingStock(inventory, variant));

        if (maximum < minimum) {
            throw new Error(
                `Variant ${variant.sku} cannot satisfy quantity ${minimum}.`,
            );
        }

        const quantity = random.int(minimum, maximum);

        if (status !== 'CANCELLED') {
            changeRemainingStock(inventory, variant._id, -quantity);
            increment(
                ledgers.soldByProduct,
                variant.product.toString(),
                quantity,
            );
        }

        return toOrderItem(catalog, variant, quantity);
    });
    const createdAt = dateDaysAgo(createdDaysAgo, random.int(8, 20));
    const completedAt = status === 'COMPLETED'
        ? addDays(createdAt, 2)
        : null;
    const cancelledAt = status === 'CANCELLED'
        ? addDays(createdAt, 1)
        : null;

    return {
        _id: new mongoose.Types.ObjectId(),
        user: user._id,
        customerDeletedAt: null,
        items,
        shippingAddress: addressSnapshot(address),
        note: '',
        totalAmount: items.reduce(
            (total, item) => total + item.price * item.quantity,
            0,
        ),
        status,
        completedAt,
        cancellationReason: status === 'CANCELLED'
            ? 'USER_CANCELLED'
            : '',
        inventoryRestoredAt: cancelledAt,
        createdAt,
        updatedAt: completedAt || cancelledAt || createdAt,
    };
}

function buildCompletedOrderByCompletionAge({
    completionDaysAgo,
    ...options
}) {
    const order = buildOrder({
        ...options,
        status: 'COMPLETED',
        createdDaysAgo: completionDaysAgo + 2,
    });

    order.completedAt = dateDaysAgo(
        completionDaysAgo,
        options.random.int(10, 18),
    );
    order.updatedAt = order.completedAt;
    return order;
}

function createReturnRequest(order, itemIndex, quantity, inventory, ledgers) {
    const orderItem = order.items[itemIndex];

    if (!orderItem)
        throw new Error(`Order ${order._id} has no item ${itemIndex}.`);

    const remainingReturnable = orderItem.quantity - orderItem.returnedQuantity;
    const returnQuantity = Math.min(quantity, remainingReturnable);

    if (returnQuantity < 1)
        throw new Error(`Order ${order._id} item is not returnable.`);

    orderItem.returnedQuantity += returnQuantity;
    changeRemainingStock(inventory, orderItem.variant, returnQuantity);
    increment(
        ledgers.soldByProduct,
        orderItem.product.toString(),
        -returnQuantity,
    );

    const createdAt = addDays(order.completedAt, 1);
    const requestItem = {
        product: orderItem.product,
        variant: orderItem.variant,
        productName: orderItem.productName,
        productSlug: orderItem.productSlug,
        image: orderItem.image,
        options: orderItem.options,
        quantity: returnQuantity,
        amount: orderItem.price * returnQuantity,
    };

    return {
        _id: new mongoose.Types.ObjectId(),
        order: order._id,
        user: order.user,
        requestKey: `seed-return-${order._id.toString()}`,
        items: [requestItem],
        amount: requestItem.amount,
        createdAt,
        updatedAt: createdAt,
    };
}

function buildWishlistDocs(plan, products, random) {
    const docs = [];

    plan.forEach(({ user, count }) => {
        const selected = random.shuffle(products).slice(
            0,
            Math.min(count, products.length),
        );

        selected.forEach((product) => {
            const createdAt = dateDaysAgo(
                random.int(1, 120),
                random.int(8, 20),
            );
            docs.push({
                _id: new mongoose.Types.ObjectId(),
                user: user._id,
                product: product._id,
                createdAt,
                updatedAt: createdAt,
            });
        });
    });

    return docs;
}

function buildCartDocs(users, catalog, inventory, random) {
    return users.map((user) => {
        const variants = random.shuffle(
            getPurchasableVariants(catalog, inventory),
        ).slice(0, 3);
        const now = new Date();

        return {
            _id: new mongoose.Types.ObjectId(),
            user: user._id,
            items: variants.map(variant => ({
                variant: variant._id,
                quantity: random.int(1, Math.min(2, getRemainingStock(
                    inventory,
                    variant,
                ))),
            })),
            createdAt: now,
            updatedAt: now,
        };
    });
}

function buildSyntheticOrders({
    config,
    catalog,
    inventory,
    users,
    random,
    ledgers,
    featuredVariant,
}) {
    const orders = [];
    const featuredOrders = [];

    users.synthetic.forEach((user, userIndex) => {
        const address = users.addressByUserId.get(user._id.toString());
        const orderCount = random.int(
            config.activity.syntheticOrdersMin,
            config.activity.syntheticOrdersMax,
        );
        const statuses = [
            'COMPLETED',
            userIndex % 2 === 0 ? 'SHIPPING' : 'CANCELLED',
        ];

        while (statuses.length < orderCount) {
            const roll = random.float();
            statuses.push(
                roll < 0.2
                    ? 'SHIPPING'
                    : roll < 0.85
                        ? 'COMPLETED'
                        : 'CANCELLED',
            );
        }

        statuses.forEach((status) => {
            const createdDaysAgo = status === 'SHIPPING'
                ? random.int(1, 5)
                : random.int(10, 110);
            orders.push(buildOrder({
                catalog,
                inventory,
                ledgers,
                user,
                address,
                random,
                status,
                createdDaysAgo,
                itemCount: random.int(1, 3),
            }));
        });

        if (userIndex < config.activity.featuredReviewTarget) {
            const featuredOrder = buildCompletedOrderByCompletionAge({
                catalog,
                inventory,
                ledgers,
                user,
                address,
                random,
                completionDaysAgo: 20 + userIndex,
                itemCount: 1,
                forcedVariant: featuredVariant,
            });
            orders.push(featuredOrder);
            featuredOrders.push(featuredOrder);
        }
    });

    return { orders, featuredOrders };
}

function buildDemoCustomerOrders({
    catalog,
    inventory,
    users,
    random,
    ledgers,
}) {
    const user = users.demoCustomer;
    const address = users.addressByUserId.get(user._id.toString());
    const orders = [
        buildOrder({
            catalog, inventory, ledgers, user, address, random,
            status: 'SHIPPING', createdDaysAgo: 1, itemCount: 2,
        }),
        buildOrder({
            catalog, inventory, ledgers, user, address, random,
            status: 'SHIPPING', createdDaysAgo: 4, itemCount: 1,
        }),
        buildCompletedOrderByCompletionAge({
            catalog, inventory, ledgers, user, address, random,
            completionDaysAgo: 3, itemCount: 2,
        }),
        buildCompletedOrderByCompletionAge({
            catalog, inventory, ledgers, user, address, random,
            completionDaysAgo: 5, itemCount: 2, firstItemMinQuantity: 2,
        }),
        buildCompletedOrderByCompletionAge({
            catalog, inventory, ledgers, user, address, random,
            completionDaysAgo: 12, itemCount: 2,
        }),
        buildCompletedOrderByCompletionAge({
            catalog, inventory, ledgers, user, address, random,
            completionDaysAgo: 28, itemCount: 1,
        }),
        buildCompletedOrderByCompletionAge({
            catalog, inventory, ledgers, user, address, random,
            completionDaysAgo: 45, itemCount: 2,
        }),
        buildOrder({
            catalog, inventory, ledgers, user, address, random,
            status: 'CANCELLED', createdDaysAgo: 14, itemCount: 1,
        }),
    ];

    return {
        orders,
        returnOrder: orders[3],
    };
}

function buildDemoEdgeOrders({
    catalog,
    inventory,
    users,
    random,
    ledgers,
}) {
    const user = users.demoEdge;
    const address = users.addressByUserId.get(user._id.toString());
    const eligible = buildCompletedOrderByCompletionAge({
        catalog, inventory, ledgers, user, address, random,
        completionDaysAgo: 2, itemCount: 2,
    });
    const expired = buildCompletedOrderByCompletionAge({
        catalog, inventory, ledgers, user, address, random,
        completionDaysAgo: 18, itemCount: 1,
    });
    const partial = buildCompletedOrderByCompletionAge({
        catalog, inventory, ledgers, user, address, random,
        completionDaysAgo: 4, itemCount: 2, firstItemMinQuantity: 2,
    });
    const full = buildCompletedOrderByCompletionAge({
        catalog, inventory, ledgers, user, address, random,
        completionDaysAgo: 3, itemCount: 1,
    });
    const shipping = buildOrder({
        catalog, inventory, ledgers, user, address, random,
        status: 'SHIPPING', createdDaysAgo: 2, itemCount: 2,
    });
    const cancelled = buildOrder({
        catalog, inventory, ledgers, user, address, random,
        status: 'CANCELLED', createdDaysAgo: 11, itemCount: 1,
    });

    return {
        orders: [eligible, expired, partial, full, shipping, cancelled],
        eligible,
        expired,
        partial,
        full,
    };
}

function buildReturns({
    config,
    syntheticOrders,
    demoCustomerState,
    demoEdgeState,
    inventory,
    ledgers,
    featuredProductId,
}) {
    const returns = [];
    const featuredProductKey = featuredProductId.toString();
    const byUser = new Map();

    syntheticOrders.forEach((order) => {
        if (order.status !== 'COMPLETED')
            return;
        if (order.items.some(
            item => item.product.toString() === featuredProductKey,
        )) {
            return;
        }
        const key = order.user.toString();
        const list = byUser.get(key) || [];
        list.push(order);
        byUser.set(key, list);
    });

    for (const orders of byUser.values()) {
        if (returns.length >= config.activity.syntheticReturnUsers)
            break;

        const order = orders[0];
        const itemIndex = order.items.findIndex(item => (
            item.returnedQuantity < item.quantity
        ));

        if (itemIndex >= 0) {
            returns.push(createReturnRequest(
                order,
                itemIndex,
                1,
                inventory,
                ledgers,
            ));
        }
    }

    returns.push(createReturnRequest(
        demoCustomerState.returnOrder,
        0,
        1,
        inventory,
        ledgers,
    ));
    returns.push(createReturnRequest(
        demoEdgeState.partial,
        0,
        1,
        inventory,
        ledgers,
    ));
    returns.push(createReturnRequest(
        demoEdgeState.full,
        0,
        demoEdgeState.full.items[0].quantity,
        inventory,
        ledgers,
    ));

    return returns;
}

function reviewRating(random) {
    const roll = random.float();

    if (roll < 0.55)
        return 5;
    if (roll < 0.82)
        return 4;
    if (roll < 0.95)
        return 3;
    return 2;
}

function buildReviews({
    config,
    catalog,
    orders,
    users,
    random,
    featuredOrders,
    featuredProductId,
}) {
    const reviewDocs = [];
    const used = new Set();
    const userIds = [
        ...users.synthetic,
        users.demoCustomer,
        users.demoEdge,
    ].map(user => user._id);

    function addReview(order, item, isPublished) {
        if (!item || item.returnedQuantity >= item.quantity)
            return false;

        const key = `${order._id}:${item.variant}`;
        if (used.has(key))
            return false;

        used.add(key);
        const variantMeta = catalog.variantMetaById.get(
            item.variant.toString(),
        );

        if (!variantMeta)
            throw new Error(`Missing variant metadata for ${item.variant}.`);

        const rating = reviewRating(random);
        const otherUsers = userIds.filter(
            userId => userId.toString() !== order.user.toString(),
        );
        const desiredCreatedAt = addDays(
            order.completedAt,
            random.int(1, 4),
        );
        const latestAllowed = new Date(Date.now() - 60 * 60 * 1000);
        const createdAt = desiredCreatedAt > latestAllowed
            ? latestAllowed
            : desiredCreatedAt;

        reviewDocs.push({
            _id: new mongoose.Types.ObjectId(),
            product: item.product,
            user: order.user,
            authorDeletedAt: null,
            order: order._id,
            variant: item.variant,
            rating,
            content: random.pick(REVIEW_TEXTS[rating]),
            images: [{
                url: variantMeta.document.image.url,
                publicId: variantMeta.document.image.publicId,
            }],
            likedBy: random.shuffle(otherUsers).slice(0, random.int(0, 3)),
            isPublished,
            createdAt,
            updatedAt: createdAt,
        });
        return true;
    }

    const featuredKey = featuredProductId.toString();
    featuredOrders.forEach((order) => {
        const item = order.items.find(
            candidate => candidate.product.toString() === featuredKey,
        );
        addReview(order, item, true);
    });

    let hiddenAdded = false;
    const completedOrders = random.shuffle(
        orders.filter(order => order.status === 'COMPLETED'),
    );

    for (const order of completedOrders) {
        for (const item of order.items) {
            if (reviewDocs.length >= config.activity.reviewTarget)
                break;
            if (used.has(`${order._id}:${item.variant}`))
                continue;
            if (item.returnedQuantity >= item.quantity)
                continue;
            if (!hiddenAdded) {
                hiddenAdded = addReview(order, item, false);
                continue;
            }
            if (random.chance(0.65))
                addReview(order, item, true);
        }

        if (reviewDocs.length >= config.activity.reviewTarget)
            break;
    }

    if (!hiddenAdded) {
        for (const order of completedOrders) {
            const item = order.items.find(candidate => (
                candidate.returnedQuantity < candidate.quantity
                && !used.has(`${order._id}:${candidate.variant}`)
            ));

            if (item && addReview(order, item, false)) {
                hiddenAdded = true;
                break;
            }
        }
    }

    return reviewDocs;
}

function buildSearchHistory(user, queries) {
    const now = new Date();

    return {
        _id: new mongoose.Types.ObjectId(),
        user: user._id,
        items: queries.slice(0, 6).map(query => ({
            query,
            normalizedQuery: query.trim().toLocaleLowerCase('vi-VN'),
        })),
        createdAt: now,
        updatedAt: now,
    };
}

function buildSearchQueries(catalog) {
    const leafNames = [];
    const seenLeafNames = new Set();

    for (const product of catalog.products) {
        const source = catalog.productMetaById.get(productKey(product)).source;
        const leafName = source.category.leaf.name;

        if (!seenLeafNames.has(leafName)) {
            seenLeafNames.add(leafName);
            leafNames.push(leafName);
        }
    }

    return {
        customer: [
            ...leafNames.slice(0, 4),
            catalog.products[0]?.name,
            catalog.products[1]?.name,
        ].filter(Boolean),
        edge: [
            ...leafNames.slice(4, 8),
            catalog.products.at(-1)?.name,
            'H&M',
        ].filter(Boolean),
    };
}

function buildNotifications(user, orders) {
    return orders
        .filter(order => order.status === 'COMPLETED')
        .map((order, index) => {
            const createdAt = addDays(order.completedAt, 0.02);

            return {
                _id: new mongoose.Types.ObjectId(),
                user: user._id,
                type: 'ORDER_COMPLETED',
                title: 'Đơn hàng đã hoàn thành',
                description: `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đã được giao thành công.`,
                readAt: index < 2 ? addDays(createdAt, 0.2) : null,
                createdAt,
                updatedAt: createdAt,
            };
        });
}

function computeLikesByProduct(wishlistDocs) {
    const likes = new Map();

    wishlistDocs.forEach((item) => {
        increment(likes, item.product.toString(), 1);
    });

    return likes;
}

function computeRatingByProduct(reviewDocs) {
    const ratings = new Map();

    reviewDocs.filter(review => review.isPublished).forEach((review) => {
        const key = review.product.toString();
        const current = ratings.get(key) || { sum: 0, count: 0 };
        current.sum += review.rating;
        current.count += 1;
        ratings.set(key, current);
    });

    return ratings;
}

async function applyCatalogState({
    catalog,
    inventory,
    ledgers,
    wishlistDocs,
    reviewDocs,
}) {
    const likesByProduct = computeLikesByProduct(wishlistDocs);
    const ratingByProduct = computeRatingByProduct(reviewDocs);
    const productOperations = catalog.products.map((product) => {
        const id = productKey(product);
        const ratingState = ratingByProduct.get(id) || { sum: 0, count: 0 };

        return {
            updateOne: {
                filter: { _id: product._id },
                update: {
                    $set: {
                        likes: likesByProduct.get(id) || 0,
                        sold: ledgers.soldByProduct.get(id) || 0,
                        rating: {
                            sum: ratingState.sum,
                            count: ratingState.count,
                            average: ratingState.count
                                ? ratingState.sum / ratingState.count
                                : 0,
                        },
                    },
                },
            },
        };
    });
    const variantOperations = catalog.variants.map((variant) => ({
        updateOne: {
            filter: { _id: variant._id },
            update: {
                $set: {
                    stock: inventory.remainingByVariantId.get(
                        variantKey(variant),
                    ),
                },
            },
        },
    }));

    await Product.bulkWrite(productOperations, { ordered: true });
    await ProductVariant.bulkWrite(variantOperations, { ordered: true });

    return {
        likesByProduct,
        ratingByProduct,
    };
}

async function seedActivity(config, catalog, users) {
    const random = createRandom();
    const inventory = createInventory(catalog);
    const ledgers = {
        soldByProduct: new Map(),
    };
    const featuredVariant = selectFeaturedVariant(catalog, inventory);
    const wishlistPlan = [
        ...users.synthetic.map(user => ({
            user,
            count: random.int(
                config.activity.syntheticWishlistMin,
                config.activity.syntheticWishlistMax,
            ),
        })),
        {
            user: users.demoCustomer,
            count: Math.min(12, catalog.products.length),
        },
        {
            user: users.demoEdge,
            count: Math.min(6, catalog.products.length),
        },
    ];
    const wishlistDocs = buildWishlistDocs(
        wishlistPlan,
        catalog.products,
        random,
    );
    const cartUsers = [
        ...users.synthetic.slice(0, config.activity.syntheticCartUsers),
        users.demoCustomer,
    ];
    const cartDocs = buildCartDocs(
        cartUsers,
        catalog,
        inventory,
        random,
    );
    const syntheticState = buildSyntheticOrders({
        config,
        catalog,
        inventory,
        users,
        random,
        ledgers,
        featuredVariant,
    });
    const demoCustomerState = buildDemoCustomerOrders({
        catalog,
        inventory,
        users,
        random,
        ledgers,
    });
    const demoEdgeState = buildDemoEdgeOrders({
        catalog,
        inventory,
        users,
        random,
        ledgers,
    });
    const orders = [
        ...syntheticState.orders,
        ...demoCustomerState.orders,
        ...demoEdgeState.orders,
    ];
    const returnDocs = buildReturns({
        config,
        syntheticOrders: syntheticState.orders,
        demoCustomerState,
        demoEdgeState,
        inventory,
        ledgers,
        featuredProductId: featuredVariant.product,
    });
    const reviewDocs = buildReviews({
        config,
        catalog,
        orders,
        users,
        random,
        featuredOrders: syntheticState.featuredOrders,
        featuredProductId: featuredVariant.product,
    });
    const searchQueries = buildSearchQueries(catalog);
    const searchHistoryDocs = [
        buildSearchHistory(users.demoCustomer, searchQueries.customer),
        buildSearchHistory(users.demoEdge, searchQueries.edge),
    ];
    const notificationDocs = [
        ...buildNotifications(users.demoCustomer, demoCustomerState.orders),
        ...buildNotifications(users.demoEdge, demoEdgeState.orders),
    ];

    await WishList.insertMany(wishlistDocs);
    await Cart.insertMany(cartDocs);
    await Order.insertMany(orders);
    await OrderReturnRequest.insertMany(returnDocs);
    await Review.insertMany(reviewDocs);
    await UserSearchHistory.insertMany(searchHistoryDocs);
    if (notificationDocs.length)
        await UserNotification.insertMany(notificationDocs);

    const counterState = await applyCatalogState({
        catalog,
        inventory,
        ledgers,
        wishlistDocs,
        reviewDocs,
    });

    return {
        wishlistDocs,
        cartDocs,
        orders,
        returnDocs,
        reviewDocs,
        searchHistoryDocs,
        notificationDocs,
        inventory,
        ledgers,
        counterState,
        featuredVariant,
        demoCustomerState,
        demoEdgeState,
    };
}

export { seedActivity };
