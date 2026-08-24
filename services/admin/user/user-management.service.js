import mongoose from 'mongoose';

import paginationConfig from '../../../config/pagination.js';
import EmailOtpChallenge from '../../../models/auth/email-otp-challenge.model.js';
import RefreshRotationGrace from '../../../models/auth/refresh-rotation-grace.model.js';
import AuthSession from '../../../models/auth/auth-session.model.js';
import Product from '../../../models/catalog/product.model.js';
import Review from '../../../models/catalog/review.model.js';
import Cart from '../../../models/commerce/cart.model.js';
import CheckoutDraft from '../../../models/commerce/checkout-draft.model.js';
import Order from '../../../models/commerce/order.model.js';
import OrderReturnRequest from '../../../models/commerce/order-return-request.model.js';
import UserAddress from '../../../models/user/user-address.model.js';
import UserNotification from '../../../models/user/notification.model.js';
import UserSearchHistory from '../../../models/user/search-history.model.js';
import User from '../../../models/user/user.model.js';
import WishList from '../../../models/user/wish-list.model.js';
import {
    buildCompletedSpendLookupStages,
    emptySpendSummary,
    getCompletedSpendByUserIds,
} from '../../commerce/order/order-spend.service.js';
import { buildPagination } from '../../../utils/pagination.js';
import { requestError } from '../../../utils/error/app-error.js';
import {
    revokeAllAuthSessionsInTransaction,
} from '../../auth/auth-session.service.js';
import { cleanupUploadedImage } from '../../image/cloudinary-image.service.js';
import { escapeRegex } from '../../../utils/regex.js';

const DELETED_CUSTOMER_ADDRESS = Object.freeze({
    fullName: 'Deleted account',
    phone: 'N/A',
    province: 'N/A',
    ward: 'N/A',
    detail: 'N/A',
});

const USER_MANAGEMENT_LIST_PROJECTION = Object.freeze({
    name: 1,
    userName: 1,
    email: 1,
    avatar: 1,
    role: 1,
    isActive: 1,
    purgeAfter: 1,
    isVerified: 1,
    createdAt: 1,
    lastLoginAt: 1,
    grossSpend: 1,
    netSpend: 1,
});

async function listUsersPage(options = {}) {
    const {
        q = '',
        status = 'all',
        role = 'all',
        minimumSpend = null,
        maximumSpend = null,
        page = 1,
    } = options;
    const filters = { q, status, role, minimumSpend, maximumSpend };

    const query = {};

    if (q) {
        const pattern = new RegExp(escapeRegex(q), 'i');
        query.$or = [{ name: pattern }, { userName: pattern }, { email: pattern }];
    }

    if (status === 'active') {
        query.isActive = true;
        query.purgeAfter = null;
    } else if (status === 'blocked') {
        query.isActive = false;
        query.purgeAfter = null;
    } else if (status === 'pending-deletion') {
        query.purgeAfter = { $ne: null };
    }

    if (role !== 'all')
        query.role = role;

    const hasSpendFilter = minimumSpend != null || maximumSpend != null;
    const spendMatch = {};
    if (minimumSpend != null)
        spendMatch.$gte = minimumSpend;
    if (maximumSpend != null)
        spendMatch.$lte = maximumSpend;

    const state = hasSpendFilter
        ? await listUsersWithSpendFilter(query, spendMatch, page)
        : await listUsersWithoutSpendFilter(query, page);

    return {
        users: state.users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            userName: user.userName,
            email: user.email,
            avatar: user.avatar || '',
            role: user.role,
            isActive: user.isActive !== false,
            purgeAfter: user.purgeAfter || null,
            canPurge: Boolean(
                user.purgeAfter
                && new Date(user.purgeAfter).getTime() <= Date.now()
            ),
            isVerified: Boolean(user.isVerified),
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            grossSpend: user.grossSpend,
            netSpend: user.netSpend,
        })),
        filters,
        pagination: state.pagination,
    };
}

async function setUserActive(userId, isActive) {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const user = await User.findById(userId)
                .select('_id role purgeAfter')
                .session(session)
                .lean();

            // A scheduled deletion is terminal; this path must not reactivate it.
            if (!user || user.purgeAfter)
                throw requestError('USER_NOT_FOUND');

            if (user.role !== 'USER')
                throw requestError('CANNOT_CHANGE_ADMIN_STATUS');

            const updateResult = await User.updateOne(
                { _id: userId, role: 'USER', purgeAfter: null },
                { $set: { isActive } },
                { session },
            );

            if (updateResult.matchedCount !== 1)
                throw requestError('USER_NOT_FOUND');

            if (isActive)
                return;

            await revokeAllAuthSessionsInTransaction(
                userId,
                'admin_blocked',
                session,
            );
            await RefreshRotationGrace.deleteMany({ user: userId }, { session });
        });
    } finally {
        await session.endSession();
    }
}

