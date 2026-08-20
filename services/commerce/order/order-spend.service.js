import mongoose from 'mongoose';

import OrderReturnRequest from '../../../models/commerce/order-return-request.model.js';
import Order from '../../../models/commerce/order.model.js';

const COMPLETED_ORDER_FILTER = Object.freeze({ status: 'COMPLETED' });
function emptySpendSummary() {
    return {
        grossSpend: 0,
        netSpend: 0,
    };
}

function buildCompletedSpendLookupStages() {
    return [
        {
            $lookup: {
                from: Order.collection.name,
                let: { userId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$user', '$$userId'] },
                            ...COMPLETED_ORDER_FILTER,
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
                ],
                as: 'completedSpend',
            },
        },
        {
            $lookup: {
                from: OrderReturnRequest.collection.name,
                let: { userId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$user', '$$userId'] },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ],
                as: 'completedReturns',
            },
        },
        {
            $set: {
                grossSpend: {
                    $ifNull: [{ $first: '$completedSpend.total' }, 0],
                },
                returnedAmount: {
                    $ifNull: [{ $first: '$completedReturns.total' }, 0],
                },
            },
        },
        {
            $set: {
                netSpend: { $subtract: ['$grossSpend', '$returnedAmount'] },
            },
        },
        { $unset: ['completedSpend', 'completedReturns', 'returnedAmount'] },
    ];
}

async function getRevenueSummary() {
    const [orderRows = {}, returnRows = {}] = await Promise.all([
        Order.aggregate([{
            $facet: {
                completed: [
                    { $match: COMPLETED_ORDER_FILTER },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
                ],
            },
        }]).then(rows => rows[0] || {}),
        OrderReturnRequest.aggregate([{
            $facet: {
                returns: [
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ],
            },
        }]).then(rows => rows[0] || {}),
    ]);
    const grossRevenue = orderRows.completed?.[0]?.total ?? 0;
    const returnedAmount = returnRows.returns?.[0]?.total ?? 0;

    return {
        grossRevenue,
        netRevenue: grossRevenue - returnedAmount,
    };
}

async function getCompletedSpendByUserIds(userIds = []) {
    const objectIds = [...new Set(userIds.map(String))]
        .map(id => new mongoose.Types.ObjectId(id));
    const spendByUserId = new Map();

    if (!objectIds.length)
        return spendByUserId;

    const [grossRows, returnRows] = await Promise.all([
        Order.aggregate([
            {
                $match: {
                    user: { $in: objectIds },
                    ...COMPLETED_ORDER_FILTER,
                },
            },
            { $group: { _id: '$user', total: { $sum: '$totalAmount' } } },
        ]),
        OrderReturnRequest.aggregate([
            {
                $match: {
                    user: { $in: objectIds },
                },
            },
            { $group: { _id: '$user', total: { $sum: '$amount' } } },
        ]),
    ]);
    const grossByUserId = new Map(
        grossRows.map(row => [row._id.toString(), row.total]),
    );
    const returnedByUserId = new Map(
        returnRows.map(row => [row._id.toString(), row.total]),
    );
    const resultUserIds = new Set([
        ...grossByUserId.keys(),
        ...returnedByUserId.keys(),
    ]);
    for (const userId of resultUserIds) {
        const gross = grossByUserId.get(userId) ?? 0;
        const returned = returnedByUserId.get(userId) ?? 0;

        spendByUserId.set(userId, {
            grossSpend: gross,
            netSpend: gross - returned,
        });
    }

    return spendByUserId;
}

export {
    buildCompletedSpendLookupStages,
    emptySpendSummary,
    getCompletedSpendByUserIds,
    getRevenueSummary,
};
