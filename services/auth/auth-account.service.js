import argon2 from 'argon2';
import crypto from 'crypto';
import mongoose from 'mongoose';

import inputLimits from '../../config/input-limits.js';
import EmailOtpChallenge from '../../models/auth/email-otp-challenge.model.js';
import User from '../../models/user/user.model.js';
import { logAppEvent } from '../../utils/error/app-error-logger.js';
import {
    incidentError,
    isAppErrorCode,
    requestError,
} from '../../utils/error/app-error.js';
import {
    sendEmailChangedAlert,
    sendOtpEmail,
} from '../email/email.service.js';
import { createNotification } from '../user/notification.service.js';
import {
    getUserByEmailWithPassword,
} from '../user/profile.service.js';
import {
    checkOtpSendRateLimit,
    getOtpChallenge,
    issueOtpChallenge,
    verifyOtpCode,
} from './auth-otp.service.js';
import {
    createAuthSession,
    revokeAllAuthSessionsInTransaction,
    revokeOtherAuthSessionsInTransaction,
} from './auth-session.service.js';

async function registerUser(data, sessionMetadata) {
    let createdUser = null;

    try {
        createdUser = await User.create({
            userName: createDefaultUserName(data.email),
            name: data.name,
            email: data.email,
            passwordHash: await argon2.hash(data.password),
        });
    } catch (error) {
        if (error?.code === 11000)
            throw requestError('EMAIL_ALREADY_EXISTS', { cause: error });

        throw error;
    }

    let authSession = null;

    try {
        authSession = await createAuthSession(createdUser._id, sessionMetadata);
    } catch (error) {
        if (!isAppErrorCode(error, 'SESSION_LIMIT_REACHED')) {
            await logAppEvent('register-session-creation-failed', 'error', {
                userId: createdUser._id.toString(),
                error: error?.message || String(error),
            });
        }
    }

    await createEmailVerificationNotificationBestEffort(createdUser._id);

    return authSession;
}

async function loginUser(email, password, sessionMetadata) {
    const user = await getUserByEmailWithPassword(email);

    if (!user || !user.isActive)
        throw requestError('INVALID_CREDENTIALS');

    if (!await argon2.verify(user.passwordHash, password))
        throw requestError('INVALID_CREDENTIALS');

    const lastLoginAt = new Date();
    await User.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt } },
    );

    return createAuthSession(user._id, sessionMetadata);
}

async function changeUserPassword(userId, currentPassword, nextPassword) {
    const user = await User
        .findOne({
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
    if (currentPassword === nextPassword)
        throw requestError('NEW_PASSWORD_MUST_DIFFER');

    const nextPasswordHash = await argon2.hash(nextPassword);
    const mongoSession = await mongoose.startSession();

    try {
        await mongoSession.withTransaction(async () => {
            const updateResult = await User.updateOne(
                {
                    _id: userId,
                    role: 'USER',
                    isActive: true,
                    purgeAfter: null,
                    passwordHash: user.passwordHash,
                },
                { $set: { passwordHash: nextPasswordHash } },
                { session: mongoSession },
            );

            if (updateResult.modifiedCount !== 1)
                throw requestError('CURRENT_PASSWORD_INCORRECT');

            await revokeAllAuthSessionsInTransaction(
                userId,
                'password_changed',
                mongoSession,
            );
        });
    } finally {
        await mongoSession.endSession();
    }
}

async function requestEmailVerificationOtp(userId) {
    const user = await User.findById(userId).lean();

    if (!user || !user.isActive)
        throw requestError('USER_NOT_FOUND');

    if (user.isVerified)
        return null;

    const rateLimit = await checkOtpSendRateLimit(userId, 'VERIFY_EMAIL');

    if (!rateLimit.allowed) {
        throw requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        });
    }

    const challenge = await issueOtpChallenge(userId, 'VERIFY_EMAIL');
    await sendOtpEmail(
        toOtpEmailRecipient(user),
        'VERIFY_EMAIL',
        challenge.otp,
    );

    return { challengeId: challenge.challengeId };
}

async function getEmailVerificationOtpStatus(rawChallengeId, userId) {
    const challenge = await getOtpChallenge(
        rawChallengeId,
        'VERIFY_EMAIL',
        userId,
    );

    return { active: Boolean(challenge) };
}

async function verifyEmailOtp(rawChallengeId, otp, expectedUserId) {
    const { challenge: verifiedChallenge } = await verifyOtpCode(
        rawChallengeId,
        'VERIFY_EMAIL',
        otp,
        expectedUserId,
    );
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const now = new Date();
            const challenge = await EmailOtpChallenge.findOneAndUpdate(
                {
                    _id: verifiedChallenge._id,
                    user: expectedUserId,
                    verifiedAt: { $ne: null },
                    usedAt: null,
                    expiresAt: { $gt: now },
                },
                { $set: { usedAt: now } },
                { returnDocument: 'after', session },
            ).lean();

            if (!challenge)
                throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

            const user = await User.findOneAndUpdate(
                { _id: expectedUserId, isActive: true },
                { $set: { isVerified: true } },
                { returnDocument: 'after', session },
            ).lean();

            if (!user)
                throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

        });
    } finally {
        await session.endSession();
    }
}

