import { showToast } from "../../../../shared/ui/toast.js";
import { openAuthModal } from "../../../../features/auth/auth.js";
import { isAuthenticated } from "../../../../features/auth/state.js";
import { setProductWishlist } from "../../../../features/wishlist/api.js";

function mountProductWishlist(root) {
  const button = root.querySelector("[data-product-wishlist]");
  const icon = button.querySelector("i");
  const count = button.querySelector("[data-product-wishlist-count]");

  function render(isWishlisted, likesCount) {
    button.setAttribute("aria-pressed", String(isWishlisted));
    icon.classList.toggle("fa-solid", isWishlisted);
    icon.classList.toggle("fa-regular", !isWishlisted);
    count.textContent = String(likesCount);
  }

  button.addEventListener("click", async () => {
    if (!isAuthenticated()) {
      openAuthModal("login");
      return;
    }

    const isWishlisted = button.getAttribute("aria-pressed") !== "true";
    const previousCount = Number(count.textContent);
    const likesCount = Math.max(0, previousCount + (isWishlisted ? 1 : -1));

    button.disabled = true;

    try {
      await setProductWishlist(button.dataset.productId, isWishlisted);
      render(isWishlisted, likesCount);
    } catch (error) {
      if (error.status === 401) openAuthModal("login");
      else showToast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

export { mountProductWishlist };
