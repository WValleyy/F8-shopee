import commerceConfig from '../../config/commerce.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function assert(condition, message) {
    if (!condition)
        throw new Error(`Generated seed data invalid: ${message}`);
}

function orderItemKey(orderId, variantId) {
    return `${orderId.toString()}:${variantId.toString()}`;
}

function validateOrders(activity) {
    const orderById = new Map();

    activity.orders.forEach((order) => {
        const id = order._id.toString();
        assert(!orderById.has(id), `duplicate order ${id}.`);
        orderById.set(id, order);

        const variants = order.items.map(item => item.variant.toString());
        assert(
            variants.length === new Set(variants).size,
            `order ${id} contains duplicate variants.`,
        );
        assert(
            order.totalAmount === order.items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
            ),
            `order ${id} totalAmount is inconsistent.`,
        );
        order.items.forEach((item) => {
            assert(
                Number.isSafeInteger(item.returnedQuantity)
                && item.returnedQuantity >= 0
                && item.returnedQuantity <= item.quantity,
                `order ${id} has invalid returnedQuantity.`,
            );
        });

        if (order.status === 'COMPLETED') {
            assert(order.completedAt, `completed order ${id} lacks completedAt.`);
            assert(
                order.cancellationReason === '',
                `completed order ${id} has cancellationReason.`,
            );
        }
        if (order.status === 'SHIPPING') {
            assert(!order.completedAt, `shipping order ${id} has completedAt.`);
            assert(
                order.cancellationReason === '',
                `shipping order ${id} has cancellationReason.`,
            );
        }
        if (order.status === 'CANCELLED') {
            assert(
                order.cancellationReason === 'USER_CANCELLED',
                `cancelled order ${id} lacks USER_CANCELLED reason.`,
            );
            assert(
                order.inventoryRestoredAt,
                `cancelled order ${id} lacks inventoryRestoredAt.`,
            );
        }
    });

    for (const status of ['SHIPPING', 'COMPLETED', 'CANCELLED']) {
        assert(
            activity.orders.some(order => order.status === status),
            `missing order status ${status}.`,
        );
    }

    return orderById;
}

function validateReturns(activity, orderById) {
    const returnedByOrderVariant = new Map();

    activity.returnDocs.forEach((request) => {
        const order = orderById.get(request.order.toString());
        assert(order, `return ${request._id} references an unknown order.`);
        assert(
            order.status === 'COMPLETED',
            `return ${request._id} does not reference a completed order.`,
        );
        assert(request.items.length > 0, `return ${request._id} has no items.`);
        assert(
            request.amount === request.items.reduce(
                (sum, item) => sum + item.amount,
                0,
            ),
            `return ${request._id} amount is inconsistent.`,
        );
        const deadline = new Date(order.completedAt).getTime()
            + commerceConfig.return.windowDays * DAY_MS;
        assert(
            new Date(request.createdAt).getTime() <= deadline,
            `return ${request._id} was created outside the return window.`,
        );

        request.items.forEach((item) => {
            const orderItem = order.items.find(candidate => (
                candidate.variant.toString() === item.variant.toString()
            ));
            assert(
                orderItem,
                `return ${request._id} contains a variant not in its order.`,
            );
            assert(
                item.amount === orderItem.price * item.quantity,
                `return ${request._id} item amount is inconsistent.`,
            );
            const key = orderItemKey(order._id, item.variant);
            const returned = returnedByOrderVariant.get(key) || 0;
            returnedByOrderVariant.set(key, returned + item.quantity);
        });
    });

    activity.orders.forEach((order) => {
        order.items.forEach((item) => {
            const expected = returnedByOrderVariant.get(
                orderItemKey(order._id, item.variant),
            ) || 0;
            assert(
                item.returnedQuantity === expected,
                `order ${order._id} returnedQuantity does not match returns.`,
            );
        });
    });
}

