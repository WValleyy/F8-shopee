const commerceConfig = Object.freeze({
    cart: Object.freeze({
        maxItems: 50,
    }),
    order: Object.freeze({
        maxItemQuantity: 999,
        maxUnitPrice: 1_000_000_000,
        maxTotalAmount: 10_000_000_000,
    }),
    checkoutDraft: Object.freeze({
        maxActive: 10,
        ttlMinutes: 30,
    }),
    return: Object.freeze({
        windowDays: 7,
    }),
});

export default commerceConfig;
