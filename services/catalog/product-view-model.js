function toProductCardViewModel({
    _id,
    slug,
    name,
    productImage,
    variantImage,
    price,
    originalPrice,
    sold,
    rating,
    isWishlisted = false,
}) {
    return {
        id: _id.toString(),
        slug,
        name,
        image: productImage || variantImage || '',
        price,
        originalPrice,
        sold,
        rating,
        isWishlisted,
    };
}

export {
    toProductCardViewModel,
};
