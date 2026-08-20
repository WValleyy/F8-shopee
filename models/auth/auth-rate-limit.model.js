import mongoose, { Schema } from 'mongoose';

const authRateLimitSchema = new Schema(
    {
        _id: {
            type: String,
        },
        scope: {
            type: String,
            required: true,
        },
        count: {
            type: Number,
            required: true,
            default: 0,
        },
        windowExpiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true },
);

authRateLimitSchema.index({ windowExpiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthRateLimit = mongoose.model('AuthRateLimit', authRateLimitSchema);

export default AuthRateLimit;
