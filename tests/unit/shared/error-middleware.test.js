import assert from 'node:assert/strict';
import {
    beforeEach,
    describe,
    it,
    vi,
} from 'vitest';

import multer from 'multer';

const mocks = vi.hoisted(() => ({
    logAppEvent: vi.fn(),
}));

vi.mock('../../../utils/error/app-error-logger.js', () => ({
    logAppEvent: mocks.logAppEvent,
}));

import {
    handleAppError,
    handleNotFoundRequest,
} from '../../../middlewares/error.middleware.js';
import {
    incidentError,
    requestError,
} from '../../../utils/error/app-error.js';

function createResponse() {
    const response = {
        headersSent: false,
        json: vi.fn(),
        render: vi.fn(),
        set: vi.fn(),
        status: vi.fn(),
    };

    response.status.mockReturnValue(response);
    return response;
}

// Error middleware maps known failures to safe HTTP responses and logging.
describe('error middleware', () => {
    beforeEach(() => {
        mocks.logAppEvent.mockReset();
    });

    it('creates a configured not-found error for unmatched routes', () => {
        const next = vi.fn();

        handleNotFoundRequest({}, {}, next);

        const error = next.mock.calls[0][0];
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, 'ROUTE_NOT_FOUND');
    });

    it('returns JSON for an unmatched API route', async () => {
        const res = createResponse();
        const req = {
            method: 'GET',
            originalUrl: '/api/missing',
            get: vi.fn().mockReturnValue(''),
        };
        const next = vi.fn();

        handleNotFoundRequest(req, res, next);
        await handleAppError(next.mock.calls[0][0], req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [404]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'ROUTE_NOT_FOUND',
            message: 'Trang hoặc tài nguyên bạn yêu cầu không tồn tại.',
        });
        assert.equal(res.render.mock.calls.length, 0);
    });

    it('renders the shared error page for an unmatched view route', async () => {
        const res = createResponse();
        const req = {
            method: 'GET',
            originalUrl: '/missing',
            get: vi.fn().mockReturnValue(''),
        };
        const next = vi.fn();

        handleNotFoundRequest(req, res, next);
        await handleAppError(next.mock.calls[0][0], req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [404]);
        assert.deepEqual(res.render.mock.calls[0], [
            'pages/error/error',
            {
                layout: 'layouts/base-layout',
                title: '404 - Trang không tồn tại',
                styles: ['/css/pages/error.css'],
                entryScript: '/js/pages/error/error.js',
                statusCode: 404,
                errorTitle: 'Trang không tồn tại',
                description: 'Đường dẫn bạn truy cập không đúng hoặc trang đã được di chuyển.',
                actionHref: '/',
                actionLabel: 'Về trang chủ',
            },
        ]);
        assert.equal(res.json.mock.calls.length, 0);
    });

    it('passes viewAction to the HTML error render context', async () => {
        const res = createResponse();
        const req = {
            method: 'GET',
            originalUrl: '/checkout/test',
            get: vi.fn().mockReturnValue(''),
        };
        const error = requestError('CHECKOUT_ITEMS_UNAVAILABLE', {
            viewAction: {
                actionHref: '/cart',
                actionLabel: 'Quay lại giỏ hàng',
            },
        });

        await handleAppError(error, req, res, vi.fn());

        const renderContext = res.render.mock.calls[0][1];
        assert.equal(renderContext.actionHref, '/cart');
        assert.equal(renderContext.actionLabel, 'Quay lại giỏ hàng');
    });

    it('sets Retry-After from rate-limit error metadata', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/auth/password/forgot',
            get: vi.fn().mockReturnValue(''),
        };
        const error = requestError('RATE_LIMITED', {
            context: { retryAfter: 37.2 },
        });

        await handleAppError(error, req, res, vi.fn());

        assert.deepEqual(res.set.mock.calls[0], ['Retry-After', '38']);
        assert.deepEqual(res.status.mock.calls[0], [429]);
    });

    it('returns 400 for malformed JSON instead of hiding it as a 500', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/orders',
            get: vi.fn().mockReturnValue(''),
        };
        const error = new SyntaxError('Unexpected token');
        error.type = 'entity.parse.failed';

        await handleAppError(error, req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [400]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'INVALID_JSON',
            message: 'Dữ liệu JSON không hợp lệ.',
        });
    });

    it('returns 413 when the request body exceeds its configured limit', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/reviews/products/test',
            get: vi.fn().mockReturnValue(''),
        };
        const error = new Error('request entity too large');
        error.type = 'entity.too.large';

        await handleAppError(error, req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [413]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Dữ liệu gửi lên vượt quá giới hạn cho phép.',
        });
    });


    it('maps Multer file-size errors without exposing the raw message', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/upload',
            get: vi.fn().mockReturnValue(''),
        };
        const error = new multer.MulterError('LIMIT_FILE_SIZE', 'images');
        error.message = 'Raw Multer provider message.';

        await handleAppError(error, req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [413]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'UPLOAD_FILE_TOO_LARGE',
            message: 'Tệp tải lên vượt quá dung lượng cho phép.',
        });
    });

    it('returns allowed product metadata without writing an app log', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/admin/products',
            get: vi.fn().mockReturnValue(''),
        };
        const meta = {
            errors: [{
                field: 'variants',
                code: 'PRODUCT_VARIANT_HAS_ORDERS',
                variantIds: ['variant-1'],
            }],
        };
        const error = requestError('PRODUCT_VALIDATION_FAILED', { meta });

        await handleAppError(error, req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [400]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'PRODUCT_VALIDATION_FAILED',
            message: 'Dữ liệu sản phẩm không hợp lệ.',
            meta,
        });
        assert.equal(mocks.logAppEvent.mock.calls.length, 0);
    });

    it('logs an incident without exposing its internal code or context', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/orders',
            authUserId: 'user-1',
            get: vi.fn().mockReturnValue(''),
        };
        const cause = new Error('Database connection lost.');
        const error = incidentError('Unable to place order.', {
            code: 'ORDER_PLACEMENT_FAILED',
            context: { orderId: 'order-1' },
            cause,
            logSeverity: 'warning',
        });

        await handleAppError(error, req, res, vi.fn());

        assert.deepEqual(res.status.mock.calls[0], [500]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
        });
        assert.equal(mocks.logAppEvent.mock.calls[0][0], 'request-failed');
        assert.equal(mocks.logAppEvent.mock.calls[0][1], 'warning');
        assert.deepEqual(
            mocks.logAppEvent.mock.calls[0][2].errorContext,
            { orderId: 'order-1' },
        );
        assert.equal(
            mocks.logAppEvent.mock.calls[0][2].cause,
            'Database connection lost.',
        );
    });

    it('preserves a 502 incident status while returning a safe payload', async () => {
        const res = createResponse();
        const req = {
            method: 'POST',
            originalUrl: '/api/admin/products',
            get: vi.fn().mockReturnValue(''),
        };

        await handleAppError(
            incidentError('Cloudinary returned an invalid result.', {
                statusCode: 502,
            }),
            req,
            res,
            vi.fn(),
        );

        assert.deepEqual(res.status.mock.calls[0], [502]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
        });
    });

    it('logs an unexpected runtime error and returns a safe 500 response', async () => {
        const res = createResponse();
        const req = {
            method: 'GET',
            originalUrl: '/api/cart',
            get: vi.fn().mockReturnValue(''),
        };

        await handleAppError(
            new TypeError('Cannot read properties of undefined.'),
            req,
            res,
            vi.fn(),
        );

        assert.deepEqual(res.status.mock.calls[0], [500]);
        assert.deepEqual(res.json.mock.calls[0][0], {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
        });
        assert.equal(mocks.logAppEvent.mock.calls[0][0], 'request-failed');
        assert.equal(mocks.logAppEvent.mock.calls[0][1], 'error');
    });
});
