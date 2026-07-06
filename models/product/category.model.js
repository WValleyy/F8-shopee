import mongoose, { Schema } from 'mongoose';
import slugify from 'slugify';

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        slug: {
            type: String,
            unique: true,
            index: true,
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

categorySchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
        });
    }

    next();
});

const Category = mongoose.model('Category', categorySchema);

export default Category;