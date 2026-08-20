import mongoose, { Schema } from 'mongoose';
import slugify from 'slugify';

import inputLimits from '../../config/input-limits.js';

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.category.nameMaxLength,
        },

        slug: {
            type: String,
            unique: true
        },


        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
        },

        isActive: {
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

categorySchema.index({ parent: 1, name: 1 }, { unique: true });

categorySchema.pre('validate', function () {
    if (!this.slug) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
        });
    }
});

const Category = mongoose.model('Category', categorySchema);

export default Category;