async function purgeUserAccount(userId, actingAdminId) {
    if (String(userId) === String(actingAdminId))
        throw requestError('CANNOT_PURGE_CURRENT_ADMIN');

    const now = new Date();
    const user = await User.findById(userId)
        .select('avatarPublicId isActive purgeAfter')
        .lean();

    if (!user)
        throw requestError('USER_NOT_FOUND');

    if (!user.purgeAfter)
        throw requestError('ACCOUNT_DELETION_NOT_SCHEDULED');

    if (user.isActive || new Date(user.purgeAfter) > now) {
        throw requestError('ACCOUNT_PURGE_NOT_READY', {
            context: { purgeAfter: user.purgeAfter },
        });
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const transactionUser = await User.findOne({
                _id: userId,
                isActive: false,
                purgeAfter: { $ne: null, $lte: new Date() },
            })
                .select('name email phone')
                .session(session)
                .lean();

            if (!transactionUser)
                throw requestError('ACCOUNT_PURGE_NOT_READY');

            const customerDeletedAt = new Date();

            const wishListItems = await WishList.find({ user: userId })
                .select('product')
                .session(session)
                .lean();
            const likeOperations = wishListItems.map(item => ({
                updateOne: {
                    filter: { _id: item.product },
                    update: [
                        {
                            $set: {
                                likes: {
                                    $max: [
                                        0,
                                        {
                                            $subtract: [
                                                { $ifNull: ['$likes', 0] },
                                                1,
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
            }));

            if (likeOperations.length)
                await Product.bulkWrite(likeOperations, { session });

            await AuthSession.deleteMany({ user: userId }, { session });
            await RefreshRotationGrace.deleteMany({ user: userId }, { session });
            await EmailOtpChallenge.deleteMany({ user: userId }, { session });
            await Cart.deleteMany({ user: userId }, { session });
            await CheckoutDraft.deleteMany({ user: userId }, { session });
            await Order.updateMany(
                { user: userId },
                [
                    {
                        $set: {
                            user: null,
                            customerDeletedAt,
                            shippingAddress: DELETED_CUSTOMER_ADDRESS,
                            note: '',
                            updatedAt: customerDeletedAt,
                        },
                    },
                ],
                {
                    session,
                    updatePipeline: true,
                },
            );
            await OrderReturnRequest.updateMany(
                { user: userId },
                [
                    {
                        $set: {
                            user: null,
                            updatedAt: customerDeletedAt,
                        },
                    },
                ],
                {
                    session,
                    updatePipeline: true,
                },
            );
            await Review.updateMany(
                { user: userId },
                {
                    $set: {
                        user: null,
                        authorDeletedAt: customerDeletedAt,
                    },
                },
                { session },
            );
            await Review.updateMany(
                { likedBy: userId },
                { $pull: { likedBy: userId } },
                { session },
            );
            await UserAddress.deleteMany({ user: userId }, { session });
            await UserNotification.deleteMany({ user: userId }, { session });
            await UserSearchHistory.deleteMany({ user: userId }, { session });
            await WishList.deleteMany({ user: userId }, { session });
            const deleteResult = await User.deleteOne(
                {
                    _id: userId,
                    isActive: false,
                    purgeAfter: { $ne: null, $lte: new Date() },
                },
                { session },
            );

            if (deleteResult.deletedCount !== 1)
                throw requestError('USER_NOT_FOUND');
        });
    } finally {
        await session.endSession();
    }

    if (user.avatarPublicId) {
        await cleanupUploadedImage(
            user.avatarPublicId,
            'purged-account-avatar-cleanup-failed',
        );
    }
}

async function listUsersWithoutSpendFilter(query, page) {
    const totalItems = await User.countDocuments(query);
    const pagination = buildPagination({
        page,
        limit: paginationConfig.admin,
        totalItems,
    });
    const users = await User
        .find(query)
        .select([
            'name',
            'userName',
            'email',
            'avatar',
            'role',
            'isActive',
            'purgeAfter',
            'isVerified',
            'createdAt',
            'lastLoginAt',
        ])
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * paginationConfig.admin)
        .limit(paginationConfig.admin)
        .lean();
    const spendByUserId = await getCompletedSpendByUserIds(
        users.map(user => user._id),
    );

    return {
        users: users.map(user => ({
            ...user,
            ...(spendByUserId.get(user._id.toString()) || emptySpendSummary()),
        })),
        pagination,
    };
}

async function listUsersWithSpendFilter(query, spendMatch, page) {
    const requestedPage = Math.max(1, Number(page) || 1);
    const basePipeline = [
        { $match: query },
        ...buildCompletedSpendLookupStages(),
        { $match: { netSpend: spendMatch } },
    ];
    const [result = {}] = await User.aggregate([
        ...basePipeline,
        {
            $facet: {
                metadata: [{ $count: 'totalItems' }],
                users: [
                    { $sort: { createdAt: -1, _id: -1 } },
                    { $skip: (requestedPage - 1) * paginationConfig.admin },
                    { $limit: paginationConfig.admin },
                    { $project: USER_MANAGEMENT_LIST_PROJECTION },
                ],
            },
        },
    ]);
    const totalItems = result.metadata?.[0]?.totalItems ?? 0;
    const pagination = buildPagination({
        page: requestedPage,
        limit: paginationConfig.admin,
        totalItems,
    });
    let users = result.users || [];

    if (totalItems && pagination.page !== requestedPage) {
        users = await User.aggregate([
            ...basePipeline,
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: (pagination.page - 1) * paginationConfig.admin },
            { $limit: paginationConfig.admin },
            { $project: USER_MANAGEMENT_LIST_PROJECTION },
        ]);
    }

    return { users, pagination };
}

export {
    listUsersPage,
    purgeUserAccount,
    setUserActive,
};
