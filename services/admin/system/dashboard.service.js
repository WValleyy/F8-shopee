import Order from '../../../models/commerce/order.model.js';
import Product from '../../../models/catalog/product.model.js';
import ProductVariant from '../../../models/catalog/product-variant.model.js';
import Review from '../../../models/catalog/review.model.js';
import User from '../../../models/user/user.model.js';
import {
    getRevenueSummary,
} from '../../commerce/order/order-spend.service.js';

async function getAdminDashboard() {
    const [
        productCount,
        orderCount,
        userCount,
        hiddenReviewCount,
        revenueSummary,
        recentOrders,
        lowStockVariants,
    ] = await Promise.all([
        Product.countDocuments({}),
        Order.countDocuments({}),
        User.countDocuments({ role: 'USER' }),
        Review.countDocuments({ isPublished: false }),
        getRevenueSummary(),
        Order.find({})
            .populate('user', 'name email')
            .sort({ createdAt: -1, _id: -1 })
            .limit(6)
            .lean(),
        ProductVariant.aggregate([
            {
                $match: {
                    isPublished: true,
                    stock: { $lte: 5 },
                },
            },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: 'product',
                    foreignField: '_id',
                    as: 'product',
                },
            },
            { $unwind: '$product' },
            { $match: { 'product.isPublished': true } },
            { $sort: { stock: 1, _id: 1 } },
            { $limit: 8 },
            {
                $project: {
                    _id: 0,
                    stock: 1,
                    sku: 1,
                    'product._id': 1,
                    'product.name': 1,
                },
            },
        ]),
    ]);

    return {
        metrics: {
            productCount,
            orderCount,
            userCount,
            hiddenReviewCount,
            grossRevenue: revenueSummary.grossRevenue,
            netRevenue: revenueSummary.netRevenue,
        },
        recentOrders: recentOrders.map(order => ({
            id: order._id.toString(),
            userName: order.user?.name ?? null,
            status: order.status,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
        })),
        lowStockVariants: lowStockVariants.map(variant => ({
            productId: variant.product._id.toString(),
            productName: variant.product.name,
            sku: variant.sku,
            stock: variant.stock,
        })),
    };
}

export { getAdminDashboard };
