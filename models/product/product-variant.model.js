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

const productVariantSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
        },

        sku: {
            type: String,
            trim: true,
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

        originalPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        stock: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        image: {
            type: String,
            default: '',
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

productVariantSchema.index({
    product: 1,
});

const ProductVariant = mongoose.model(
    'ProductVariant',
    productVariantSchema
);

export default ProductVariant;