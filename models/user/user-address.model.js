import mongoose, { Schema } from 'mongoose';

const userAddressSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            trim: true,
        },

        province: {
            type: String,
            required: true,
            trim: true,
        },

        district: {
            type: String,
            required: true,
            trim: true,
        },

        ward: {
            type: String,
            required: true,
            trim: true,
        },

        detail: {
            type: String,
            required: true,
            trim: true,
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

const UserAddress = mongoose.model(
    'UserAddress',
    userAddressSchema
);

export default UserAddress;