async function requestEmailChange(userId, currentPassword, targetEmail) {
    const user = await User
        .findOne({
            _id: userId,
            role: 'USER',
            isActive: true,
            purgeAfter: null,
        })
        .select('+passwordHash')
        .lean();

    if (!user)
        throw requestError('USER_NOT_FOUND');

    if (!user.isVerified)
        throw requestError('EMAIL_VERIFICATION_REQUIRED');

    if (!await argon2.verify(user.passwordHash, currentPassword))
        throw requestError('CURRENT_PASSWORD_INCORRECT');

    const existingUser = await User.exists({
        email: targetEmail,
        _id: { $ne: userId },
    });

    if (existingUser)
        throw requestError('EMAIL_ALREADY_EXISTS');

    if (targetEmail === user.email)
        throw requestError('NEW_EMAIL_MUST_DIFFER');

    const rateLimit = await checkOtpSendRateLimit(userId, 'CHANGE_EMAIL');

    if (!rateLimit.allowed) {
        throw requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        });
    }

    const challenge = await issueOtpChallenge(
        userId,
        'CHANGE_EMAIL',
        { targetEmail },
    );

    try {
        await sendOtpEmail(
            {
                ...toOtpEmailRecipient(user),
                targetEmail,
            },
            'CHANGE_EMAIL',
            challenge.otp,
        );
    } catch (error) {
        throw incidentError(
            'Unable to send the confirmation email. Please try again later.',
            {
                statusCode: 503,
                cause: error,
                context: {
                    userId: userId.toString(),
                    targetEmail,
                },
            },
        );
    }

    return { challengeId: challenge.challengeId };
}

async function getEmailChangeOtpStatus(rawChallengeId, userId) {
    const challenge = await getOtpChallenge(
        rawChallengeId,
        'CHANGE_EMAIL',
        userId,
    );

    return {
        active: Boolean(challenge),
        targetEmail: challenge?.targetEmail || '',
    };
}

async function resendEmailChangeOtp(userId, rawChallengeId) {
    const challenge = await getOtpChallenge(
        rawChallengeId,
        'CHANGE_EMAIL',
        userId,
    );

    if (!challenge)
        throw requestError('VERIFICATION_CODE_EXPIRED');

    const rateLimit = await checkOtpSendRateLimit(userId, 'CHANGE_EMAIL');

    if (!rateLimit.allowed) {
        throw requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        });
    }

    const user = await User.findOne({
        _id: userId,
        role: 'USER',
        isActive: true,
        purgeAfter: null,
    }).lean();

    if (!user)
        throw requestError('VERIFICATION_CODE_EXPIRED');

    const nextChallenge = await issueOtpChallenge(
        userId,
        'CHANGE_EMAIL',
        { targetEmail: challenge.targetEmail },
    );
    await sendOtpEmail(
        {
            ...toOtpEmailRecipient(user),
            targetEmail: challenge.targetEmail,
        },
        'CHANGE_EMAIL',
        nextChallenge.otp,
    );

    return { challengeId: nextChallenge.challengeId };
}

async function confirmEmailChangeWithOtp(
    rawChallengeId,
    otp,
    expectedUserId,
    currentSessionId,
) {
    const { challenge: verifiedChallenge } = await verifyOtpCode(
        rawChallengeId,
        'CHANGE_EMAIL',
        otp,
        expectedUserId,
    );
    const session = await mongoose.startSession();
    let emailChange = null;

    try {
        emailChange = await session.withTransaction(async () => {
            const challenge = await EmailOtpChallenge.findOne({
                _id: verifiedChallenge._id,
                user: expectedUserId,
                verifiedAt: { $ne: null },
                usedAt: null,
                expiresAt: { $gt: new Date() },
            }).session(session);

            if (!challenge)
                throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

            const user = await User.findOne({
                _id: expectedUserId,
                role: 'USER',
                isActive: true,
                purgeAfter: null,
            }).session(session);

            if (!user || !challenge.targetEmail)
                throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

            const duplicate = await User.exists({
                email: challenge.targetEmail,
                _id: { $ne: user._id },
            }).session(session);

            if (duplicate)
                throw requestError('EMAIL_ALREADY_EXISTS');

            const oldEmail = user.email;
            user.email = challenge.targetEmail;
            user.isVerified = true;
            await user.save({ session });

            await revokeOtherAuthSessionsInTransaction(
                user._id,
                currentSessionId,
                'email_changed',
                session,
            );

            challenge.usedAt = new Date();
            await challenge.save({ session });

            return {
                emailChangeId: challenge._id.toString(),
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                },
                oldEmail,
            };
        });
    } catch (error) {
        if (error?.code === 11000)
            throw requestError('EMAIL_ALREADY_EXISTS', { cause: error });

        throw error;
    } finally {
        await session.endSession();
    }

    try {
        await sendEmailChangedAlert(
            emailChange.user,
            emailChange.oldEmail,
        );
    } catch (error) {
        await logAppEvent('email-changed-alert-failed', 'warning', {
            userId: emailChange.user._id.toString(),
            error: error?.message || String(error),
        });
    }
}

