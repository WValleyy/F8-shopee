import assert from 'node:assert/strict';

import {
    describe,
    it,
    vi,
} from 'vitest';

vi.stubGlobal('window', {
    fetch: vi.fn(),
    location: { origin: 'https://shop.example.com' },
    dispatchEvent: vi.fn(),
});

const { createAuthFetch } = await import(
    '../../../public/js/shared/api/http-client.js'
);

function jsonResponse(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function createClient(nativeFetch) {
    return createAuthFetch({
        nativeFetch,
        origin: 'https://shop.example.com',
        notifySessionEnded: vi.fn(),
    });
}

// Frontend auth requests refresh only when the access token is missing.
describe('frontend auth request', () => {
    it('refreshes and retries once when the access token is missing', async () => {
        const nativeFetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse(401, {
                code: 'ACCESS_TOKEN_MISSING',
            }))
            .mockResolvedValueOnce(jsonResponse(200, {}))
            .mockResolvedValueOnce(jsonResponse(200, {}));
        const client = createClient(nativeFetch);

        const response = await client('/api/orders');

        assert.equal(response.status, 200);
        assert.equal(nativeFetch.mock.calls.length, 3);
        assert.equal(nativeFetch.mock.calls[0][0], '/api/orders');
        assert.equal(
            nativeFetch.mock.calls[1][0],
            '/api/auth/session/refresh',
        );
        assert.equal(nativeFetch.mock.calls[2][0], '/api/orders');
    });

    it.each([
        'ACCESS_TOKEN_INVALID',
        'SESSION_REVOKED',
    ])('does not refresh for %s', async (code) => {
        const nativeFetch = vi.fn().mockResolvedValue(
            jsonResponse(401, { code }),
        );
        const client = createClient(nativeFetch);

        const response = await client('/api/orders');

        assert.equal(response.status, 401);
        assert.equal(nativeFetch.mock.calls.length, 1);
    });
});