function validateReviews(config, activity, orderById) {
    const reviewKeys = new Set();
    let featuredPublishedCount = 0;
    const featuredProductId = activity.featuredVariant.product.toString();

    activity.reviewDocs.forEach((review) => {
        const order = orderById.get(review.order.toString());
        assert(order, `review ${review._id} references an unknown order.`);
        assert(
            order.status === 'COMPLETED',
            `review ${review._id} references a non-completed order.`,
        );
        const item = order.items.find(candidate => (
            candidate.product.toString() === review.product.toString()
            && candidate.variant.toString() === review.variant.toString()
        ));
        assert(item, `review ${review._id} item was not purchased.`);
        assert(
            item.returnedQuantity < item.quantity,
            `review ${review._id} targets a fully returned item.`,
        );
        const key = orderItemKey(order._id, review.variant);
        assert(!reviewKeys.has(key), `duplicate review gate key ${key}.`);
        reviewKeys.add(key);

        if (
            review.isPublished
            && review.product.toString() === featuredProductId
        ) {
            featuredPublishedCount += 1;
        }
    });

    assert(
        featuredPublishedCount >= config.activity.featuredReviewTarget,
        `featured product has only ${featuredPublishedCount} published reviews.`,
    );
    assert(
        activity.reviewDocs.some(review => !review.isPublished),
        'at least one hidden review is required for admin UI.',
    );
}

function validateUserActivity(config, users, activity) {
    const wishlistCountByUser = new Map();
    const orderCountByUser = new Map();

    activity.wishlistDocs.forEach((item) => {
        const key = item.user.toString();
        wishlistCountByUser.set(key, (wishlistCountByUser.get(key) || 0) + 1);
    });
    activity.orders.forEach((order) => {
        const key = order.user.toString();
        orderCountByUser.set(key, (orderCountByUser.get(key) || 0) + 1);
    });

    users.synthetic.forEach((user) => {
        const id = user._id.toString();
        assert(
            (wishlistCountByUser.get(id) || 0)
            >= config.activity.syntheticWishlistMin,
            `synthetic user ${user.email} has too few wishlist items.`,
        );
        assert(
            (orderCountByUser.get(id) || 0) >= config.activity.syntheticOrdersMin,
            `synthetic user ${user.email} has too few orders.`,
        );
        assert(
            !activity.searchHistoryDocs.some(
                history => history.user.toString() === id,
            ),
            `synthetic user ${user.email} must not have search history.`,
        );
        assert(
            !activity.notificationDocs.some(
                notification => notification.user.toString() === id,
            ),
            `synthetic user ${user.email} must not have notifications.`,
        );
    });

    assert(
        activity.searchHistoryDocs.length === 2,
        'exactly two demo search-history documents are expected.',
    );
}

function validateDemoEdge(activity) {
    const { eligible, expired, partial, full } = activity.demoEdgeState;
    const now = Date.now();
    const returnWindowMs = commerceConfig.return.windowDays * DAY_MS;

    assert(
        now - new Date(eligible.completedAt).getTime() <= returnWindowMs,
        'demo edge eligible order is outside the return window.',
    );
    assert(
        now - new Date(expired.completedAt).getTime() > returnWindowMs,
        'demo edge expired order is still inside the return window.',
    );

    const partialItem = partial.items[0];
    assert(
        partialItem.returnedQuantity >= 1
        && partialItem.returnedQuantity < partialItem.quantity,
        'demo edge partial-return case is invalid.',
    );
    const fullItem = full.items[0];
    assert(
        fullItem.returnedQuantity === fullItem.quantity,
        'demo edge full-return case is invalid.',
    );
}

function validateInventory(catalog, activity) {
    catalog.variants.forEach((variant) => {
        const stock = activity.inventory.remainingByVariantId.get(
            variant._id.toString(),
        );
        assert(
            Number.isSafeInteger(stock) && stock >= 0,
            `variant ${variant.sku} has invalid final stock.`,
        );
    });
}

function validateGeneratedActivity(config, catalog, users, activity) {
    const orderById = validateOrders(activity);
    validateReturns(activity, orderById);
    validateReviews(config, activity, orderById);
    validateUserActivity(config, users, activity);
    validateDemoEdge(activity);
    validateInventory(catalog, activity);
}

export { validateGeneratedActivity };
