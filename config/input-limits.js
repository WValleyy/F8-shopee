// config/input-limits.js

const inputLimits = Object.freeze({
    auth: {
        passwordMinLength: 6,
        passwordMaxLength: 128,
    },

    authSession: {
        userAgentMaxLength: 500,
        deviceLabelMaxLength: 120,
    },

    user: {
        userNameMaxLength: 30,
        userNameMinLength: 3,
        nameMaxLength: 100,
        emailMaxLength: 254,
        phoneMaxLength: 16,
    },

    address: {
        maxPerUser: 10,
        fullNameMaxLength: 100,
        phoneMaxLength: 16,
        provinceMaxLength: 100,
        wardMaxLength: 100,
        detailMaxLength: 300,
    },

    phone: {
        minDigits: 9,
        maxDigits: 15,
    },

    review: {
        contentMaxLength: 2000,
    },

    category: {
        nameMaxLength: 100,
    },

    product: {
        nameMaxLength: 180,
        descriptionMaxLength: 5000,
        brandMaxLength: 80,
    },

    productVariant: {
        skuMaxLength: 64,
        optionNameMaxLength: 50,
        optionValueMaxLength: 100,
    },

    search: {
        queryMaxLength: 128,
        historyMaxItems: 6,
    },

    order: {
        noteMaxLength: 500,
    },

    adminProduct: {
        bulkActionMaxItems: 100,
        maxVariants: 50,
        maxSpecifications: 50,
        specificationValueMaxLength: 300,
    },
});

export default inputLimits;
