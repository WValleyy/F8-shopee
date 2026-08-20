import { mountProductPurchase } from "./purchase.js";
import { createVariantSelection } from "./variants.js";
import { mountProductWishlist } from "./wishlist.js";

function mountProductDetail({ root, initialState, gallery }) {
  const selection = createVariantSelection(root, initialState, { gallery });

  mountProductPurchase({ root, selection });
  mountProductWishlist(root);
}

export { mountProductDetail };
