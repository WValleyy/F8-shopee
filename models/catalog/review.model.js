import mongoose, { Schema } from 'mongoose';
import imageAssetSchema from './image-asset.schema.js';
import inputLimits from '../../config/input-limits.js';

const reviewSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
        },

        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required() {
                return !this.authorDeletedAt;
            },
            default: null,
            index: true,
        },

        authorDeletedAt: {
            type: Date,
            default: null,
        },

        order: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true,
        },

        variant: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            required: true,
            index: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            validate: {
                validator: Number.isSafeInteger,
                message: 'Review rating must be an integer.',
            },
        },

        content: {
            type: String,
            trim: true,
            default: '',
            maxlength: inputLimits.review.contentMaxLength,
        },

        images: {
            type: [imageAssetSchema],
            default: [],
        },

        likedBy: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                },
            ],
            default: [],
        },

        isPublished: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    },
);

reviewSchema.index({ product: 1, isPublished: 1, createdAt: -1 });
reviewSchema.index({ user: 1, isPublished: 1, createdAt: -1 });
reviewSchema.index(
    { order: 1, variant: 1 },
    {
        unique: true,
        partialFilterExpression: { order: { $exists: true } },
    },
);

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

export default Review;
