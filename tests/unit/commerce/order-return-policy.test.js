import { describe, expect, it } from 'vitest';

import {
    isOrderReturnWindowOpen,
} from '../../../services/commerce/order/order-policy.js';

// Order return eligibility is determined by status and the return window.
describe('order return policy', () => {
    it('keeps a completed order returnable for seven days', () => {
        const completedAt = new Date('2026-07-01T00:00:00.000Z');

        expect(isOrderReturnWindowOpen(
            { status: 'COMPLETED', completedAt },
            new Date('2026-07-08T00:00:00.000Z'),
        )).toBe(true);
    });

    it('rejects returns after the deadline or without a completion time', () => {
        expect(isOrderReturnWindowOpen(
            {
                status: 'COMPLETED',
                completedAt: new Date('2026-07-01T00:00:00.000Z'),
            },
            new Date('2026-07-08T00:00:00.001Z'),
        )).toBe(false);
        expect(isOrderReturnWindowOpen({
            status: 'COMPLETED',
            completedAt: null,
        })).toBe(false);
    });
});
