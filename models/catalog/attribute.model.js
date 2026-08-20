import mongoose, { Schema } from 'mongoose';

const attributeSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            index: true,
        },

        unit: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

attributeSchema.index(
    {
        category: 1,
        name: 1,
    },
    {
        unique: true,
    }
);

const Attribute = mongoose.model('Attribute', attributeSchema);

export default Attribute;
