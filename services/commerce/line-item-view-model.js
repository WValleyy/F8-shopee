function toLineItemViewModel(item) {
    const variant = item.variant;
    const product = variant.product;
    const price = Number.isSafeInteger(item.unitPrice)
        ? item.unitPrice
        : variant.price;

    return {
        variantId: variant._id.toString(),
        productId: product._id.toString(),
        productSlug: product.slug,
        productName: product.name,
        image: variant.image.url,
        options: variant.options,
        price,
        quantity: item.quantity,
        total: price * item.quantity,
    };
}

export {
    toLineItemViewModel,
};
