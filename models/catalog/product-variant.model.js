import mongoose, { Schema } from 'mongoose';

import inputLimits from '../../config/input-limits.js';
import imageAssetSchema from './image-asset.schema.js';

const optionSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.productVariant.optionNameMaxLength,
        },

        value: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.productVariant.optionValueMaxLength,
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
        },

        sku: {
            type: String,
            trim: true,
            maxlength: inputLimits.productVariant.skuMaxLength,
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
            validate: {
                validator: Number.isSafeInteger,
                message: 'Price must be an integer.',
            },
        },

        originalPrice: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Original price must be an integer.',
            },
        },

        stock: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Stock must be an integer.',
            },
        },

        image: {
            type: imageAssetSchema,
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

productVariantSchema.index({
    product: 1,
});

const ProductVariant = mongoose.model(
    'ProductVariant',
    productVariantSchema
);

export default ProductVariant;
