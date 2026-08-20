import mongoose from 'mongoose';

import paginationConfig from '../../../config/pagination.js';
import Order from '../../../models/commerce/order.model.js';
import OrderReturnRequest from '../../../models/commerce/order-return-request.model.js';
import User from '../../../models/user/user.model.js';
import { buildPagination } from '../../../utils/pagination.js';
import { escapeRegex } from '../../../utils/regex.js';
import {
    listAllowedOrderActions,
} from '../../commerce/order/order-policy.js';

async function listAdminOrdersPage(options = {}) {
    const {
        q = '',
        status = 'all',
        page = 1,
    } = options;
    const matchQuery = {};

    if (status !== 'all')
        if (status === 'REFUNDED') {
            const refundedOrderIds = await OrderReturnRequest.distinct('order', {
                amount: { $gt: 0 },
            });

            matchQuery.status = 'COMPLETED';
            matchQuery._id = { $in: refundedOrderIds };
        } else {
            matchQuery.status = status;
        }

    if (q) {
        const regex = new RegExp(escapeRegex(q), 'i');
        const matchedUsers = await User.find({
            $or: [{ name: regex }, { email: regex }, { phone: regex }],
        }).select('_id').lean();
        const userIds = matchedUsers.map(user => user._id);

        matchQuery.$or = [
            { 'items.productName': regex },
            ...(userIds.length ? [{ user: { $in: userIds } }] : []),
            ...(mongoose.Types.ObjectId.isValid(q)
                ? [{ _id: new mongoose.Types.ObjectId(q) }]
                : []),
        ];
    }

    const totalItems = await Order.countDocuments(matchQuery);
    const pagination = buildPagination({
        page,
        limit: paginationConfig.admin,
        totalItems,
    });
    const orders = await Order
        .find(matchQuery)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * paginationConfig.admin)
        .limit(paginationConfig.admin)
        .lean();
    const returnRequests = await OrderReturnRequest.find({
        order: { $in: orders.map(order => order._id) },
    })
        .select('order items amount createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const returnsByOrderId = new Map();

    returnRequests.forEach(returnRequest => {
        const orderId = returnRequest.order.toString();
        const returns = returnsByOrderId.get(orderId) || [];

        returns.push({
            items: returnRequest.items.map(item => ({
                productName: item.productName,
                image: item.image,
                options: item.options,
                quantity: item.quantity,
                price: item.amount,
            })),
            amount: returnRequest.amount,
            createdAt: returnRequest.createdAt,
        });
        returnsByOrderId.set(orderId, returns);
    });

    return {
        orders: orders.map(order => toAdminOrderViewModel(
            order,
            returnsByOrderId.get(order._id.toString()) || [],
        )),
        filters: { q, status },
        pagination,
    };
}

function orderActions(status) {
    return listAllowedOrderActions(status, 'ADMIN');
}

function toAdminOrderViewModel(order, returns = []) {
    return {
        id: order._id.toString(),
        userName: order.user?.name ?? null,
        userEmail: order.user?.email || '',
        itemCount: order.items.reduce(
            (sum, item) => sum + item.quantity,
            0,
        ),
        items: order.items.map(item => ({
            productName: item.productName,
            image: item.image,
            options: item.options,
            quantity: item.quantity,
            price: item.price,
        })),
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        returnTotal: returns.reduce(
            (sum, returnEntry) => sum + returnEntry.amount,
            0,
        ),
        status: order.status,
        createdAt: order.createdAt,
        returns,
        actions: orderActions(order.status),
    };
}

export {
    listAdminOrdersPage,
};
