import crypto from 'crypto';
import mongoose from 'mongoose';

import authConfig from '../../config/auth.js';
import AuthSession from '../../models/auth/auth-session.model.js';
import RefreshRotationGrace from '../../models/auth/refresh-rotation-grace.model.js';
import User from '../../models/user/user.model.js';
import { logAppEvent } from '../../utils/error/app-error-logger.js';
import { requestError } from '../../utils/error/app-error.js';
import { addSeconds } from '../../utils/date.js';
import { hashSha256 } from '../../utils/hash.js';
import {
    createAccessToken,
    createRefreshToken,
    decryptGraceToken,
    encryptGraceToken,
    hasRequiredClaims,
    inspectRefreshToken,
} from './auth-token.service.js';
import { sendRefreshTokenReuseAlert } from '../email/email.service.js';

async function validateStrictAccessClaims(claims) {
    if (!hasRequiredClaims(claims, 'access'))
        return null;

    const now = new Date();
    const [user, activeSession] = await Promise.all([
        User.findById(claims.sub)
            .select('_id userName name email phone gender avatar birthday role isVerified isActive')
            .lean(),
        AuthSession.exists({
            sessionId: claims.sid,
            user: claims.sub,
            revokedAt: null,
            idleExpiresAt: { $gt: now },
            absoluteExpiresAt: { $gt: now },
        }),
    ]);

    if (!user || !user.isActive || !activeSession)
        return null;

    return {
        sessionId: claims.sid,
        user,
    };
}

async function createAuthSession(userId, metadata) {
    const { rememberMe, replaceOldest = false } = metadata;

    const sessionId = `session-${crypto.randomUUID()}`;
    const now = new Date();
    const policy = getSessionPolicy(rememberMe);
    const absoluteExpiresAt = addSeconds(now, policy.absoluteTtl);
    const idleExpiresAt = addSeconds(now, policy.idleTtl);
    const refreshTtl = Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000);
    const refreshToken = createRefreshToken(userId, sessionId, refreshTtl);
    const accessToken = createAccessToken(userId, sessionId);

    const mongoSession = await mongoose.startSession();
    let createdSession = null;

    try {
        createdSession = await mongoSession.withTransaction(async () => {
            const lockResult = await User.updateOne(
                { _id: userId, isActive: true },
                { $currentDate: { updatedAt: true } },
                { session: mongoSession },
            );

            if (lockResult.matchedCount !== 1)
                throw createInvalidSessionError('USER_UNAVAILABLE');

            const activeSessionCount = await AuthSession.countDocuments(
                getActiveSessionFilter(userId, now),
            ).session(mongoSession);

            if (activeSessionCount >= authConfig.session.maxActiveSessions) {
                if (!replaceOldest)
                    throw requestError('SESSION_LIMIT_REACHED');

                await revokeOldestActiveSessionsInTransaction(
                    userId,
                    activeSessionCount - authConfig.session.maxActiveSessions + 1,
                    now,
                    mongoSession,
                );
            }

            const [sessionDocument] = await AuthSession.create([{
                sessionId,
                user: userId,
                currentRefreshTokenHash: hashSha256(refreshToken),
                rememberMe,
                lastUsedAt: now,
                idleExpiresAt,
                absoluteExpiresAt,
                userAgent: metadata.userAgent,
                deviceLabel: metadata.deviceLabel,
            }], { session: mongoSession });

            return sessionDocument;
        });
    } finally {
        await mongoSession.endSession();
    }

    return {
        accessToken,
        refreshToken,
        refreshCookieMaxAge: getRefreshCookieMaxAge(createdSession, now),
    };
}

async function listAuthSessions(userId, currentSessionId) {
    const now = new Date();
    const sessions = await AuthSession.find({
        user: userId,
        revokedAt: null,
        idleExpiresAt: { $gt: now },
        absoluteExpiresAt: { $gt: now },
    })
        .select('sessionId deviceLabel userAgent lastUsedAt')
        .sort({ lastUsedAt: -1 })
        .lean();

    return sessions.map(session => ({
        id: session.sessionId,
        current: session.sessionId === currentSessionId,
        deviceLabel: session.deviceLabel,
        userAgent: session.userAgent,
        lastUsedAt: session.lastUsedAt,
    }));
}

async function revokeAuthSessionById(sessionId, userId, reason) {
    const revoked = await revokeAuthSessionBySelector(
        { sessionId, user: userId },
        reason,
    );

    if (!revoked)
        throw requestError('SESSION_NOT_FOUND');
}

async function revokeAllAuthSessionsInTransaction(userId, reason, mongoSession) {
    const now = new Date();

    await AuthSession.updateMany(
        { user: userId, revokedAt: null },
        { $set: { revokedAt: now, revokeReason: reason } },
        { session: mongoSession },
    );
}

async function logoutAuthSession(refreshToken, userId, sessionId) {
    const revokedByRefresh = await revokeAuthSessionByToken(refreshToken);

    if (!revokedByRefresh && userId && sessionId) {
        await revokeAuthSessionBySelector(
            { sessionId, user: userId },
            'logout',
        );
    }
}

