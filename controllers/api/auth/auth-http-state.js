import authConfig from '../../../config/auth.js';
import { parseSessionMetadataInput } from '../../requests-parser/auth/auth.request.js';

function clearAuthCookies(res) {
    res.clearCookie(authConfig.cookie.accessCookieName, { path: '/' });
    res.clearCookie(authConfig.cookie.refreshCookieName, {
        path: authConfig.cookie.refreshCookiePath,
    });
}

function setAuthCookies(res, session) {
    const refreshCookieOptions = {
        httpOnly: authConfig.cookie.httpOnly,
        sameSite: authConfig.cookie.sameSite,
        secure: authConfig.cookie.secure,
        path: authConfig.cookie.refreshCookiePath,
    };

    if (typeof session.refreshCookieMaxAge === 'number')
        refreshCookieOptions.maxAge = session.refreshCookieMaxAge * 1000;

    const accessCookieOptions = {
        httpOnly: authConfig.cookie.httpOnly,
        sameSite: authConfig.cookie.sameSite,
        secure: authConfig.cookie.secure,
        path: '/',
    };

    if (typeof session.refreshCookieMaxAge === 'number')
        accessCookieOptions.maxAge = session.refreshCookieMaxAge * 1000;

    res.cookie(
        authConfig.cookie.accessCookieName,
        session.accessToken,
        accessCookieOptions,
    );
    res.cookie(authConfig.cookie.refreshCookieName, session.refreshToken, refreshCookieOptions);
}

function getOtpCookieName(purpose) {
    return authConfig.otp.cookieNames[purpose];
}

function setOtpCookie(res, purpose, challengeId) {
    res.cookie(getOtpCookieName(purpose), challengeId, {
        httpOnly: true,
        sameSite: authConfig.cookie.sameSite,
        secure: authConfig.cookie.secure,
        maxAge: authConfig.otp.cookieMaxAgeSeconds * 1000,
        path: authConfig.otp.cookiePath,
    });
}

function clearOtpCookie(res, purpose) {
    res.clearCookie(getOtpCookieName(purpose), {
        path: authConfig.otp.cookiePath,
    });
}

function getSessionMetadata(req, rememberMe) {
    return parseSessionMetadataInput({
        rememberMe,
        userAgent: req.get('user-agent') || '',
        platform: req.get('sec-ch-ua-platform') || '',
    });
}

export {
    clearAuthCookies,
    clearOtpCookie,
    getOtpCookieName,
    getSessionMetadata,
    setAuthCookies,
    setOtpCookie,
};
