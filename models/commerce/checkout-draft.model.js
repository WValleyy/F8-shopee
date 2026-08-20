import mongoose, { Schema } from 'mongoose';
import commerceConfig from '../../config/commerce.js';

const checkoutDraftItemSchema = new Schema(
    {
        variant: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            max: commerceConfig.order.maxItemQuantity,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Checkout quantity must be an integer.',
            },
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
            max: commerceConfig.order.maxUnitPrice,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Checkout unit price must be an integer.',
            },
        },
    },
    { _id: false },
);

const checkoutDraftSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        source: {
            type: String,
            enum: ['cart', 'buy-now'],
            required: true,
        },
        items: {
            type: [checkoutDraftItemSchema],
            required: true,
            validate: {
                validator(items) {
                    return items.length > 0
                        && items.length <= commerceConfig.cart.maxItems;
                },
                message: 'Checkout must contain between 1 and 50 items.',
            },
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false,
        },
    }
);

checkoutDraftSchema.index({ user: 1, createdAt: 1 });
checkoutDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CheckoutDraft = mongoose.model('CheckoutDraft', checkoutDraftSchema);

export default CheckoutDraft;
