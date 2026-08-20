import mongoose, { Schema } from 'mongoose';

import inputLimits from '../../config/input-limits.js';

const authSessionSchema = new Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
        },

        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        currentRefreshTokenHash: {
            type: String,
            required: true,
        },

        rememberMe: {
            type: Boolean,
            required: true,
            default: false,
        },

        lastUsedAt: {
            type: Date,
            required: true,
        },

        idleExpiresAt: {
            type: Date,
            required: true,
        },

        absoluteExpiresAt: {
            type: Date,
            required: true,
        },

        revokedAt: {
            type: Date,
            default: null,
        },

        revokeReason: {
            type: String,
            default: null,
        },

        userAgent: {
            type: String,
            default: '',
            maxlength: inputLimits.authSession.userAgentMaxLength,
        },

        deviceLabel: {
            type: String,
            default: '',
            maxlength: inputLimits.authSession.deviceLabelMaxLength,
        },
    },
    {
        timestamps: true,
    },
);

authSessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({
    user: 1,
    revokedAt: 1,
    idleExpiresAt: 1,
    absoluteExpiresAt: 1,
});

const AuthSession = mongoose.model(
    'AuthSession',
    authSessionSchema,
);

export default AuthSession;
