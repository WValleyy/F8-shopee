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

async function recordUserSearchHistory(userId, input) {
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
        updatePipeline: true,
    };

    try {
        await UserSearchHistory.updateOne(
            { user: userObjectId },
            pipeline,
            { ...options, upsert: true },
        );
    } catch (error) {
        if (error?.code !== 11000)
            throw error;

        await UserSearchHistory.updateOne(
            { user: userObjectId },
            pipeline,
            options,
        );
    }

}

async function removeUserSearchHistoryItem(userId, normalizedQuery) {
    await UserSearchHistory.updateOne(
        { user: userId },
        { $pull: { items: { normalizedQuery } } },
    );
}

export {
    listUserSearchHistory,
    recordUserSearchHistory,
    removeUserSearchHistoryItem,
};