async function revokeAllAuthSessions(userId) {
    const now = new Date();

    await AuthSession.updateMany(
        { user: userId, revokedAt: null },
        { $set: { revokedAt: now, revokeReason: 'logout_all' } },
    );
}

async function revokeOtherAuthSessionsInTransaction(userId, currentSessionId, reason, session) {
    const now = new Date();

    await AuthSession.updateMany(
        {
            user: userId,
            sessionId: { $ne: currentSessionId },
            revokedAt: null,
        },
        { $set: { revokedAt: now, revokeReason: reason } },
        { session },
    );
}

async function refreshAccessToken(refreshToken, metadata) {
    const inspected = inspectRefreshToken(refreshToken);

    if (inspected.status === 'expired') {
        const expiredSession = await AuthSession.findOne({
            sessionId: inspected.claims.sid,
            user: inspected.claims.sub,
        }).lean();
        const now = new Date();

        if (expiredSession && new Date(expiredSession.absoluteExpiresAt) <= now)
            throw createInvalidSessionError('SESSION_ABSOLUTE_EXPIRED');

        if (expiredSession && new Date(expiredSession.idleExpiresAt) <= now)
            throw createInvalidSessionError('SESSION_IDLE_EXPIRED');

        throw createInvalidSessionError('REFRESH_TOKEN_EXPIRED');
    }

    if (inspected.status !== 'valid')
        throw createInvalidSessionError('REFRESH_TOKEN_INVALID');

    const claims = inspected.claims;
    const now = new Date();
    const tokenHash = hashSha256(refreshToken);
    const sessionDocument = await AuthSession.findOne({
        sessionId: claims.sid,
        user: claims.sub,
    }).lean();

    if (!sessionDocument)
        throw createInvalidSessionError('SESSION_REVOKED');

    if (sessionDocument.revokedAt)
        throw createInvalidSessionError('SESSION_REVOKED');

    if (new Date(sessionDocument.absoluteExpiresAt) <= now)
        throw createInvalidSessionError('SESSION_ABSOLUTE_EXPIRED');

    if (new Date(sessionDocument.idleExpiresAt) <= now)
        throw createInvalidSessionError('SESSION_IDLE_EXPIRED');

    if (sessionDocument.currentRefreshTokenHash !== tokenHash) {
        const graceState = await readRefreshGrace(claims, tokenHash);

        if (graceState)
            return graceState;

        await AuthSession.updateOne(
            { _id: sessionDocument._id, revokedAt: null },
            {
                $set: {
                    revokedAt: now,
                    revokeReason: 'refresh_token_reused',
                },
            },
        );
        await logAppEvent('auth:refresh-token-reused', 'warning', {
            sessionId: sessionDocument.sessionId,
            userId: String(sessionDocument.user),
        });
        await sendReuseAlertBestEffort(
            sessionDocument.user,
            sessionDocument.sessionId,
            metadata,
        );
        throw createInvalidSessionError('REFRESH_TOKEN_REUSED');
    }

    const user = await getActiveSessionUser(claims.sub);

    if (!user)
        throw createInvalidSessionError('SESSION_REVOKED');

    const policy = getSessionPolicy(sessionDocument.rememberMe);
    const nextIdleExpiresAt = new Date(Math.min(
        addSeconds(now, policy.idleTtl).getTime(),
        new Date(sessionDocument.absoluteExpiresAt).getTime(),
    ));
    const refreshTtl = Math.max(
        1,
        Math.floor((new Date(sessionDocument.absoluteExpiresAt).getTime() - now.getTime()) / 1000),
    );
    const nextRefreshToken = createRefreshToken(
        user._id,
        sessionDocument.sessionId,
        refreshTtl,
    );
    const nextAccessToken = createAccessToken(
        user._id,
        sessionDocument.sessionId,
    );
    const graceExpiresAt = addSeconds(now, authConfig.session.refreshGraceTtlSeconds);
    const nextSessionState = {
        ...sessionDocument,
        idleExpiresAt: nextIdleExpiresAt,
    };
    const refreshCookieMaxAge = getRefreshCookieMaxAge(nextSessionState, now);
    const mongoSession = await mongoose.startSession();
    let transactionResult = null;

    try {
        transactionResult = await mongoSession.withTransaction(async () => {
            const updateResult = await AuthSession.updateOne(
                {
                    _id: sessionDocument._id,
                    currentRefreshTokenHash: tokenHash,
                    revokedAt: null,
                    idleExpiresAt: { $gt: now },
                    absoluteExpiresAt: { $gt: now },
                },
                {
                    $set: {
                        currentRefreshTokenHash: hashSha256(nextRefreshToken),
                        lastUsedAt: now,
                        idleExpiresAt: nextIdleExpiresAt,
                    },
                },
                { session: mongoSession },
            );

            if (updateResult.modifiedCount !== 1)
                return { rotated: false };

            await RefreshRotationGrace.create([{
                sessionId: sessionDocument.sessionId,
                user: sessionDocument.user,
                oldRefreshTokenHash: tokenHash,
                encryptedAccessToken: encryptGraceToken(nextAccessToken),
                encryptedRefreshToken: encryptGraceToken(nextRefreshToken),
                rememberMe: sessionDocument.rememberMe,
                refreshCookieMaxAge: refreshCookieMaxAge ?? null,
                expiresAt: graceExpiresAt,
            }], { session: mongoSession });

            return { rotated: true };
        });
    } finally {
        await mongoSession.endSession();
    }

    if (!transactionResult?.rotated) {
        const graceState = await readRefreshGrace(claims, tokenHash);

        if (graceState)
            return graceState;

        throw createInvalidSessionError('REFRESH_ROTATION_CONFLICT');
    }

    return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        refreshCookieMaxAge,
    };
}

