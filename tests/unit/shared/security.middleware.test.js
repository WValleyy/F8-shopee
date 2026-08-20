import assert from 'node:assert/strict';
import {
    describe,
    it,
    vi,
} from 'vitest';

import env from '../../../config/load-env.js';
import { requireSameOrigin } from '../../../middlewares/security.middleware.js';

function createRequest({
    method = 'POST',
    origin = '',
    fetchSite = '',
} = {}) {
    const headers = {
        origin,
        'sec-fetch-site': fetchSite,
        host: 'shop.example.com',
    };

    return {
        method,
        protocol: 'https',
        get(name) {
            return headers[String(name).toLowerCase()] || '';
        },
    };
}

function createResponse() {
    const response = {
        statusCode: 200,
        payload: null,
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

// Mutation requests are accepted only when their origin matches the application.
describe('same-origin mutation protection', () => {
    it('allows safe methods without browser origin headers', () => {
        const next = vi.fn();

        requireSameOrigin(
            createRequest({ method: 'GET' }),
            createResponse(),
            next,
        );

        assert.equal(next.mock.calls.length, 1);
    });

    it('allows a mutation with the configured origin', () => {
        const next = vi.fn();
        const expectedOrigin = env.appOrigin || 'https://shop.example.com';

        requireSameOrigin(
            createRequest({ origin: expectedOrigin }),
            createResponse(),
            next,
        );

        assert.equal(next.mock.calls.length, 1);
    });

    it.each(['same-origin', 'same-site'])(
        'allows a mutation verified by Sec-Fetch-Site: %s',
        (fetchSite) => {
            const next = vi.fn();

            requireSameOrigin(
                createRequest({ fetchSite }),
                createResponse(),
                next,
            );

            assert.equal(next.mock.calls.length, 1);
        },
    );

    it.each([
        {},
        { fetchSite: 'cross-site' },
        { fetchSite: 'none' },
        { origin: 'https://attacker.example' },
    ])('rejects an unverifiable mutation: %o', (headers) => {
        const response = createResponse();
        const next = vi.fn();

        requireSameOrigin(
            createRequest(headers),
            response,
            next,
        );

        assert.equal(next.mock.calls.length, 1);
        const error = next.mock.calls[0][0];
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, 'CSRF_VALIDATION_FAILED');
        assert.equal(error.logSeverity, null);
        assert.equal(response.payload, null);
    });
});
