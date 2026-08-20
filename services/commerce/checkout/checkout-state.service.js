import ProductVariant from '../../../models/catalog/product-variant.model.js';
import { getEffectiveActiveLeafCategoryIds } from '../../catalog/category.service.js';
import { toLineItemViewModel } from '../line-item-view-model.js';

async function buildCheckoutSelection(options = {}) {
    const {
        session = null,
        checkoutSource: source,
        selectedItems = [],
    } = options;
    const selectedItemMap = new Map(
        selectedItems.map(item => [item.variantId, item]),
    );
    const variantQuery = ProductVariant
        .find({ _id: { $in: [...selectedItemMap.keys()] } })
        .select('_id product image isPublished options price stock')
        .populate({
            path: 'product',
            select: '_id category isPublished name slug',
        })
        .lean();

    if (session)
        variantQuery.session(session);

    let variants = null;
    let activeCategoryIds = null;

    if (session) {
        variants = await variantQuery;
        activeCategoryIds = await getEffectiveActiveLeafCategoryIds({ session });
    } else {
        [variants, activeCategoryIds] = await Promise.all([
            variantQuery,
            getEffectiveActiveLeafCategoryIds({ session }),
        ]);
    }
    const activeCategoryIdSet = new Set(activeCategoryIds.map(String));
    const variantMap = new Map(
        variants.map(variant => [variant._id.toString(), variant]),
    );
    const items = [];
    let hasUnavailableItems = false;

    for (const selectedItem of selectedItemMap.values()) {
        const variant = variantMap.get(selectedItem.variantId);

        if (!variant) {
            hasUnavailableItems = true;
            continue;
        }

        if (!variant.isPublished) {
            hasUnavailableItems = true;
            continue;
        }

        if (!variant.product || !variant.product.isPublished) {
            hasUnavailableItems = true;
            continue;
        }

        const categoryId = variant.product.category.toString();

        if (!activeCategoryIdSet.has(categoryId)) {
            hasUnavailableItems = true;
            continue;
        }

        if (
            !Number.isSafeInteger(variant.stock)
            || variant.stock < selectedItem.quantity
        ) {
            hasUnavailableItems = true;
            continue;
        }

        items.push(toLineItemViewModel({
            variant,
            quantity: selectedItem.quantity,
            unitPrice: selectedItem.unitPrice,
        }));
    }

    return {
        source,
        items,
        hasUnavailableItems,
        totalAmount: items.reduce((sum, item) => sum + item.total, 0),
    };
}

export {
    buildCheckoutSelection,
};
