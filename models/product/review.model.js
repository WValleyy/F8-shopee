import mongoose, { Schema } from 'mongoose';

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
            required: true,
            index: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        content: {
            type: String,
            trim: true,
            default: '',
        },

        images: {
            type: [String],
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
    }
);

reviewSchema.index({
    product: 1,
    createdAt: -1,
});

reviewSchema.index({
    user: 1,
    product: 1,
});

const Review = mongoose.model('Review', reviewSchema);

export default Review;