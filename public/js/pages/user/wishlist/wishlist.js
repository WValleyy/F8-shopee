import { isAbortError } from "../../../shared/api/http-client.js";
import { showToast } from "../../../shared/ui/toast.js";
import { setProductWishlist } from "../../../features/wishlist/api.js";

function mount({ root, collection, signal }) {
  async function removeProduct(button) {
    button.disabled = true;

    try {
      await setProductWishlist(button.dataset.removeWishlistProduct, false, {
        signal,
      });
      await collection.refresh();
    } catch (error) {
      if (isAbortError(error, signal)) return;

      button.disabled = false;
      showToast(error.message, "error");
    }
  }

  root.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-remove-wishlist-product], [data-product-card-wishlist]",
      );

      if (!button || !root.contains(button)) return;

      if (button.hasAttribute("data-product-card-wishlist")) {
        button.dataset.removeWishlistProduct = button.dataset.productId;
      }

      void removeProduct(button);
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    async (event) => {
      const form = event.target.closest('[data-user-search-form="wishlist"]');

      if (!form) return;

      event.preventDefault();

      const url = new URL(form.action, window.location.origin);
      const query = form.elements.q.value.trim();

      if (query) url.searchParams.set("q", query);

      await collection.load(`${url.pathname}${url.search}`);
    },
    { signal },
  );

  root.addEventListener(
    "account:collection-rendered",
    () => {
      root.querySelector(
        '[data-user-search-form="wishlist"] [name="q"]',
      ).value = new URL(window.location.href).searchParams.get("q") || "";
    },
    { signal },
  );
}

export { mount };
