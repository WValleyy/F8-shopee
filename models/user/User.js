import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            index: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        avatar: {
            type: String,
            default: '',
        },

        phone: {
            type: String,
            trim: true,
            default: '',
        },

        role: {
            type: String,
            enum: ['USER', 'ADMIN'],
            default: 'USER',
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model('User', userSchema);

export default User;