import mongoose, { Schema } from 'mongoose';

const optionSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        value: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const shippingAddressSchema = new Schema(
    {
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
    },
    {
        _id: false,
    }
);

const orderItemSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },

        variant: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            required: true,
        },

        productName: {
            type: String,
            required: true,
            trim: true,
        },

        image: {
            type: String,
            default: '',
        },

        options: {
            type: [optionSchema],
            default: [],
        },

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    {
        _id: false,
    }
);

const orderSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        voucher: {
            type: Schema.Types.ObjectId,
            ref: 'Voucher',
            default: null,
        },

        items: {
            type: [orderItemSchema],
            default: [],
        },

        shippingAddress: {
            type: shippingAddressSchema,
            required: true,
        },

        note: {
            type: String,
            trim: true,
            default: '',
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },

        shippingFee: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        discount: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        paymentMethod: {
            type: String,
            enum: ['COD', 'ONLINE'],
            default: 'COD',
        },

        status: {
            type: String,
            enum: [
                'PENDING',
                'CONFIRMED',
                'SHIPPING',
                'COMPLETED',
                'CANCELLED',
            ],
            default: 'PENDING',
        },
    },
    {
        timestamps: true,
    }
);

orderSchema.index({
    user: 1,
    createdAt: -1,
});

const Order = mongoose.model('Order', orderSchema);

export default Order;