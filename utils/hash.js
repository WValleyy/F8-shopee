import crypto from 'crypto';

function hashSha256(value) {
    return crypto
        .createHash('sha256')
        .update(String(value))
        .digest('hex');
}

export { hashSha256 };
