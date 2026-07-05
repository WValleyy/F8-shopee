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

        type: {
            type: String,
            enum: ['string', 'number', 'boolean'],
            default: 'string',
        },

        unit: {
            type: String,
            default: '',
        },

        isFilterable: {
            type: Boolean,
            default: true,
        },

        sortOrder: {
            type: Number,
            default: 0,
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