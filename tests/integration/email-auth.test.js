import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
    afterEach,
    afterAll as after,
    beforeAll as before,
    beforeEach,
    describe,
    it,
    vi,
} from 'vitest';
import argon2 from 'argon2';
import mongoose from 'mongoose';

const emailMocks = vi.hoisted(() => ({
    sendEmailChangedAlert: vi.fn(),
    sendOtpEmail: vi.fn(),
}));

vi.mock('../../services/email/email.service.js', () => emailMocks);

import {
    confirmEmailChangeWithOtp,
    requestEmailChange,
    resetPasswordWithOtp,
    verifyEmailOtp,
} from '../../services/auth/auth-account.service.js';
import { getUserByEmailWithPassword } from '../../services/user/profile.service.js';
import {
    issueOtpChallenge,
    verifyOtpCode,
} from '../../services/auth/auth-otp.service.js';
import EmailOtpChallenge from '../../models/auth/email-otp-challenge.model.js';
import AuthSession from '../../models/auth/auth-session.model.js';
import User from '../../models/user/user.model.js';
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from '../support/test-database.js';

describe('email authentication integration', { concurrency: false }, () => {
    let user = null;

    before(connectTestDatabase);

    beforeEach(async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        user = await User.create({
            userName: `email-test-${suffix}`,
            name: 'Email Test',
            email: `email-test-${suffix}@example.com`,
            passwordHash: await argon2.hash('password123'),
            isVerified: false,
        });
        emailMocks.sendOtpEmail.mockReset();
        emailMocks.sendEmailChangedAlert.mockReset();
    });

    afterEach(async () => {
        if (!user)
            return;

        await EmailOtpChallenge.deleteMany({ user: user._id });
        await AuthSession.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });
        user = null;
    });

    after(async () => {
        await disconnectTestDatabase();
    });

    it('verifies an email OTP only once', async () => {
        const challenge = await issueOtpChallenge(user._id, 'VERIFY_EMAIL');

        await assert.rejects(
            () => verifyEmailOtp(
                challenge.challengeId,
                challenge.otp,
                new mongoose.Types.ObjectId(),
            ),
            error => error?.code === 'VERIFICATION_CODE_INVALID_OR_EXPIRED',
        );

        await verifyEmailOtp(
            challenge.challengeId,
            challenge.otp,
            user._id,
        );

        assert.equal((await User.findById(user._id)).isVerified, true);
        await assert.rejects(
            () => verifyEmailOtp(
                challenge.challengeId,
                challenge.otp,
                user._id,
            ),
            error => error?.code === 'VERIFICATION_CODE_INVALID_OR_EXPIRED',
        );
    });

    it('resets password and revokes active sessions after OTP verification', async () => {
        const currentUser = await getUserByEmailWithPassword(user.email);
        const authSession = await AuthSession.create({
            sessionId: `test-session-${user._id}`,
            user: user._id,
            currentRefreshTokenHash: `hash-${user._id}`,
            rememberMe: false,
            lastUsedAt: new Date(),
            idleExpiresAt: new Date(Date.now() + 3600000),
            absoluteExpiresAt: new Date(Date.now() + 7200000),
        });
        const challenge = await issueOtpChallenge(
            user._id,
            'RESET_PASSWORD',
            { emailSnapshot: currentUser.email },
        );

        await verifyOtpCode(
            challenge.challengeId,
            'RESET_PASSWORD',
            challenge.otp,
        );
        await resetPasswordWithOtp(challenge.challengeId, 'next-password-123');

        const storedUser = await User.findById(user._id).select('+passwordHash');
        assert.equal(
            await argon2.verify(storedUser.passwordHash, 'next-password-123'),
            true,
        );
        assert.ok((await AuthSession.findById(authSession._id)).revokedAt);
        await assert.rejects(
            () => resetPasswordWithOtp(challenge.challengeId, 'another-password'),
            error => error?.code === 'PASSWORD_RESET_SESSION_INVALID',
        );
    });

    it('changes email, keeps the current session, and revokes other sessions', async () => {
        user.isVerified = true;
        await user.save();

        const currentSession = await AuthSession.create({
            sessionId: `current-session-${user._id}`,
            user: user._id,
            currentRefreshTokenHash: `hash-current-${user._id}`,
            rememberMe: false,
            lastUsedAt: new Date(),
            idleExpiresAt: new Date(Date.now() + 3600000),
            absoluteExpiresAt: new Date(Date.now() + 7200000),
        });
        const otherSession = await AuthSession.create({
            sessionId: `other-session-${user._id}`,
            user: user._id,
            currentRefreshTokenHash: `hash-other-${user._id}`,
            rememberMe: false,
            lastUsedAt: new Date(),
            idleExpiresAt: new Date(Date.now() + 3600000),
            absoluteExpiresAt: new Date(Date.now() + 7200000),
        });
        const targetEmail = `changed-${user._id}@example.com`;
        const request = await requestEmailChange(
            user._id,
            'password123',
            targetEmail,
        );
        const otp = emailMocks.sendOtpEmail.mock.calls.at(-1)[2];

        assert.ok(request.challengeId);
        const result = await confirmEmailChangeWithOtp(
            request.challengeId,
            otp,
            user._id,
            currentSession.sessionId,
        );

        const storedUser = await User.findById(user._id);
        const [storedCurrent, storedOther] = await Promise.all([
            AuthSession.findById(currentSession._id),
            AuthSession.findById(otherSession._id),
        ]);

        assert.equal(storedUser.email, targetEmail);
        assert.equal(result, undefined);
        assert.equal(storedCurrent.revokedAt, null);
        assert.ok(storedOther.revokedAt);
        assert.equal(emailMocks.sendEmailChangedAlert.mock.calls.length, 1);
    });
});
