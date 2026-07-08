import mongoose, { Schema } from 'mongoose';

const paymentMethodSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        stripeCustomerId: {
            type: String,
            required: true,
            index: true,
        },

        stripePaymentMethodId: {
            type: String,
            required: true,
            unique: true,
        },

        brand: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        cardholderName: {
            type: String,
            required: true,
            trim: true,
        },

        last4: {
            type: String,
            required: true,
        },

        expMonth: {
            type: Number,
            required: true,
        },

        expYear: {
            type: Number,
            required: true,
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

// Mỗi user chỉ có một phương thức thanh toán mặc định
paymentMethodSchema.index(
    { user: 1, isDefault: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isDefault: true,
        },
    }
);

const PaymentMethod = mongoose.model(
    'PaymentMethod',
    paymentMethodSchema
);

export default PaymentMethod;