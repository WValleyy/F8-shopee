import mongoose, { Schema } from 'mongoose';

const encryptedTokenSchema = new Schema(
    {
        iv: {
            type: String,
            required: true,
        },
        authTag: {
            type: String,
            required: true,
        },
        ciphertext: {
            type: String,
            required: true,
        },
    },
    { _id: false },
);

const refreshRotationGraceSchema = new Schema(
    {
        sessionId: {
            type: String,
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        oldRefreshTokenHash: {
            type: String,
            required: true,
        },
        encryptedAccessToken: {
            type: encryptedTokenSchema,
            required: true,
        },
        encryptedRefreshToken: {
            type: encryptedTokenSchema,
            required: true,
        },
        rememberMe: {
            type: Boolean,
            required: true,
        },
        refreshCookieMaxAge: {
            type: Number,
            default: null,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true },
);

refreshRotationGraceSchema.index(
    { sessionId: 1, oldRefreshTokenHash: 1 },
    { unique: true },
);
refreshRotationGraceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshRotationGrace = mongoose.model(
    'RefreshRotationGrace',
    refreshRotationGraceSchema,
);

export default RefreshRotationGrace;
