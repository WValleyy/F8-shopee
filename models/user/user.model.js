import mongoose, { Schema } from 'mongoose';
import inputLimits from '../../config/input-limits.js';
import { normalizePhone } from '../../utils/phone.js';
const userSchema = new Schema(
    {   
        userName: {
            type: String,
            required: true,
            trim: true,
            minlength: inputLimits.user.userNameMinLength,
            maxlength: inputLimits.user.userNameMaxLength,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.user.nameMaxLength,
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            maxlength: inputLimits.user.emailMaxLength,
        },

        passwordHash: {
            type: String,
            required: true,
            select: false,
        },

        avatar: {
            type: String,
            default: '',
        },

        avatarPublicId: {
            type: String,
            default: '',
        },

        phone: {
            type: String,
            trim: true,
            set: normalizePhone,
            default: '',
            maxlength: inputLimits.user.phoneMaxLength,
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
            default: 'other'
        },

        birthday: {
            type: Date,
            default: null
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

        purgeAfter: {
            type: Date,
            default: null,
            index: true,
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
