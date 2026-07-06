import mongoose, { Schema } from 'mongoose';

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
            unique: true,
            index: true,
        },

        items: {
            type: [cartItemSchema],
            default: [],
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