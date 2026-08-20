import assert from 'node:assert/strict';
import {
    afterAll as after,
    beforeAll as before,
    beforeEach,
    describe,
    it,
} from 'vitest';
import argon2 from 'argon2';

import authConfig from '../../config/auth.js';
import AuthSession from '../../models/auth/auth-session.model.js';
import RefreshRotationGrace from '../../models/auth/refresh-rotation-grace.model.js';
import User from '../../models/user/user.model.js';
import {
    loginUser,
} from '../../services/auth/auth-account.service.js';
import {
    createAuthSession,
    logoutAuthSession,
    refreshAccessToken,
} from '../../services/auth/auth-session.service.js';
import { inspectAccessToken } from '../../services/auth/auth-token.service.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

describe('authentication integration', { concurrency: false }, () => {
    let user = null;

    before(async () => {
        await connectTestDatabase();
        user = await User.create({
            userName: `auth-test-${Date.now()}`,
            name: 'Auth Test',
            email: `auth-test-${Date.now()}@example.com`,
            passwordHash: await argon2.hash('password123'),
        });
    });

    beforeEach(async () => {
        await AuthSession.deleteMany({ user: user._id });
        await RefreshRotationGrace.deleteMany({ user: user._id });
    });

    after(async () => {
        await AuthSession.deleteMany({ user: user._id });
        await RefreshRotationGrace.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });
        await disconnectTestDatabase();
    });

    it('logs in, rotates refresh token and revokes the session on logout', async () => {
        const session = await loginUser(user.email, 'password123', {
            rememberMe: false,
            userAgent: 'integration-test',
        });
        const tokenState = inspectAccessToken(session.accessToken);
        assert.equal(tokenState.status, 'valid');
        const sessionId = tokenState.claims.sid;
        const rotated = await refreshAccessToken(session.refreshToken, {
            userAgent: 'integration-test',
        });

        assert.notEqual(rotated.refreshToken, session.refreshToken);
        await logoutAuthSession(
            rotated.refreshToken,
            user._id,
            sessionId,
        );

        const stored = await AuthSession.findOne({ sessionId });
        assert.ok(stored.revokedAt);
    });

    it('rejects a session beyond the active-session limit', async () => {
        const metadata = {
            rememberMe: false,
            userAgent: 'integration-test',
        };

        for (let index = 0; index < authConfig.session.maxActiveSessions; index += 1)
            await createAuthSession(user._id, metadata);

        await assert.rejects(
            () => createAuthSession(user._id, metadata),
            error => error?.code === 'SESSION_LIMIT_REACHED',
        );
    });

    it('allows explicit replacement of the oldest active session', async () => {
        const metadata = {
            rememberMe: false,
            userAgent: 'integration-test',
        };

        for (let index = 0; index < authConfig.session.maxActiveSessions; index += 1)
            await createAuthSession(user._id, metadata);

        const oldest = await AuthSession.findOne({
            user: user._id,
            revokedAt: null,
        })
            .sort({ lastUsedAt: 1, createdAt: 1 })
            .lean();

        await createAuthSession(user._id, {
            ...metadata,
            replaceOldest: true,
        });

        assert.equal(
            await AuthSession.countDocuments({
                user: user._id,
                revokedAt: null,
            }),
            authConfig.session.maxActiveSessions,
        );
        assert.ok((await AuthSession.findById(oldest._id)).revokedAt);
    });
});
