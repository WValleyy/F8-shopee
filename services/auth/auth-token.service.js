import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import authConfig from '../../config/auth.js';
import env from '../../config/load-env.js';

const GRACE_ENCRYPTION_KEY = crypto
    .createHash('sha256')
    .update(env.auth.graceEncryptionKey)
    .digest();

function createAccessToken(userId, sessionId) {
    return jwt.sign(
        {
            sub: userId.toString(),
            sid: sessionId,
            tokenType: 'access',
        },
        env.auth.accessTokenSecret,
        {
            algorithm: authConfig.token.algorithm,
            expiresIn: authConfig.token.accessTokenTtlSeconds,
            issuer: authConfig.token.accessTokenIssuer,
            audience: authConfig.token.accessTokenAudience,
        },
    );
}

function createRefreshToken(userId, sessionId, expiresIn) {
    return jwt.sign(
        {
            sub: userId.toString(),
            sid: sessionId,
            jti: crypto.randomUUID(),
            tokenType: 'refresh',
        },
        env.auth.refreshTokenSecret,
        {
            algorithm: authConfig.token.algorithm,
            expiresIn,
            issuer: authConfig.token.refreshTokenIssuer,
            audience: authConfig.token.refreshTokenAudience,
        },
    );
}

function hasRequiredClaims(claims, tokenType) {
    const hasBaseClaims = Boolean(
        claims
        && claims.tokenType === tokenType
        && typeof claims.sub === 'string'
        && claims.sub
        && typeof claims.sid === 'string'
        && claims.sid
        && Number.isInteger(claims.iat)
        && Number.isInteger(claims.exp)
        && claims.exp > claims.iat,
    );

    if (!hasBaseClaims)
        return false;

    return tokenType !== 'refresh'
        || (typeof claims.jti === 'string' && Boolean(claims.jti));
}

function inspectAccessToken(token) {
    if (!token)
        return { status: 'missing', claims: null };

    try {
        const claims = verifyAccessJwt(token);

        if (!hasRequiredClaims(claims, 'access'))
            return { status: 'invalid', claims: null };

        return { status: 'valid', claims };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            try {
                const claims = verifyAccessJwt(
                    token,
                    { ignoreExpiration: true },
                );

                if (hasRequiredClaims(claims, 'access'))
                    return { status: 'expired', claims };
            } catch {
                return { status: 'invalid', claims: null };
            }
        }

        return { status: 'invalid', claims: null };
    }
}

function inspectRefreshToken(refreshToken) {
    if (!refreshToken)
        return { status: 'invalid', claims: null };

    try {
        const claims = verifyRefreshJwt(refreshToken);

        if (!hasRequiredClaims(claims, 'refresh'))
            return { status: 'invalid', claims: null };

        return { status: 'valid', claims };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            try {
                const claims = verifyRefreshJwt(
                    refreshToken,
                    { ignoreExpiration: true },
                );

                if (hasRequiredClaims(claims, 'refresh'))
                    return { status: 'expired', claims };
            } catch {
                return { status: 'invalid', claims: null };
            }
        }

        return { status: 'invalid', claims: null };
    }
}

function encryptGraceToken(token) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        GRACE_ENCRYPTION_KEY,
        iv,
    );
    const ciphertext = Buffer.concat([
        cipher.update(token, 'utf8'),
        cipher.final(),
    ]);

    return {
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    };
}

function decryptGraceToken(encryptedToken) {
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        GRACE_ENCRYPTION_KEY,
        Buffer.from(encryptedToken.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(encryptedToken.authTag, 'base64'));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedToken.ciphertext, 'base64')),
        decipher.final(),
    ]).toString('utf8');
}

function verifyAccessJwt(token, options = {}) {
    const { ignoreExpiration = false } = options;

    return jwt.verify(token, env.auth.accessTokenSecret, {
        algorithms: [authConfig.token.algorithm],
        issuer: authConfig.token.accessTokenIssuer,
        audience: authConfig.token.accessTokenAudience,
        ignoreExpiration,
    });
}

function verifyRefreshJwt(token, options = {}) {
    const { ignoreExpiration = false } = options;

    return jwt.verify(token, env.auth.refreshTokenSecret, {
        algorithms: [authConfig.token.algorithm],
        issuer: authConfig.token.refreshTokenIssuer,
        audience: authConfig.token.refreshTokenAudience,
        ignoreExpiration,
    });
}

export {
    createAccessToken,
    createRefreshToken,
    decryptGraceToken,
    encryptGraceToken,
    hasRequiredClaims,
    inspectAccessToken,
    inspectRefreshToken,
};
