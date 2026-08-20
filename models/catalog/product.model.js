import mongoose, { Schema } from 'mongoose';
import slugify from 'slugify';

import inputLimits from '../../config/input-limits.js';
import imageAssetSchema from './image-asset.schema.js';
import './attribute.model.js';

const specificationSchema = new Schema(
    {
        attribute: {
            type: Schema.Types.ObjectId,
            ref: 'Attribute',
            required: true,
        },

        value: {
            type: Schema.Types.Mixed,
            required: true,
        },
    },
    {
        _id: false,
    }
);

const productSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.product.nameMaxLength,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
        },

        description: {
            type: String,
            trim: true,
            maxlength: inputLimits.product.descriptionMaxLength,
            default: '',
        },

        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            index: true,
        },

        brand: {
            type: String,
            trim: true,
            maxlength: inputLimits.product.brandMaxLength,
            default: '',
        },

        images: {
            type: [imageAssetSchema],
            default: [],
        },

        specifications: {
            type: [specificationSchema],
            default: [],
        },

        rating: {
            sum: {
                type: Number,
                default: 0,
                min: 0,
                validate: {
                    validator: Number.isSafeInteger,
                    message: 'Product rating sum must be an integer.',
                },
            },

            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 5,
            },

            count: {
                type: Number,
                default: 0,
                min: 0,
                validate: {
                    validator: Number.isSafeInteger,
                    message: 'Product rating count must be an integer.',
                },
            },
        },

        likes: {
            type: Number,
            default: 0,
            min: 0,
        },

        sold: {
            type: Number,
            default: 0,
            min: 0,
        },

        isPublished: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

productSchema.index({
    category: 1,
    isPublished: 1,
});

productSchema.index({
    name: 'text',
});

productSchema.pre('validate', async function () {
    if (this.isModified('name')) {
        const baseSlug = slugify(this.name, {
            lower: true,
            strict: true,
        });
        const normalizedBaseSlug = baseSlug || 'product';
        const existingProduct = await this.constructor.exists({
            _id: { $ne: this._id },
            slug: normalizedBaseSlug,
        });

        this.slug = existingProduct
            ? `${normalizedBaseSlug}-${this._id.toString().slice(-6)}`
            : normalizedBaseSlug;
    }
});

const Product = mongoose.model('Product', productSchema);

export default Product;
