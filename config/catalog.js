const catalogSortDefinitions = Object.freeze({
    popular: {
        group: 'ranking',
        fields: [
            ['sold', -1],
            ['rating.average', -1],
        ],
    },
    newest: {
        group: 'ranking',
        fields: [['createdAt', -1]],
    },
    'most-liked': {
        group: 'ranking',
        fields: [
            ['likes', -1],
            ['rating.average', -1],
        ],
    },
    'price-asc': {
        group: 'price',
        fields: [['variantDoc.price', 1]],
    },
    'price-desc': {
        group: 'price',
        fields: [['variantDoc.price', -1]],
    },
});

const catalogSortGroups = Object.freeze(
    Object.fromEntries(
        Object.entries(catalogSortDefinitions).map(([criterion, definition]) => (
            [criterion, definition.group]
        )),
    ),
);

export {
    catalogSortDefinitions,
    catalogSortGroups,
};