async function requestPasswordReset(email) {
    const user = await User.findOne({ email }).lean();

    if (!user || !user.isActive)
        throw requestError('ACCOUNT_NOT_FOUND');

    const rateLimit = await checkOtpSendRateLimit(
        user._id.toString(),
        'RESET_PASSWORD',
    );

    if (!rateLimit.allowed) {
        throw requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        });
    }

    const challenge = await issueOtpChallenge(
        user._id,
        'RESET_PASSWORD',
        {
            emailSnapshot: user.email,
        },
    );
    await sendOtpEmail(
        toOtpEmailRecipient(user),
        'RESET_PASSWORD',
        challenge.otp,
    );

    return { challengeId: challenge.challengeId };
}

async function resendPasswordResetOtp(rawChallengeId) {
    const challenge = await getOtpChallenge(
        rawChallengeId,
        'RESET_PASSWORD',
    );

    if (!challenge)
        throw requestError('VERIFICATION_CODE_EXPIRED_REQUEST_NEW');

    const rateLimit = await checkOtpSendRateLimit(
        challenge.user.toString(),
        'RESET_PASSWORD',
    );

    if (!rateLimit.allowed) {
        throw requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        });
    }

    const user = await User.findById(challenge.user).lean();

    if (!user || !user.isActive)
        throw requestError('VERIFICATION_CODE_EXPIRED_REQUEST_NEW');

    const nextChallenge = await issueOtpChallenge(
        user._id,
        'RESET_PASSWORD',
        {
            emailSnapshot: user.email,
        },
    );
    await sendOtpEmail(
        toOtpEmailRecipient(user),
        'RESET_PASSWORD',
        nextChallenge.otp,
    );

    return { challengeId: nextChallenge.challengeId };
}

async function resetPasswordWithOtp(rawChallengeId, nextPassword) {
    if (!rawChallengeId)
        throw requestError('PASSWORD_RESET_SESSION_INVALID');

    const verifiedChallenge = await getOtpChallenge(
        rawChallengeId,
        'RESET_PASSWORD',
    );

    if (!verifiedChallenge?.verifiedAt)
        throw requestError('PASSWORD_RESET_SESSION_INVALID');

    const nextPasswordHash = await argon2.hash(nextPassword);
    const session = await mongoose.startSession();
    let errorCode = '';

    try {
        errorCode = await session.withTransaction(async () => {
            const challenge = await EmailOtpChallenge.findOne({
                _id: verifiedChallenge._id,
                purpose: 'RESET_PASSWORD',
                verifiedAt: { $ne: null },
                usedAt: null,
                expiresAt: { $gt: new Date() },
            }).session(session);

            if (!challenge)
                return 'PASSWORD_RESET_SESSION_INVALID';

            const user = await User.findOne({
                _id: challenge.user,
                isActive: true,
            }).session(session);

            if (!user)
                return 'PASSWORD_RESET_SESSION_INVALID';

            if (challenge.emailSnapshot !== user.email) {
                challenge.usedAt = new Date();
                await challenge.save({ session });
                return 'USER_EMAIL_CHANGED';
            }

            user.passwordHash = nextPasswordHash;
            await user.save({ session });
            await revokeAllAuthSessionsInTransaction(
                user._id,
                'password_reset',
                session,
            );
            challenge.usedAt = new Date();
            await challenge.save({ session });
            return '';
        });
    } finally {
        await session.endSession();
    }

    if (errorCode)
        throw requestError(errorCode);
}

async function createEmailVerificationNotificationBestEffort(userId) {
    try {
        await createNotification(userId, {
            type: 'EMAIL_VERIFICATION_REQUIRED',
            title: 'Xác minh địa chỉ email',
            description: 'Hãy xác minh địa chỉ email để kích hoạt tài khoản.',
        });
    } catch (error) {
        await logAppEvent(
            'register-email-verification-notification-failed',
            'warning',
            {
                userId: userId.toString(),
                error: error?.message || String(error),
            },
        );
    }
}

function createDefaultUserName(email) {
    const minLength = inputLimits.user.userNameMinLength;
    const maxLength = inputLimits.user.userNameMaxLength;
    const localPart = email
        .split('@')[0]
        .replace(/\s+/g, '')
        .slice(0, maxLength);

    if (localPart.length >= minLength)
        return localPart;

    const suffix = crypto.randomBytes(4).toString('hex');

    return `${localPart}${suffix}`.slice(0, maxLength);
}

function toOtpEmailRecipient(user) {
    return {
        name: user.name,
        email: user.email,
    };
}

export {
    changeUserPassword,
    confirmEmailChangeWithOtp,
    getEmailChangeOtpStatus,
    getEmailVerificationOtpStatus,
    loginUser,
    registerUser,
    requestEmailVerificationOtp,
    requestEmailChange,
    requestPasswordReset,
    resendEmailChangeOtp,
    resendPasswordResetOtp,
    resetPasswordWithOtp,
    verifyEmailOtp,
};
