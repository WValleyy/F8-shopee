import { mountProductCardWishlist } from "../../../features/wishlist/product-card.js";
import { mountHeader } from "../../../widgets/header/header.js";
import { mountProductDetail } from "./detail/detail.js";
import { mountProductGallery } from "./gallery.js";
import { mountProductReviews } from "./reviews.js";

function mountProductPage() {
  const root = document.querySelector("[data-product-page]");
  const initialState = JSON.parse(
    root.querySelector("[data-page-initial-state]").textContent,
  );

  mountHeader();
  const gallery = mountProductGallery(root);
  mountProductDetail({
    root: root.querySelector("[data-product-detail]"),
    initialState: initialState.variant,
    gallery,
  });
  mountProductCardWishlist(root.querySelector("[data-related-products]"));
  mountProductReviews({
    root: root.querySelector("[data-product-reviews]"),
    initialState: initialState.review,
  });
}

mountProductPage();
