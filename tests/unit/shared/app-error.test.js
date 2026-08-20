import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
    incidentError,
    requestError,
    resolveRequestErrorMessage,
} from '../../../utils/error/app-error.js';

// Application errors preserve the configured status, message, and metadata contract.
describe('app error contract', () => {
    it('resolves request error status and message from the configured code', () => {
        const error = requestError('PRODUCT_NOT_FOUND');

        assert.equal(error.code, 'PRODUCT_NOT_FOUND');
        assert.equal(error.statusCode, 404);
        assert.equal(error.message, 'Không tìm thấy sản phẩm.');
        assert.equal(error.logSeverity, null);
    });

    it('resolves dynamic messages from messageParams', () => {
        const message = resolveRequestErrorMessage(
            'ADDRESS_LIMIT_REACHED',
            { limit: 10 },
        );
        const error = requestError('ADDRESS_LIMIT_REACHED', {
            messageParams: { limit: 10 },
        });

        assert.equal(message, 'Bạn chỉ có thể lưu tối đa 10 địa chỉ.');
        assert.equal(error.message, message);
        assert.equal(error.statusCode, 409);
    });

    it('throws a programming error for an unknown code', () => {
        assert.throws(
            () => requestError('UNKNOWN_REQUEST_ERROR'),
            /Unknown request error code/,
        );
    });

    it('throws a programming error when a dynamic message parameter is missing', () => {
        assert.throws(
            () => requestError('ADDRESS_LIMIT_REACHED'),
            /Missing request error message parameter "limit"/,
        );
    });

    it('keeps viewAction separate from public metadata', () => {
        const meta = { errors: [{ field: 'variants' }] };
        const viewAction = {
            actionHref: '/cart',
            actionLabel: 'Quay lại giỏ hàng',
        };
        const error = requestError('PRODUCT_VALIDATION_FAILED', {
            meta,
            viewAction,
        });

        assert.deepEqual(error.meta, meta);
        assert.deepEqual(error.viewAction, viewAction);
    });

    it('preserves incident status, code, cause, context, and error severity', () => {
        const cause = new Error('Database unavailable.');
        const error = incidentError('Unable to load the resource.', {
            statusCode: 503,
            code: 'RESOURCE_LOAD_FAILED',
            cause,
            context: { resourceId: 'resource-1' },
        });

        assert.equal(error.statusCode, 503);
        assert.equal(error.code, 'RESOURCE_LOAD_FAILED');
        assert.equal(error.logSeverity, 'error');
        assert.equal(error.cause, cause);
        assert.deepEqual(error.context, { resourceId: 'resource-1' });
    });
});
