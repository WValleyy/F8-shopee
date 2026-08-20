import mongoose, { Schema } from 'mongoose';
import inputLimits from '../../config/input-limits.js';
import { normalizePhone } from '../../utils/phone.js';
const userAddressSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.address.fullNameMaxLength,
        },

        phone: {
            type: String,
            required: true,
            trim: true,
            set: normalizePhone,
            maxlength: inputLimits.address.phoneMaxLength,
        },

        province: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.address.provinceMaxLength,
        },

        ward: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.address.wardMaxLength,
        },

        detail: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.address.detailMaxLength,
        },

        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

userAddressSchema.index({
    user: 1,
});

userAddressSchema.index(
    { user: 1, isDefault: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isDefault: true,
        },
    },
);

const UserAddress = mongoose.model(
    'UserAddress',
    userAddressSchema
);

export default UserAddress;
