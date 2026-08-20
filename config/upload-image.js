const ONE_MEGABYTE = 1024 * 1024;

const uploadLimits = Object.freeze({
    review: Object.freeze({
        maxFiles: 3,
        maxFileBytes: ONE_MEGABYTE,
        maxTotalBytes: 3 * ONE_MEGABYTE,
    }),
    product: Object.freeze({
        maxFiles: 8,
        maxFileBytes: ONE_MEGABYTE,
        maxTotalBytes: 4 * ONE_MEGABYTE,
    }),
    avatar: Object.freeze({
        maxFileBytes: ONE_MEGABYTE,
    }),
});

const uploadFolders = Object.freeze({
    product: 'f8-shopee/products',
    avatar: 'f8-shopee/avatars',
    review: 'f8-shopee/reviews',
});

export {
    uploadFolders,
    uploadLimits,
};
