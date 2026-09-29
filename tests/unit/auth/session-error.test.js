import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashSha256 } from '../../../utils/hash.js';
import AuthSession from '../../../models/auth/auth-session.model.js';
import User from '../../../models/user/user.model.js';

vi.mock('../../../services/auth/auth-token.service.js', async importOriginal => ({
    ...await importOriginal(),
    inspectRefreshToken: vi.fn(),
}));

import { inspectRefreshToken } from '../../../services/auth/auth-token.service.js';
import { refreshAccessToken } from '../../../services/auth/auth-session.service.js';

describe('invalid session error details', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        ['SESSION_NOT_FOUND', null],
        ['SESSION_REVOKED', { revokedAt: new Date() }],
        ['USER_UNAVAILABLE', {
            revokedAt: null,
            absoluteExpiresAt: new Date(Date.now() + 60000),
            idleExpiresAt: new Date(Date.now() + 60000),
            currentRefreshTokenHash: hashSha256('refresh-token'),
        }],
    ])('exposes %s in meta', async (reason, sessionDocument) => {
        inspectRefreshToken.mockReturnValue({
            status: 'valid',
            claims: { sub: '507f1f77bcf86cd799439011', sid: 'session-test' },
        });
        vi.spyOn(AuthSession, 'findOne').mockReturnValue({
            lean: async () => sessionDocument,
        });
        vi.spyOn(User, 'findOne').mockReturnValue({
            select: () => ({ lean: async () => null }),
        });

        await expect(refreshAccessToken('refresh-token', {})).rejects.toMatchObject({
            code: 'SESSION_INVALID',
            statusCode: 401,
            meta: { sessionReason: reason },
        });
    });
});
