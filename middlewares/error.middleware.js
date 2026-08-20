import multer from 'multer';

import ERROR_CONFIG from '../config/error.config.js';
import {
    isAppError,
    requestError,
} from '../utils/error/app-error.js';
import { logAppEvent } from '../utils/error/app-error-logger.js';

const VIEW_ERROR_CONTENT = Object.freeze({
    400: { title: 'Yêu cầu không hợp lệ' },
    401: { title: 'Cần đăng nhập' },
    403: { title: 'Không có quyền truy cập' },
    404: {
        title: 'Trang không tồn tại',
        description: 'Đường dẫn bạn truy cập không đúng hoặc trang đã được di chuyển.',
    },
    409: { title: 'Không thể hoàn tất thao tác' },
    413: { title: 'Dữ liệu gửi lên quá lớn' },
    429: { title: 'Quá nhiều yêu cầu' },
    500: {
        title: 'Hệ thống đang gặp sự cố',
        description: ERROR_CONFIG.INTERNAL_SERVER_ERROR.message,
    },
    502: {
        title: 'Dịch vụ bên ngoài gặp sự cố',
        description: ERROR_CONFIG.INTERNAL_SERVER_ERROR.message,
    },
    503: {
        title: 'Dịch vụ tạm thời gián đoạn',
        description: ERROR_CONFIG.INTERNAL_SERVER_ERROR.message,
    },
});

function normalizeRequestParsingError(error) {
    if (error?.type === 'entity.too.large')
        return requestError('PAYLOAD_TOO_LARGE');

    if (
        error?.type === 'entity.parse.failed'
        && error instanceof SyntaxError
    ) {
        return requestError('INVALID_JSON');
    }

    if (error instanceof multer.MulterError) {
        const codeByMulterCode = {
            LIMIT_FILE_SIZE: 'UPLOAD_FILE_TOO_LARGE',
            LIMIT_FILE_COUNT: 'UPLOAD_TOO_MANY_FILES',
            LIMIT_FIELD_COUNT: 'UPLOAD_TOO_MANY_FIELDS',
        };

        return requestError(codeByMulterCode[error.code] || 'INVALID_UPLOAD', {
            cause: error,
        });
    }

    return null;
}

function isOperationalError(error) {
    return isAppError(error)
        && error.logSeverity === null
        && Boolean(ERROR_CONFIG[error.code]);
}

async function handleAppError(error, req, res, next) {
    const normalizedError = isAppError(error)
        ? error
        : normalizeRequestParsingError(error);
    const operational = isOperationalError(normalizedError);
    const responseError = operational
        ? normalizedError
        : requestError('INTERNAL_SERVER_ERROR');
    const incidentStatusCode = isAppError(normalizedError)
        && Number.isInteger(normalizedError.statusCode)
        && normalizedError.statusCode >= 500
        && normalizedError.statusCode <= 599
        ? normalizedError.statusCode
        : 500;
    const statusCode = operational
        ? normalizedError.statusCode
        : incidentStatusCode;
    const logSeverity = isAppError(normalizedError)
        ? normalizedError.logSeverity
        : 'error';

    if (logSeverity) {
        await logAppEvent('request-failed', logSeverity, {
            method: req.method,
            path: req.originalUrl,
            error: error?.message || String(error),
            code: normalizedError?.code
                || error?.code
                || 'UNHANDLED_ERROR',
            statusCode,
            stack: error?.stack || '',
            cause: error?.cause?.message || '',
            userId: req.authUserId || '',
            errorContext: normalizedError?.context || {},
        });
    }

    if (res.headersSent) {
        next(error);
        return;
    }

    if (
        operational
        && responseError.code === 'RATE_LIMITED'
        && responseError.context?.retryAfter != null
    ) {
        const retryAfter = Math.max(
            1,
            Math.ceil(Number(responseError.context.retryAfter) || 1),
        );
        res.set('Retry-After', String(retryAfter));
    }

    const expectsJson = req.originalUrl.startsWith('/api/')
        || Boolean(req.get('X-Partial-Target'));

    if (expectsJson) {
        return res.status(statusCode).json({
            code: responseError.code,
            message: responseError.message,
            ...(responseError.meta && Object.keys(responseError.meta).length
                ? { meta: responseError.meta }
                : {}),
        });
    }

    const viewError = VIEW_ERROR_CONTENT[statusCode]
        || VIEW_ERROR_CONTENT[500];
    const errorTitle = viewError.title;
    const description = statusCode >= 500
        ? viewError.description
        : (viewError.description || responseError.message);

    const actionHref = operational
        ? (normalizedError.viewAction?.actionHref || '/')
        : '/';
    const actionLabel = operational
        ? (normalizedError.viewAction?.actionLabel || 'Về trang chủ')
        : 'Về trang chủ';

    res.status(statusCode).render('pages/error/error', {
        layout: 'layouts/base-layout',
        title: `${statusCode} - ${errorTitle}`,
        styles: ['/css/pages/error.css'],
        entryScript: '/js/pages/error/error.js',
        statusCode,
        errorTitle,
        description,
        actionHref,
        actionLabel,
    });
}

function handleNotFoundRequest(req, res, next) {
    next(requestError('ROUTE_NOT_FOUND'));
}

export {
    handleAppError,
    handleNotFoundRequest,
};
