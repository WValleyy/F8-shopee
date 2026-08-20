import mongoose, { Schema } from 'mongoose';

const emailOtpChallengeSchema = new Schema(
    {
        challengeIdHash: {
            type: String,
            required: true,
            unique: true,
        },

        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        purpose: {
            type: String,
            enum: ['VERIFY_EMAIL', 'RESET_PASSWORD', 'CHANGE_EMAIL'],
            required: true,
            index: true,
        },

        otpHash: {
            type: String,
            required: true,
        },

        targetEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
        },

        emailSnapshot: {
            type: String,
            trim: true,
            lowercase: true,
            required() {
                return this.purpose === 'RESET_PASSWORD';
            },
            default: '',
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },

        usedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

emailOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailOtpChallengeSchema.index({ user: 1, purpose: 1, usedAt: 1 });

const EmailOtpChallenge = mongoose.model(
    'EmailOtpChallenge',
    emailOtpChallengeSchema,
);

export default EmailOtpChallenge;
