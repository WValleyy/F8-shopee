import { requestJson } from "../../shared/api/http-client.js";

function setProductWishlist(productId, isWishlisted, options = {}) {
  return requestJson(`/api/wishlist/${productId}`, {
    method: isWishlisted ? "PUT" : "DELETE",
    ...options,
  });
}

export { setProductWishlist };
