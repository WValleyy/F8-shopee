import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    endSession: vi.fn(),
    productUpdateMany: vi.fn(),
    startSession: vi.fn(),
    variantDistinct: vi.fn(),
}));

vi.mock('mongoose', async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        default: {
            ...actual.default,
            startSession: mocks.startSession,
        },
    };
});

vi.mock('../../../models/catalog/product.model.js', () => ({
    default: {
        updateMany: mocks.productUpdateMany,
    },
}));

vi.mock('../../../models/catalog/product-variant.model.js', () => ({
    default: {
        distinct: mocks.variantDistinct,
    },
}));

import {
    applyAdminProductBulkAction,
    saveAdminProduct,
} from '../../../services/admin/catalog/admin-product.service.js';

function transactionSession() {
    return {
        endSession: mocks.endSession,
        withTransaction: callback => callback(),
    };
}

// Product publication validates variant eligibility and publishes products in one transaction.
describe('admin product publication invariant', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a published product without a published variant', async () => {
        await expect(saveAdminProduct(null, {
            isPublished: true,
            variants: [{ isPublished: false }],
        })).rejects.toMatchObject({
            code: 'PUBLISHED_PRODUCT_REQUIRES_PUBLISHED_VARIANT',
            statusCode: 400,
        });
    });

    it('rejects bulk publish when any product has no published variant', async () => {
        const session = transactionSession();

        mocks.startSession.mockResolvedValue(session);
        mocks.variantDistinct.mockReturnValue({
            session: vi.fn().mockResolvedValue(['product-1']),
        });

        await expect(applyAdminProductBulkAction(
            ['product-1', 'product-2'],
            'PUBLISH',
        )).rejects.toMatchObject({
            code: 'PUBLISHED_PRODUCT_REQUIRES_PUBLISHED_VARIANT',
            meta: { productIds: ['product-2'] },
        });
        expect(mocks.productUpdateMany).not.toHaveBeenCalled();
        expect(mocks.endSession).toHaveBeenCalledOnce();
    });

    it('publishes eligible products in the same transaction', async () => {
        const session = transactionSession();
        const variantQuery = {
            session: vi.fn().mockResolvedValue(['product-1', 'product-2']),
        };

        mocks.startSession.mockResolvedValue(session);
        mocks.variantDistinct.mockReturnValue(variantQuery);

        const result = await applyAdminProductBulkAction(
            ['product-1', 'product-2'],
            'PUBLISH',
        );

        expect(result).toBeUndefined();
        expect(variantQuery.session).toHaveBeenCalledWith(session);
        expect(mocks.productUpdateMany).toHaveBeenCalledWith(
            { _id: { $in: ['product-1', 'product-2'] } },
            { $set: { isPublished: true } },
            { session },
        );
        expect(mocks.endSession).toHaveBeenCalledOnce();
    });
});
