import { showToast } from "../../shared/ui/toast.js";
import { openAuthModal } from "../auth/auth.js";
import { isAuthenticated } from "../auth/state.js";
import { setProductWishlist } from "./api.js";

function mountProductCardWishlist(root) {
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-product-card-wishlist]");

    if (!button || !root.contains(button)) return;

    if (!isAuthenticated()) {
      openAuthModal("login");
      return;
    }

    const isWishlisted = button.getAttribute("aria-pressed") !== "true";

    if (button.dataset.pending === "true") return;

    button.dataset.pending = "true";

    try {
      await setProductWishlist(button.dataset.productId, isWishlisted);
      button.setAttribute("aria-pressed", String(isWishlisted));
    } catch (error) {
      if (error.status === 401) openAuthModal("login");
      else showToast(error.message, "error");
    } finally {
      delete button.dataset.pending;
    }
  });
}

export { mountProductCardWishlist };
