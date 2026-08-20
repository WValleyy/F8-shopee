import { Schema } from 'mongoose';

const imageAssetSchema = new Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true,
        },

        publicId: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        _id: false,
    },
);

export default imageAssetSchema;
