import mongoose, { Schema } from 'mongoose';

import commerceConfig from '../../config/commerce.js';

const cartItemSchema = new Schema(
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
            default: 1,
            max: commerceConfig.order.maxItemQuantity,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Cart quantity must be an integer.',
            },
        },
    },
    {
        _id: false,
    }
);

const cartSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },

        items: {
            type: [cartItemSchema],
            default: [],
            validate: {
                validator(items) {
                    return items.length <= commerceConfig.cart.maxItems;
                },
                message: `Cart cannot contain more than ${commerceConfig.cart.maxItems} items.`,
            },
        },
    },
    {
        timestamps: true,
    }
);

cartSchema.index({
    'items.variant': 1,
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
