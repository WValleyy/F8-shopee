import env from '../../config/load-env.js';
import AuthRateLimit from '../../models/auth/auth-rate-limit.model.js';
import { hashSha256 } from '../../utils/hash.js';

function createRateLimitScope(...segments) {
    return segments
        .join(':')
        .toLowerCase()
        .replaceAll('_', '-');
}

async function consumeAuthRateLimit(options) {
    const {
        scope,
        identifier,
        limit,
        windowMs,
    } = options;

    if (!env.authRateLimitEnabled)
        return { allowed: true, retryAfter: 0 };

    const key = hashSha256(`${scope}:${identifier}`);
    const now = new Date();
    const nextWindowExpiresAt = new Date(now.getTime() + windowMs);
    const activeWindow = {
        $gt: [
            { $ifNull: ['$windowExpiresAt', new Date(0)] },
            now,
        ],
    };
    const update = [{
        $set: {
            scope,
            count: {
                $cond: [
                    activeWindow,
                    { $add: [{ $ifNull: ['$count', 0] }, 1] },
                    1,
                ],
            },
            windowExpiresAt: {
                $cond: [activeWindow, '$windowExpiresAt', nextWindowExpiresAt],
            },
        },
    }];
    const updateOptions = {
        returnDocument: 'after',
        updatePipeline: true,
    };
    let state;

    try {
        state = await AuthRateLimit.findOneAndUpdate(
            { _id: key },
            update,
            {
                ...updateOptions,
                upsert: true,
            },
        ).lean();
    } catch (error) {
        if (error?.code !== 11000)
            throw error;

        state = await AuthRateLimit.findOneAndUpdate(
            { _id: key },
            update,
            updateOptions,
        ).lean();
    }

    const allowed = state.count <= limit;

    return {
        allowed,
        retryAfter: allowed
            ? 0
            : Math.max(
                1,
                Math.ceil(
                    (state.windowExpiresAt.getTime() - now.getTime()) / 1000,
                ),
            ),
    };
}

export {
    consumeAuthRateLimit,
    createRateLimitScope,
};
