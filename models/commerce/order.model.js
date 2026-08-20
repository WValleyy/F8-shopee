import mongoose, { Schema } from 'mongoose';

import commerceConfig from '../../config/commerce.js';
import inputLimits from '../../config/input-limits.js';

const integerMoneyValidator = {
    validator: Number.isSafeInteger,
    message: 'Money values must be integers.',
};

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
    },
);

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

        productSlug: {
            type: String,
            trim: true,
            default: '',
        },

        image: {
            type: String,
            required: true,
            trim: true,
        },

        options: {
            type: [optionSchema],
            default: [],
        },

        price: {
            type: Number,
            required: true,
            min: 0,
            max: commerceConfig.order.maxUnitPrice,
            validate: integerMoneyValidator,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
            max: commerceConfig.order.maxItemQuantity,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Order quantity must be an integer.',
            },
        },

        returnedQuantity: {
            type: Number,
            default: 0,
            min: 0,
            validate: [
                {
                    validator: Number.isSafeInteger,
                    message: 'Returned quantity must be an integer.',
                },
                {
                    validator(value) {
                        return value <= this.quantity;
                    },
                    message: 'Returned quantity cannot exceed order quantity.',
                },
            ],
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
            required() {
                return !this.customerDeletedAt;
            },
            default: null,
            index: true,
        },

        customerDeletedAt: {
            type: Date,
            default: null,
        },

        items: {
            type: [orderItemSchema],
            default: [],
            validate: {
                validator(items) {
                    const variantIds = items.map(item => (
                        item.variant?.toString?.() || ''
                    ));

                    return variantIds.every(Boolean)
                        && new Set(variantIds).size === variantIds.length;
                },
                message: 'Order items must contain unique variants.',
            },
        },

        shippingAddress: {
            type: shippingAddressSchema,
            required: true,
        },

        note: {
            type: String,
            trim: true,
            default: '',
            maxlength: inputLimits.order.noteMaxLength,
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
            max: commerceConfig.order.maxTotalAmount,
            validate: integerMoneyValidator,
        },

        status: {
            type: String,
            enum: [
                'SHIPPING',
                'COMPLETED',
                'CANCELLED',
            ],
            default: 'SHIPPING',
        },

        completedAt: {
            type: Date,
            default: null,
        },

        cancellationReason: {
            type: String,
            enum: [
                '',
                'USER_CANCELLED',
                'ADMIN_CANCELLED',
            ],
            default: '',
        },

        inventoryRestoredAt: {
            type: Date,
            default: null,
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

orderSchema.index({
    user: 1,
    status: 1,
});

orderSchema.index({
    'items.product': 1,
});

orderSchema.index({
    'items.variant': 1,
});

orderSchema.index({
    status: 1,
    'items.variant': 1,
});

const Order = mongoose.model('Order', orderSchema);

export default Order;
