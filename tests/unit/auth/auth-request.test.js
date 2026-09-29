import assert from 'node:assert/strict';

import {
    afterEach,
    describe,
    it,
    vi,
} from 'vitest';

vi.stubGlobal('window', {
    location: { origin: 'https://shop.example.com', assign: vi.fn() },
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

function createClient(fetchMock) {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
        location: { origin: 'https://shop.example.com', assign: vi.fn() },
    });

    return createAuthFetch({
        origin: 'https://shop.example.com',
    });
}

// Frontend auth requests refresh when the access token is missing or expired.
describe('frontend auth request', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        'ACCESS_TOKEN_MISSING',
        'ACCESS_TOKEN_EXPIRED',
    ])('refreshes and retries once for %s', async (code) => {
        const nativeFetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse(401, {
                code,
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
        'SESSION_INVALID',
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
