const PRODUCT_SEARCH_INDEX_NAME = 'product-search';

const PRODUCT_SEARCH_INDEX_DEFINITION = {
    mappings: {
        dynamic: false,
        fields: {
            name: [
                {
                    type: 'string',
                },
                {
                    type: 'autocomplete',
                    tokenization: 'edgeGram',
                    minGrams: 2,
                    maxGrams: 15,
                    foldDiacritics: true,
                },
            ],
            brand: {
                type: 'string',
            },
            description: {
                type: 'string',
            },
            category: {
                type: 'objectId',
            },
            isPublished: {
                type: 'boolean',
            },
        },
    },
};

export {
    PRODUCT_SEARCH_INDEX_DEFINITION,
    PRODUCT_SEARCH_INDEX_NAME,
};
