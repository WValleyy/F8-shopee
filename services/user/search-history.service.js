import mongoose from 'mongoose';

import inputLimits from '../../config/input-limits.js';
import UserSearchHistory from '../../models/user/search-history.model.js';

async function listUserSearchHistory(userId) {
    const history = await UserSearchHistory
        .findOne({ user: userId })
        .select('items.query')
        .lean();

    return history?.items.map(item => item.query) || [];
}

async function recordAndListUserSearchHistory(userId, input) {
    const { query, normalizedQuery } = input;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const pipeline = [
        {
            $set: {
                user: userObjectId,
                createdAt: { $ifNull: ['$createdAt', now] },
                updatedAt: now,
                items: {
                    $slice: [
                        {
                            $concatArrays: [
                                {
                                    $literal: [{ query, normalizedQuery }],
                                },
                                {
                                    $filter: {
                                        input: { $ifNull: ['$items', []] },
                                        as: 'item',
                                        cond: {
                                            $ne: [
                                                '$$item.normalizedQuery',
                                                { $literal: normalizedQuery },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                        inputLimits.search.historyMaxItems,
                    ],
                },
            },
        },
    ];
    const options = {
        returnDocument: 'after',
        updatePipeline: true,
    };
    let history;

    try {
        history = await UserSearchHistory.findOneAndUpdate(
            { user: userObjectId },
            pipeline,
            { ...options, upsert: true },
        );
    } catch (error) {
        if (error?.code !== 11000)
            throw error;

        history = await UserSearchHistory.findOneAndUpdate(
            { user: userObjectId },
            pipeline,
            options,
        );
    }

    return history.items.map(item => item.query);
}

async function removeUserSearchHistoryItem(userId, normalizedQuery) {
    await UserSearchHistory.updateOne(
        { user: userId },
        { $pull: { items: { normalizedQuery } } },
    );
}

export {
    listUserSearchHistory,
    recordAndListUserSearchHistory,
    removeUserSearchHistoryItem,
};
