import mongoose, { Schema } from 'mongoose';

import inputLimits from '../../config/input-limits.js';
import '../user/user.model.js';

const searchHistoryItemSchema = new Schema(
    {
        query: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.search.queryMaxLength,
        },
        normalizedQuery: {
            type: String,
            required: true,
            trim: true,
            maxlength: inputLimits.search.queryMaxLength,
        },
    },
    {
        _id: false,
    },
);

const userSearchHistorySchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        items: {
            type: [searchHistoryItemSchema],
            default: [],
            validate: {
                validator(items) {
                    return items.length <= inputLimits.search.historyMaxItems;
                },
                message: `Search history cannot contain more than ${inputLimits.search.historyMaxItems} items.`,
            },
        },
    },
    {
        timestamps: true,
    },
);

const UserSearchHistory = mongoose.model(
    'UserSearchHistory',
    userSearchHistorySchema,
);

export default UserSearchHistory;
