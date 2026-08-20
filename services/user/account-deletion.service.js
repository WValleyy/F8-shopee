import argon2 from 'argon2';
import mongoose from 'mongoose';

import authConfig from '../../config/auth.js';
import EmailOtpChallenge from '../../models/auth/email-otp-challenge.model.js';
import RefreshRotationGrace from '../../models/auth/refresh-rotation-grace.model.js';
import Order from '../../models/commerce/order.model.js';
import User from '../../models/user/user.model.js';
import { addSeconds } from '../../utils/date.js';
import { requestError } from '../../utils/error/app-error.js';
import {
    revokeAllAuthSessionsInTransaction,
} from '../auth/auth-session.service.js';

async function scheduleAccountDeletion(userId, currentPassword) {
    const user = await User.findOne({
        _id: userId,
        role: 'USER',
        isActive: true,
        purgeAfter: null,
    })
        .select('+passwordHash')
        .lean();

    if (!user)
        throw requestError('USER_NOT_FOUND');

    if (!await argon2.verify(user.passwordHash, currentPassword))
        throw requestError('CURRENT_PASSWORD_INCORRECT');

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const transactionUser = await User.findOne({
                _id: userId,
                role: 'USER',
                isActive: true,
                purgeAfter: null,
            })
                .session(session)
                .lean();

            if (!transactionUser)
                throw requestError('USER_NOT_FOUND');

            if (await hasAccountDeletionBlocker(userId, session))
                throw requestError('ACCOUNT_HAS_OPEN_ORDERS');

            const purgeAfter = addSeconds(
                new Date(),
                authConfig.accountDeletion.purgeDelaySeconds,
            );
            const updateResult = await User.updateOne(
                {
                    _id: userId,
                    role: 'USER',
                    isActive: true,
                    purgeAfter: null,
                    passwordHash: user.passwordHash,
                },
                {
                    $set: {
                        isActive: false,
                        purgeAfter,
                    },
                },
                { session },
            );

            if (updateResult.modifiedCount !== 1)
                throw requestError('CURRENT_PASSWORD_INCORRECT');

            await revokeAllAuthSessionsInTransaction(
                userId,
                'account_deletion_scheduled',
                session,
            );
            await RefreshRotationGrace.deleteMany({ user: userId }, { session });
            await EmailOtpChallenge.deleteMany({ user: userId }, { session });
        });
    } finally {
        await session.endSession();
    }
}

async function hasAccountDeletionBlocker(userId, session = null) {
    const hasOpenOrder = await Order.exists({
        user: userId,
        status: 'SHIPPING',
    }).session(session);

    return Boolean(hasOpenOrder);
}

export {
    scheduleAccountDeletion,
};
