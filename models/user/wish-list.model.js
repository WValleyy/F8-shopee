import mongoose, { Schema } from 'mongoose';
import '../catalog/product.model.js';

const wishListSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

wishListSchema.index(
    { user: 1, product: 1 },
    { unique: true },
);

const WishList = mongoose.model('WishList', wishListSchema);

export default WishList;
