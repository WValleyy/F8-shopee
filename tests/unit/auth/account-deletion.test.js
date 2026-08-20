import assert from 'node:assert/strict';
import {
    beforeEach,
    describe,
    it,
    vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
    deleteEmailOtpChallenges: vi.fn(),
    deleteRefreshRotationGrace: vi.fn(),
    endSession: vi.fn(),
    orderExists: vi.fn(),
    revokeAllAuthSessions: vi.fn(),
    startSession: vi.fn(),
    userFindOne: vi.fn(),
    userUpdateOne: vi.fn(),
    verifyPassword: vi.fn(),
}));

vi.mock('argon2', () => ({
    default: {
        verify: mocks.verifyPassword,
    },
}));

vi.mock('mongoose', async importOriginal => ({
    ...await importOriginal(),
    default: {
        ...(await importOriginal()).default,
        startSession: mocks.startSession,
    },
}));

vi.mock('../../../models/user/user.model.js', () => ({
    default: {
        findOne: mocks.userFindOne,
        updateOne: mocks.userUpdateOne,
    },
}));

vi.mock('../../../models/commerce/order.model.js', () => ({
    default: {
        exists: mocks.orderExists,
    },
}));

vi.mock('../../../models/auth/refresh-rotation-grace.model.js', () => ({
    default: {
        deleteMany: mocks.deleteRefreshRotationGrace,
    },
}));

vi.mock('../../../models/auth/email-otp-challenge.model.js', () => ({
    default: {
        deleteMany: mocks.deleteEmailOtpChallenges,
    },
}));

vi.mock('../../../services/auth/auth-session.service.js', () => ({
    revokeAllAuthSessionsInTransaction: mocks.revokeAllAuthSessions,
}));

import {
    scheduleAccountDeletion,
} from '../../../services/user/account-deletion.service.js';

function queryResult(value) {
    const query = {
        lean: vi.fn().mockResolvedValue(value),
        select: vi.fn(),
        session: vi.fn(),
    };

    query.select.mockReturnValue(query);
    query.session.mockReturnValue(query);
    return query;
}

function existsResult(value) {
    return {
        session: vi.fn().mockResolvedValue(value),
    };
}

function prepareSuccessfulDeletion() {
    const session = {
        endSession: mocks.endSession,
        withTransaction: callback => callback(),
    };
    const user = {
        _id: 'user-1',
        passwordHash: 'password-hash',
    };

    mocks.startSession.mockResolvedValue(session);
    mocks.userFindOne
        .mockReturnValueOnce(queryResult(user))
        .mockReturnValueOnce(queryResult(user));
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.orderExists.mockReturnValueOnce(existsResult(null));
    mocks.userUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    return { session, user };
}

// Account deletion is allowed only when credentials and order guards pass.
describe('account deletion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks the account inactive, schedules purge, and revokes auth state', async () => {
        const { session, user } = prepareSuccessfulDeletion();

        const result = await scheduleAccountDeletion(
            user._id,
            'current-password',
        );

        assert.equal(result, undefined);
        assert.deepEqual(mocks.userFindOne.mock.calls[0][0], {
            _id: user._id,
            role: 'USER',
            isActive: true,
            purgeAfter: null,
        });
        assert.deepEqual(mocks.userUpdateOne.mock.calls[0][0], {
            _id: user._id,
            role: 'USER',
            isActive: true,
            purgeAfter: null,
            passwordHash: user.passwordHash,
        });
        const update = mocks.userUpdateOne.mock.calls[0];
        assert.equal(update[1].$set.isActive, false);
        assert.ok(update[1].$set.purgeAfter instanceof Date);
        assert.deepEqual(update[2], { session });
        assert.deepEqual(mocks.revokeAllAuthSessions.mock.calls[0], [
            user._id,
            'account_deletion_scheduled',
            session,
        ]);
        assert.equal(mocks.deleteRefreshRotationGrace.mock.calls.length, 1);
        assert.equal(mocks.deleteEmailOtpChallenges.mock.calls.length, 1);
        assert.equal(mocks.endSession.mock.calls.length, 1);
    });

    it('rejects a non-customer account', async () => {
        mocks.userFindOne.mockReturnValue(queryResult(null));

        await assert.rejects(
            scheduleAccountDeletion('admin-1', 'current-password'),
            error => error?.code === 'USER_NOT_FOUND',
        );

        assert.equal(mocks.verifyPassword.mock.calls.length, 0);
        assert.equal(mocks.startSession.mock.calls.length, 0);
    });

    it('rejects an incorrect current password', async () => {
        mocks.userFindOne.mockReturnValue(queryResult({
            _id: 'user-1',
            passwordHash: 'password-hash',
        }));
        mocks.verifyPassword.mockResolvedValue(false);

        await assert.rejects(
            scheduleAccountDeletion('user-1', 'wrong-password'),
            error => error?.code === 'CURRENT_PASSWORD_INCORRECT',
        );

        assert.equal(mocks.startSession.mock.calls.length, 0);
    });

    it('rejects when the password hash changes before the transaction claim', async () => {
        const { user } = prepareSuccessfulDeletion();
        mocks.userFindOne.mockReset();
        mocks.userFindOne
            .mockReturnValueOnce(queryResult(user))
            .mockReturnValueOnce(queryResult(user));
        mocks.userUpdateOne.mockResolvedValue({ modifiedCount: 0 });

        await assert.rejects(
            scheduleAccountDeletion(user._id, 'current-password'),
            error => error?.code === 'CURRENT_PASSWORD_INCORRECT',
        );

        assert.equal(mocks.userUpdateOne.mock.calls.length, 1);
        assert.equal(mocks.endSession.mock.calls.length, 1);
    });

    it('rejects a blocker that appears inside the transaction', async () => {
        const { user } = prepareSuccessfulDeletion();
        mocks.orderExists.mockReset();
        mocks.orderExists.mockReturnValueOnce(existsResult({ _id: 'order-1' }));

        await assert.rejects(
            scheduleAccountDeletion(user._id, 'current-password'),
            error => error?.code === 'ACCOUNT_HAS_OPEN_ORDERS',
        );

        assert.equal(mocks.userUpdateOne.mock.calls.length, 0);
        assert.equal(mocks.endSession.mock.calls.length, 1);
    });
});
