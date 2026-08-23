import paginationConfig from '../../../config/pagination.js';
import Review from '../../../models/catalog/review.model.js';
import OrderReturnRequest from '../../../models/commerce/order-return-request.model.js';
import { buildPagination } from '../../../utils/pagination.js';
import { escapeRegex } from '../../../utils/regex.js';
import Order from '../../../models/commerce/order.model.js';
import {
    isOrderReturnWindowOpen,
    listAllowedOrderActions,
} from './order-policy.js';

const ORDER_STATUS_GROUP_FILTERS = {
    delivering: ['SHIPPING'],
    completed: ['COMPLETED'],
    cancelled: ['CANCELLED'],
};

async function listOrdersPage(userId, options = {}) {
    const currentTab = options.tab || 'all';
    const currentQuery = options.q || '';
    const normalizedKeyword = currentQuery.toLowerCase();
    const page = options.page || 1;
    const limit = paginationConfig.purchases;

    if (currentTab === 'return-refund') {
        return listReturnRequestsPage(userId, {
            currentTab,
            currentQuery,
            normalizedKeyword,
            page,
            limit,
        });
    }

    const orderQuery = { user: userId };

    if (currentTab !== 'all') {
        orderQuery.status = {
            $in: ORDER_STATUS_GROUP_FILTERS[currentTab],
        };
    }

    const keywordConditions = buildKeywordQuery(
        normalizedKeyword,
        ['items.productName'],
    );

    if (keywordConditions)
        orderQuery.$or = keywordConditions;

    const totalItems = await Order.countDocuments(orderQuery);
    const pagination = buildPagination({ page, limit, totalItems });
    const orders = await Order
        .find(orderQuery)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();
    const reviewByItemKey = await buildReviewByItemKey(userId, orders);
    const normalizedOrders = orders.map(order => toOrderViewModel(
        order,
        reviewByItemKey,
    ));

    return {
        orders: normalizedOrders,
        hasOrders: totalItems > 0,
        currentTab,
        currentQuery,
        pagination,
    };
}

function buildPurchaseReviewKey(orderId, productId, variantId) {
    return [
        orderId.toString(),
        productId.toString(),
        variantId.toString(),
    ].join(':');
}

function toOrderViewModel(
    order,
    reviewByItemKey = new Map(),
) {
    const normalizedItems = order.items.map((item) => {
        const quantity = item.quantity;
        const returnedQuantity = item.returnedQuantity;

        return {
            item,
            quantity,
            returnedQuantity,
            returnableQuantity: quantity - returnedQuantity,
        };
    });
    const availableActions = listAllowedOrderActions(order.status, 'USER');

    if (
        order.status === 'COMPLETED'
        && isOrderReturnWindowOpen(order)
        && normalizedItems.some(item => item.returnableQuantity > 0)
    ) {
        availableActions.push('return');
    }

    return {
        entryType: 'ORDER',
        id: order._id.toString(),
        status: order.status,
        totalAmount: order.totalAmount,
        allowedActions: availableActions,
        items: normalizedItems.map((normalizedItem) => {
            const { item } = normalizedItem;
            const productId = item.product.toString();
            const variantId = item.variant.toString();
            const review = reviewByItemKey.get(
                buildPurchaseReviewKey(
                    order._id.toString(),
                    productId,
                    variantId,
                ),
            );

            return {
                orderId: order._id.toString(),
                productId,
                variantId,
                productName: item.productName,
                productSlug: item.productSlug,
                image: item.image,
                options: item.options,
                quantity: normalizedItem.quantity,
                originalQuantity: normalizedItem.quantity,
                returnedQuantity: normalizedItem.returnedQuantity,
                returnableQuantity: normalizedItem.returnableQuantity,
                price: item.price,
                total: item.price * normalizedItem.quantity,
                reviewId: review ? review._id.toString() : '',
            };
        }),
    };
}

function toOrderReturnRequestViewModel(returnRequest) {
    const orderId = returnRequest.order.toString();

    return {
        entryType: 'RETURN_REQUEST',
        id: returnRequest._id.toString(),
        orderId,
        totalAmount: returnRequest.amount,
        items: returnRequest.items.map(item => ({
            orderId,
            productId: item.product.toString(),
            variantId: item.variant.toString(),
            productName: item.productName,
            productSlug: item.productSlug,
            image: item.image,
            options: item.options,
            quantity: item.quantity,
            originalQuantity: item.quantity,
            returnedQuantity: item.quantity,
            returnableQuantity: 0,
            total: item.amount,
            reviewId: '',
        })),
    };
}

async function buildReviewByItemKey(userId, orders = []) {
    const orderIds = orders.map(order => order._id.toString());
    const reviews = orderIds.length
        ? await Review.find({
            user: userId,
            order: { $in: orderIds },
        })
            .select('_id order product variant')
            .lean()
        : [];

    return new Map(
        reviews.map(review => [
            buildPurchaseReviewKey(
                review.order.toString(),
                review.product.toString(),
                review.variant.toString(),
            ),
            review,
        ]),
    );
}

function buildKeywordQuery(normalizedKeyword, fields = []) {
    if (!normalizedKeyword)
        return null;

    const escapedKeyword = escapeRegex(normalizedKeyword);
    const conditions = fields.map(field => ({
        [field]: {
            $regex: escapedKeyword,
            $options: 'i',
        },
    }));

    conditions.push({
        $expr: {
            $regexMatch: {
                input: { $toString: '$_id' },
                regex: escapedKeyword,
                options: 'i',
            },
        },
    });

    return conditions;
}

async function listReturnRequestsPage(userId, context) {
    const {
        currentTab,
        currentQuery,
        normalizedKeyword,
        page,
        limit,
    } = context;
    const query = { user: userId };
    const keywordConditions = buildKeywordQuery(
        normalizedKeyword,
        ['items.productName'],
    );

    if (keywordConditions) {
        keywordConditions.push({
            $expr: {
                $regexMatch: {
                    input: { $toString: '$order' },
                    regex: escapeRegex(normalizedKeyword),
                    options: 'i',
                },
            },
        });
        query.$or = keywordConditions;
    }

    const totalItems = await OrderReturnRequest.countDocuments(query);
    const pagination = buildPagination({ page, limit, totalItems });
    const returnRequests = await OrderReturnRequest
        .find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();

    return {
        orders: returnRequests.map(toOrderReturnRequestViewModel),
        hasOrders: totalItems > 0,
        currentTab,
        currentQuery,
        pagination,
    };
}

export {
    listOrdersPage,
};
