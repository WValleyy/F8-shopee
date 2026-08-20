import { validateStrictAccessClaims } from '../services/auth/auth-session.service.js';
import { inspectAccessToken } from '../services/auth/auth-token.service.js';
import authConfig from '../config/auth.js';
import { clearAuthCookies } from '../controllers/api/auth/auth-http-state.js';
import { requestError } from '../utils/error/app-error.js';

function sendRefreshBridge(res) {
    res.status(401);
    res.set({
        'Cache-Control': 'no-store, private',
        Pragma: 'no-cache',
        'Content-Type': 'text/html; charset=utf-8',
    });

    return res.render('pages/auth/refresh-bridge', { layout: false });
}

function sendViewAuthenticationRequired(req, res, next) {
    if (req.get('X-Partial-Target')) {
        const code = req.authAccessStatus === 'expired'
            ? 'ACCESS_TOKEN_EXPIRED'
            : req.authAccessStatus === 'invalid'
                ? 'ACCESS_TOKEN_INVALID'
                : 'ACCESS_TOKEN_MISSING'; // status === 'missing'

        return next(requestError(code));
    }

    if (req.authAccessStatus === 'invalid') {
        clearAuthCookies(res);
        return res.redirect('/');
    }

    return res.redirect('/');
}

function isHtmlViewRequest(req) {
    return req.method === 'GET'
        && !req.get('X-Partial-Target')
        && !req.path.startsWith('/api/')
        && Boolean(req.accepts('html'));
}

async function refreshExpiredViewSession(req, res, next) {
    if (!isHtmlViewRequest(req))
        return next();

    if (req.authAccessStatus !== 'expired')
        return next();

    const strictExpiredState = await validateStrictAccessClaims(
        req.accessTokenClaims,
    );

    if (!strictExpiredState) {
        clearAuthCookies(res);
        return next();
    }

    return sendRefreshBridge(res);
}

function attachLightAuth(req, res, next) {
    const cookies = req.cookies;
    const accessToken = cookies[authConfig.cookie.accessCookieName] || null;
    const accessState = inspectAccessToken(accessToken);

    req.authRefreshToken = cookies[authConfig.cookie.refreshCookieName] || null;
    req.authAccessStatus = accessState.status;
    req.accessTokenClaims = accessState.claims;
    req.authUserId = accessState.status === 'valid'
        ? accessState.claims.sub
        : null;
    req.authSessionId = accessState.status === 'valid'
        ? accessState.claims.sid
        : null;

    next();
}

async function requireStrictApiAuth(req, res, next) {
    if (req.authAccessStatus === 'expired') {
        const strictExpiredState = await validateStrictAccessClaims(req.accessTokenClaims);

        if (!strictExpiredState) {
            clearAuthCookies(res);
            return next(requestError('SESSION_REVOKED'));
        }

        return next(requestError('ACCESS_TOKEN_EXPIRED'));
    }

    if (req.authAccessStatus !== 'valid') {
        return next(requestError(
            req.authAccessStatus === 'invalid' ? 'ACCESS_TOKEN_INVALID' : 'ACCESS_TOKEN_MISSING',
        ));
    }

    const strictState = await validateStrictAccessClaims(req.accessTokenClaims);

    if (!strictState) {
        clearAuthCookies(res);
        return next(requestError('SESSION_REVOKED'));
    }

    req.authUserId = strictState.user._id.toString();
    req.authUser = strictState.user;
    req.authSessionId = strictState.sessionId;

    return next();
}

function requireLightApiAuth(req, res, next) {
    if (req.authAccessStatus === 'expired')
        return next(requestError('ACCESS_TOKEN_EXPIRED'));

    if (req.authAccessStatus !== 'valid') {
        return next(requestError(
            req.authAccessStatus === 'invalid' ? 'ACCESS_TOKEN_INVALID' : 'ACCESS_TOKEN_MISSING',
        ));
    }

    return next();
}

async function requireStrictViewAuth(req, res, next) {
    if (req.get('X-Partial-Target'))
        return requireStrictApiAuth(req, res, next);

    if (req.authAccessStatus !== 'valid')
        return sendViewAuthenticationRequired(req, res, next);

    const strictState = await validateStrictAccessClaims(req.accessTokenClaims);

    if (!strictState) {
        clearAuthCookies(res);
        return res.redirect('/');
    }

    req.authUserId = strictState.user._id.toString();
    req.authUser = strictState.user;
    req.authSessionId = strictState.sessionId;

    return next();
}

function requireLightViewAuth(req, res, next) {
    if (!req.authUserId)
        return sendViewAuthenticationRequired(req, res, next);

    return next();
}

export {
    attachLightAuth,
    requireLightApiAuth,
    requireLightViewAuth,
    requireStrictApiAuth,
    requireStrictViewAuth,
    refreshExpiredViewSession,
};
