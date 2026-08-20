import crypto from 'crypto';
import argon2 from 'argon2';
import mongoose from 'mongoose';

import authConfig from '../../config/auth.js';
import EmailOtpChallenge from '../../models/auth/email-otp-challenge.model.js';
import { requestError } from '../../utils/error/app-error.js';
import { hashSha256 } from '../../utils/hash.js';
import {
    consumeAuthRateLimit,
    createRateLimitScope,
} from './auth-rate-limit.service.js';

async function issueOtpChallenge(userId, purpose, options = {}) {
    // Intentional trade-off: email delivery failure does not roll back an
    // issued challenge or its consumed rate-limit window.
    const {
        targetEmail = '',
        emailSnapshot = '',
    } = options;
    const challengeId = crypto.randomBytes(32).toString('base64url');
    const otp = createOtpCode();
    const otpHash = await argon2.hash(otp);
    const expiresAt = new Date(
        Date.now() + authConfig.otp.ttlSeconds * 1000,
    );
    const session = await mongoose.startSession();
    let challenge = null;

    try {
        challenge = await session.withTransaction(async () => {
            await EmailOtpChallenge.deleteMany(
                { user: userId, purpose, usedAt: null },
                { session },
            );
            const [challenge] = await EmailOtpChallenge.create([{
                challengeIdHash: hashSha256(challengeId),
                user: userId,
                purpose,
                otpHash,
                targetEmail,
                emailSnapshot,
                expiresAt,
            }], { session });

            return challenge.toObject();
        });
    } finally {
        await session.endSession();
    }

    return {
        challengeId,
        otp,
        challengeIdHash: challenge.challengeIdHash,
    };
}

async function getOtpChallenge(rawChallengeId, purpose, expectedUserId = '') {
    if (!rawChallengeId)
        return null;

    const filter = {
        challengeIdHash: hashSha256(rawChallengeId),
        purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() },
    };

    if (expectedUserId)
        filter.user = expectedUserId;

    return EmailOtpChallenge.findOne(filter).lean();
}

async function checkOtpSendRateLimit(identifier, purpose) {
    const cooldown = await consumeAuthRateLimit({
        scope: createRateLimitScope(
            'auth',
            'otp',
            'send',
            'cooldown',
            purpose,
        ),
        identifier,
        limit: 1,
        windowMs: authConfig.otp.resendCooldownSeconds * 1000,
    });

    if (!cooldown.allowed)
        return cooldown;

    return consumeAuthRateLimit({
        scope: createRateLimitScope(
            'auth',
            'otp',
            'send',
            'hourly',
            purpose,
        ),
        identifier,
        limit: authConfig.otp.resendLimit,
        windowMs: authConfig.otp.resendWindowSeconds * 1000,
    });
}

async function verifyOtpCode(
    rawChallengeId,
    purpose,
    otp,
    expectedUserId = '',
) {
    const challenge = await getOtpChallenge(
        rawChallengeId,
        purpose,
        expectedUserId,
    );

    if (!challenge)
        throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

    if (challenge.verifiedAt)
        return { challenge };

    const rateLimit = await checkOtpVerifyRateLimit(challenge.challengeIdHash);

    if (!rateLimit.allowed) {
        throw requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        });
    }

    if (!await argon2.verify(challenge.otpHash, otp))
        throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

    const verifiedAt = new Date();
    const updated = await EmailOtpChallenge.findOneAndUpdate(
        {
            _id: challenge._id,
            ...(expectedUserId ? { user: expectedUserId } : {}),
            usedAt: null,
            verifiedAt: null,
            expiresAt: { $gt: verifiedAt },
        },
        { $set: { verifiedAt } },
        { returnDocument: 'after' },
    ).lean();

    if (!updated)
        throw requestError('VERIFICATION_CODE_INVALID_OR_EXPIRED');

    return { challenge: updated };
}

async function getPasswordResetOtpStatus(rawChallengeId) {
    const challenge = await getOtpChallenge(
        rawChallengeId,
        'RESET_PASSWORD',
    );

    return {
        active: Boolean(challenge),
        verified: Boolean(challenge?.verifiedAt),
    };
}

function createOtpCode() {
    const minimum = 10 ** (authConfig.otp.codeLength - 1);
    const maximum = (10 ** authConfig.otp.codeLength) - 1;

    return String(crypto.randomInt(minimum, maximum + 1));
}

async function checkOtpVerifyRateLimit(challengeIdHash) {
    return consumeAuthRateLimit({
        scope: createRateLimitScope(
            'auth',
            'otp',
            'verify',
            'challenge',
        ),
        identifier: challengeIdHash,
        limit: authConfig.otp.verifyLimit,
        windowMs: authConfig.otp.verifyWindowSeconds * 1000,
    });
}

export {
    checkOtpSendRateLimit,
    getOtpChallenge,
    getPasswordResetOtpStatus,
    issueOtpChallenge,
    verifyOtpCode,
};