function createInvalidSessionError(reason, context = {}) {
    return requestError('SESSION_INVALID', {
        context: {
            sessionReason: reason,
            ...context,
        },
    });
}

function getSessionPolicy(rememberMe) {
    return rememberMe
        ? {
            idleTtl: authConfig.session.rememberIdleTtlSeconds,
            absoluteTtl: authConfig.session.rememberAbsoluteTtlSeconds,
        }
        : {
            idleTtl: authConfig.session.sessionIdleTtlSeconds,
            absoluteTtl: authConfig.session.sessionAbsoluteTtlSeconds,
        };
}

function getRefreshCookieMaxAge(session, now) {
    if (!session.rememberMe)
        return undefined;

    const expiresAt = Math.min(
        new Date(session.idleExpiresAt).getTime(),
        new Date(session.absoluteExpiresAt).getTime(),
    );

    return Math.max(0, Math.floor((expiresAt - now.getTime()) / 1000));
}

async function getActiveSessionUser(userId) {
    return User.findOne({ _id: userId, isActive: true })
        .select('_id')
        .lean();
}

function getActiveSessionFilter(userId, now) {
    return {
        user: userId,
        revokedAt: null,
        idleExpiresAt: { $gt: now },
        absoluteExpiresAt: { $gt: now },
    };
}

async function revokeOldestActiveSessionsInTransaction(
    userId,
    count,
    now,
    session,
) {
    if (count < 1)
        return;

    const sessions = await AuthSession.find(getActiveSessionFilter(userId, now))
        .sort({ lastUsedAt: 1, createdAt: 1 })
        .limit(count)
        .select('sessionId')
        .session(session)
        .lean();

    if (!sessions.length)
        return;

    const sessionIds = sessions.map(item => item.sessionId);

    await AuthSession.updateMany(
        {
            sessionId: { $in: sessionIds },
            revokedAt: null,
        },
        {
            $set: {
                revokedAt: now,
                revokeReason: 'session_limit_replaced',
            },
        },
        { session },
    );
}

async function revokeAuthSessionByToken(refreshToken) {
    const inspected = inspectRefreshToken(refreshToken);

    if (inspected.status !== 'valid')
        return false;

    return revokeAuthSessionBySelector(
        {
            sessionId: inspected.claims.sid,
            user: inspected.claims.sub,
        },
        'logout',
    );
}

async function readRefreshGrace(claims, tokenHash) {
    const now = new Date();
    const grace = await RefreshRotationGrace.findOne({
        sessionId: claims.sid,
        oldRefreshTokenHash: tokenHash,
        expiresAt: { $gt: now },
    }).lean();

    if (!grace)
        return null;

    const session = await AuthSession.findOne({
        sessionId: claims.sid,
        user: claims.sub,
        revokedAt: null,
        idleExpiresAt: { $gt: now },
        absoluteExpiresAt: { $gt: now },
    }).lean();

    if (!session)
        return null;

    const user = await getActiveSessionUser(claims.sub);

    if (!user)
        return null;

    return {
        accessToken: decryptGraceToken(grace.encryptedAccessToken),
        refreshToken: decryptGraceToken(grace.encryptedRefreshToken),
        refreshCookieMaxAge: grace.refreshCookieMaxAge ?? undefined,
    };
}

async function revokeAuthSessionBySelector(selector, reason) {
    const revokedSession = await AuthSession.findOneAndUpdate(
        {
            ...selector,
            revokedAt: null,
        },
        {
            $set: {
                revokedAt: new Date(),
                revokeReason: reason,
            },
        },
        {
            projection: { _id: 1 },
            returnDocument: 'after',
        },
    ).lean();

    return Boolean(revokedSession);
}

async function sendReuseAlertBestEffort(userId, sessionId, metadata) {
    try {
        const user = await User.findById(userId)
            .select('name email')
            .lean();

        if (user)
            await sendRefreshTokenReuseAlert(user, metadata);
    } catch (error) {
        await logAppEvent('refresh-token-reuse-email-failed', 'warning', {
            sessionId,
            userId: userId.toString(),
            error: error?.message || String(error),
        });
    }
}

export {
    createAuthSession,
    listAuthSessions,
    logoutAuthSession,
    refreshAccessToken,
    revokeAllAuthSessions,
    revokeAllAuthSessionsInTransaction,
    revokeAuthSessionById,
    revokeOtherAuthSessionsInTransaction,
    validateStrictAccessClaims,
};
