import mongoose, { Schema } from 'mongoose';
import slugify from 'slugify';

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
        },

        slug: {
            type: String,
            index: true,
        },

        description: {
            type: String,
            trim: true,
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
            default: '',
        },

        images: {
            type: [String],
            default: [],
        },

        specifications: {
            type: [specificationSchema],
            default: [],
        },

        rating: {
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
            default: true,
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

productSchema.pre('validate', function (next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
        });
    }

    next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;