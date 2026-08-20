import {
    consumeAuthRateLimit,
    createRateLimitScope,
} from '../services/auth/auth-rate-limit.service.js';
import { requestError } from '../utils/error/app-error.js';

function getClientIp(req) {
    return req.ip
        || req.socket?.remoteAddress
        || 'unknown';
}

function createAuthRateLimiter(options) {
    const {
        scope,
        limit,
        windowMs,
        getIdentifier = getClientIp,
    } = options;

    return async function authRateLimiter(req, _res, next) {
        const identifier = getIdentifier(req);
        const rateLimit = await consumeAuthRateLimit({
            scope,
            identifier,
            limit,
            windowMs,
        });

        if (rateLimit.allowed)
            return next();

        return next(requestError('RATE_LIMITED', {
            context: { retryAfter: rateLimit.retryAfter },
        }));
    };
}

const loginIpRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'login', 'ip'),
    limit: 30,
    windowMs: 15 * 60 * 1000,
});

const loginAccountRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'login', 'account'),
    limit: 20,
    windowMs: 15 * 60 * 1000,
    getIdentifier: req => String(req.body?.email || '').trim().toLowerCase(),
});

const registerIpRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'register', 'ip'),
    limit: 30,
    windowMs: 15 * 60 * 1000,
});

const registerIpEmailRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'register', 'ip-email'),
    limit: 5,
    windowMs: 15 * 60 * 1000,
    getIdentifier: req => (
        `${getClientIp(req)}:${String(req.body?.email || '').trim().toLowerCase()}`
    ),
});

// Share one user-scoped budget across every current-password check so callers
// cannot rotate endpoints to bypass throttling before Argon2 runs.
const currentPasswordRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'current-password', 'user'),
    limit: 10,
    windowMs: 15 * 60 * 1000,
    getIdentifier: req => req.authUserId,
});

const refreshRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'refresh', 'ip'),
    limit: 60,
    windowMs: 60 * 1000,
});

const passwordOtpIpRateLimit = createAuthRateLimiter({
    scope: createRateLimitScope('auth', 'password', 'otp', 'ip'),
    limit: 10,
    windowMs: 15 * 60 * 1000,
});

export {
    currentPasswordRateLimit,
    loginAccountRateLimit,
    loginIpRateLimit,
    passwordOtpIpRateLimit,
    refreshRateLimit,
    registerIpEmailRateLimit,
    registerIpRateLimit,
};
