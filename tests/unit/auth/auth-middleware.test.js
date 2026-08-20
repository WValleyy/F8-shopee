import assert from 'node:assert/strict';
import {
    beforeEach,
    describe,
    it,
    vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
    validateStrictAccessClaims: vi.fn(),
}));

vi.mock('../../../services/auth/auth-session.service.js', () => ({
    validateStrictAccessClaims: mocks.validateStrictAccessClaims,
}));

vi.mock('../../../services/auth/auth-token.service.js', async (importOriginal) => ({
    ...await importOriginal(),
    inspectAccessToken: vi.fn(),
}));

import {
    requireStrictViewAuth,
} from '../../../middlewares/auth.middleware.js';

function createRequest({
    partial = false,
    status = 'valid',
    target = 'page',
} = {}) {
    return {
        authAccessStatus: status,
        accessTokenClaims: {
            sub: '507f1f77bcf86cd799439011',
            sid: 'session-id',
            tokenType: 'access',
        },
        method: 'GET',
        get(name) {
            return name === 'X-Partial-Target' && partial ? target : '';
        },
        accepts: vi.fn().mockReturnValue('html'),
    };
}

function createResponse() {
    const response = {
        statusCode: 200,
        payload: null,
        clearCookie: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        set: vi.fn(),
        status: vi.fn((statusCode) => {
            response.statusCode = statusCode;
            return response;
        }),
        json: vi.fn((payload) => {
            response.payload = payload;
            return response;
        }),
    };

    return response;
}

// View authentication accepts only valid, active sessions.
describe('strict view authentication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('attaches user and session state for an authenticated partial request', async () => {
        const user = {
            _id: {
                toString: () => '507f1f77bcf86cd799439011',
            },
        };
        const request = createRequest({ partial: true });
        const response = createResponse();
        const next = vi.fn();

        mocks.validateStrictAccessClaims.mockResolvedValue({
            user,
            sessionId: 'session-id',
        });

        await requireStrictViewAuth(request, response, next);

        assert.equal(next.mock.calls.length, 1);
        assert.equal(request.authUser, user);
        assert.equal(request.authUserId, user._id.toString());
        assert.equal(request.authSessionId, 'session-id');
    });

    it('forwards SESSION_REVOKED instead of redirecting a revoked partial request', async () => {
        const request = createRequest({ partial: true });
        const response = createResponse();
        const next = vi.fn();

        mocks.validateStrictAccessClaims.mockResolvedValue(null);

        await requireStrictViewAuth(request, response, next);

        assert.equal(next.mock.calls.length, 1);
        const error = next.mock.calls[0][0];
        assert.equal(error.statusCode, 401);
        assert.equal(error.code, 'SESSION_REVOKED');
        assert.equal(error.logSeverity, null);
        assert.equal(response.redirect.mock.calls.length, 0);
        assert.equal(response.clearCookie.mock.calls.length, 2);
    });

    it('redirects a revoked full-page request', async () => {
        const request = createRequest();
        const response = createResponse();
        const next = vi.fn();

        mocks.validateStrictAccessClaims.mockResolvedValue(null);

        await requireStrictViewAuth(request, response, next);

        assert.equal(next.mock.calls.length, 0);
        assert.deepEqual(response.redirect.mock.calls[0], ['/']);
        assert.equal(response.json.mock.calls.length, 0);
        assert.equal(response.clearCookie.mock.calls.length, 2);
    });
});
