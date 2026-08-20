const authConfig = Object.freeze({
    cookie: Object.freeze({
        accessCookieName: 'f8sp_access_token',
        refreshCookieName: 'f8sp_refresh_token',
        refreshCookiePath: '/api/auth/session',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    }),

    token: Object.freeze({
        algorithm: 'HS256',
        accessTokenTtlSeconds: 15 * 60,
        accessTokenIssuer: 'f8-shopee-auth',
        accessTokenAudience: 'f8-shopee-api',
        refreshTokenIssuer: 'f8-shopee-auth',
        refreshTokenAudience: 'f8-shopee-auth-session-api',
    }),

    session: Object.freeze({
        rememberIdleTtlSeconds: 30 * 24 * 60 * 60,
        rememberAbsoluteTtlSeconds: 90 * 24 * 60 * 60,
        sessionIdleTtlSeconds: 12 * 60 * 60,
        sessionAbsoluteTtlSeconds: 24 * 60 * 60,
        refreshGraceTtlSeconds: 10,
        maxActiveSessions: 5,
    }),

    accountDeletion: Object.freeze({
        purgeDelaySeconds: 20 * 60,
    }),

    otp: Object.freeze({
        codeLength: 6,
        ttlSeconds: 15 * 60,
        resendCooldownSeconds: 45,
        resendLimit: 10,
        resendWindowSeconds: 60 * 60,
        verifyLimit: 10,
        verifyWindowSeconds: 60 * 60,
        cookiePath: '/api/auth',
        cookieMaxAgeSeconds: 15 * 60,
        cookieNames: Object.freeze({
            VERIFY_EMAIL: 'f8sp_verify_challenge',
            RESET_PASSWORD: 'f8sp_reset_challenge',
            CHANGE_EMAIL: 'f8sp_change_email_challenge',
        }),
    }),
});

export default authConfig;
