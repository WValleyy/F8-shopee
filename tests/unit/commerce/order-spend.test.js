import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    logAppEvent: vi.fn(),
    orderAggregate: vi.fn(),
    refundAggregate: vi.fn(),
}));

vi.mock('../../../models/commerce/order.model.js', () => ({
    default: {
        aggregate: mocks.orderAggregate,
        collection: { name: 'orders' },
    },
}));

vi.mock('../../../models/commerce/order-return-request.model.js', () => ({
    default: {
        aggregate: mocks.refundAggregate,
        collection: { name: 'orderreturnrequests' },
    },
}));

vi.mock('../../../utils/error/app-error-logger.js', () => ({
    logAppEvent: mocks.logAppEvent,
}));

const {
    buildCompletedSpendLookupStages,
    getCompletedSpendByUserIds,
    getRevenueSummary,
} = await import('../../../services/commerce/order/order-spend.service.js');

// Spend summaries protect the revenue and customer-spend money contract.
describe('order spend summary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subtracts completed returns from COD revenue', async () => {
        mocks.orderAggregate.mockResolvedValue([{
            completed: [{ total: 500_000 }],
        }]);
        mocks.refundAggregate.mockResolvedValue([{
            returns: [{ total: 100_000 }],
        }]);

        await expect(getRevenueSummary()).resolves.toEqual({
            grossRevenue: 500_000,
            netRevenue: 400_000,
        });
    });

    it('subtracts returned amounts from each user completed spend', async () => {
        mocks.orderAggregate.mockResolvedValue([
            { _id: { toString: () => 'user-a' }, total: 300_000 },
        ]);
        mocks.refundAggregate.mockResolvedValue([
            { _id: { toString: () => 'user-a' }, total: 50_000 },
        ]);

        const result = await getCompletedSpendByUserIds([
            '507f1f77bcf86cd799439011',
        ]);

        expect(result.get('user-a')).toEqual({
            grossSpend: 300_000,
            netSpend: 250_000,
        });
    });

    it('builds completed-order lookup stages with returned amount subtraction', () => {
        const stages = buildCompletedSpendLookupStages();
        const orderLookup = stages[0].$lookup;
        const returnLookup = stages[1].$lookup;

        expect(orderLookup.pipeline[0].$match.status).toBe('COMPLETED');
        expect(returnLookup.pipeline[0].$match).toMatchObject({
            $expr: { $eq: ['$user', '$$userId'] },
        });
        expect(stages).toContainEqual({
            $set: {
                netSpend: {
                    $subtract: ['$grossSpend', '$returnedAmount'],
                },
            },
        });
    });
});
