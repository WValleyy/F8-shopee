import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function requiredEnv(name, options = {}) {
    const value = String(process.env[name] ?? '').trim();

    if (!value)
        throw new Error(`${name} is required.`);

    if (options.minLength && value.length < options.minLength) {
        throw new Error(
            `${name} must contain at least ${options.minLength} characters.`,
        );
    }

    return value;
}

function optionalNumberEnv(name, defaultValue) {
    const rawValue = String(process.env[name] ?? '').trim();

    if (!rawValue)
        return defaultValue;

    const value = Number(rawValue);

    if (!Number.isFinite(value))
        throw new Error(`${name} must be a number.`);

    return value;
}

function requiredBooleanEnv(name) {
    const rawValue = requiredEnv(name);

    if (!['true', 'false'].includes(rawValue.toLowerCase()))
        throw new Error(`${name} must be true or false.`);

    return rawValue.toLowerCase() === 'true';
}

const env = Object.freeze({
    nodeEnv: requiredEnv('NODE_ENV'),
    port: optionalNumberEnv('PORT', 3000),

    database: Object.freeze({
        uri: requiredEnv('MONGODB_URI'),
        name: requiredEnv('MONGODB_DB_NAME'),
    }),

    auth: Object.freeze({
        accessTokenSecret: requiredEnv(
            'ACCESS_TOKEN_SECRET',
            { minLength: 32 },
        ),
        refreshTokenSecret: requiredEnv(
            'REFRESH_TOKEN_SECRET',
            { minLength: 32 },
        ),
        graceEncryptionKey: requiredEnv(
            'AUTH_GRACE_ENCRYPTION_KEY',
            { minLength: 32 },
        ),
    }),

    cloudinary: Object.freeze({
        cloudName: requiredEnv('CLOUDINARY_CLOUD_NAME'),
        apiKey: requiredEnv('CLOUDINARY_API_KEY'),
        apiSecret: requiredEnv('CLOUDINARY_API_SECRET'),
    }),

    email: Object.freeze({
        gmailUser: requiredEnv('GMAIL_USER'),
        gmailAppPassword: requiredEnv('GMAIL_APP_PASSWORD'),
        fromName: requiredEnv('EMAIL_FROM_NAME'),
    }),

    appOrigin: requiredEnv('APP_ORIGIN'),
    trustProxy: requiredEnv('TRUST_PROXY'),

    authRateLimitEnabled: requiredBooleanEnv('AUTH_RATE_LIMIT_ENABLED'),
});

if (new Set([
    env.auth.accessTokenSecret,
    env.auth.refreshTokenSecret,
    env.auth.graceEncryptionKey,
]).size !== 3) {
    throw new Error(
        'ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET and AUTH_GRACE_ENCRYPTION_KEY must be different.',
    );
}

export { env };
export default env;
