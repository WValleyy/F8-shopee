import env from '../config/load-env.js';
import { requestError } from '../utils/error/app-error.js';

function requireSameOrigin(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
        return next();

    const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
    const origin = req.get('origin');

    if (fetchSite === 'cross-site')
        return next(requestError('CSRF_VALIDATION_FAILED'));

    if (!origin) {
        if (['same-origin', 'same-site'].includes(fetchSite))
            return next();

        return next(requestError('CSRF_VALIDATION_FAILED'));
    }

    let requestOrigin = '';
    let expectedOrigin = '';

    try {
        requestOrigin = new URL(origin).origin;
        expectedOrigin = new URL(
            env.appOrigin || `${req.protocol}://${req.get('host')}`,
        ).origin;
    } catch {
        return next(requestError('CSRF_VALIDATION_FAILED'));
    }

    if (requestOrigin !== expectedOrigin)
        return next(requestError('CSRF_VALIDATION_FAILED'));

    return next();
}

function applySecurityHeaders(req, res, next) {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': [
            'camera=()',
            'microphone=()',
            'geolocation=()',
            'usb=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
        ].join(', '),
    });

    if (env.nodeEnv === 'production') {
        res.set(
            'Strict-Transport-Security',
            'max-age=15552000; includeSubDomains',
        );
    }

    next();
}

export {
    applySecurityHeaders,
    requireSameOrigin,
};
