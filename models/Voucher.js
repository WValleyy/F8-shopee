import mongoose, { Schema } from 'mongoose';

const voucherSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            unique: true,
            index: true,
        },

        description: {
            type: String,
            trim: true,
            default: '',
        },

        discountType: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED', 'FREESHIP'],
            required: true,
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },

        minimumOrderValue: {
            type: Number,
            default: 0,
            min: 0,
        },

        maximumDiscount: {
            type: Number,
            default: 0,
            min: 0,
        },

        quantity: {
            type: Number,
            required: true,
            min: 0,
        },

        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
        },

        isPublished: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const Voucher = mongoose.model('Voucher', voucherSchema);

export default Voucher;