import mongoose, { Schema } from 'mongoose';


const integerMoneyValidator = {
    validator: Number.isSafeInteger,
    message: 'Money values must be integers.',
};

const returnItemSchema = new Schema(
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
            default: '',
        },
        options: {
            type: [Schema.Types.Mixed],
            default: [],
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Returned quantity must be an integer.',
            },
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
            validate: integerMoneyValidator,
        },
    },
    {
        _id: false,
    },
);

const orderReturnRequestSchema = new Schema(
    {
        order: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        requestKey: {
            type: String,
            required: true,
            trim: true,
        },
        items: {
            type: [returnItemSchema],
            default: [],
            validate: {
                validator: items => Array.isArray(items) && items.length > 0,
                message: 'A return request must contain at least one item.',
            },
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
            validate: integerMoneyValidator,
        },
    },
    {
        timestamps: true,
    },
);

orderReturnRequestSchema.index(
    { order: 1, requestKey: 1 },
    { unique: true },
);
orderReturnRequestSchema.index({
    user: 1,
    createdAt: -1,
});

const OrderReturnRequest = mongoose.model(
    'OrderReturnRequest',
    orderReturnRequestSchema,
);

export default OrderReturnRequest;
