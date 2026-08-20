import { requestJson } from "../../../shared/api/http-client.js";
import { showToast } from "../../../shared/ui/toast.js";
import { renderHeaderCartPreview } from "../../../widgets/header/cart-preview.js";

function mountCartActions({ root, state, view }) {
  let checkoutPending = false;

  async function updateQuantity(item, quantity) {
    if (!item.available || item.quantityPending) return;

    view.setQuantityPending(item, true);

    try {
      const data = await requestJson(`/api/cart/items/${item.variantId}`, {
        method: "PATCH",
        body: { quantity },
      });
      item.quantity = quantity;
      renderHeaderCartPreview(data.cartPreview);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      view.setQuantityPending(item, false);
    }
  }

  async function removeItems(items, endpoint, body) {
    if (items.some((item) => item.removalPending || item.quantityPending)) {
      return;
    }

    items.forEach((item) => {
      item.removalPending = true;
    });
    view.renderSummary();

    try {
      const data = await requestJson(endpoint, {
        method: "DELETE",
        ...(body ? { body } : {}),
      });
      view.removeItems(items);
      renderHeaderCartPreview(data.cartPreview);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      items.forEach((item) => {
        item.removalPending = false;
      });
      view.renderSummary();
    }
  }

  function selectAll(selected) {
    state.selectableItems().forEach((item) => {
      item.selected = selected;
      item.row.querySelector("[data-cart-item-select]").checked = selected;
    });
    view.renderSummary();
  }

  root.addEventListener("change", (event) => {
    const row = event.target.closest("[data-cart-item][data-variant-id]");

    if (row && event.target.matches("[data-cart-item-select]")) {
      state.findItem(row).selected = event.target.checked;
      view.renderSummary();
      return;
    }

    if (row && event.target.matches("[data-cart-quantity-input]")) {
      void updateQuantity(state.findItem(row), Number(event.target.value));
      return;
    }

    if (event.target.matches("[data-cart-select-all]")) {
      selectAll(event.target.checked);
    }
  });

  root.addEventListener("click", (event) => {
    const row = event.target.closest("[data-cart-item][data-variant-id]");

    if (row) {
      const item = state.findItem(row);
      const quantityButton = event.target.closest(
        "[data-cart-decrease], [data-cart-increase]",
      );

      if (quantityButton) {
        event.preventDefault();
        const delta = quantityButton.matches("[data-cart-decrease]") ? -1 : 1;

        void updateQuantity(item, item.quantity + delta);
        return;
      }

      if (event.target.closest("[data-cart-remove-item]")) {
        event.preventDefault();
        void removeItems([item], `/api/cart/items/${item.variantId}`);
        return;
      }
    }

    if (event.target.closest("[data-cart-remove-selected]")) {
      event.preventDefault();

      const items = state.selectedItems();

      if (items.length) {
        void removeItems(items, "/api/cart/items", {
          variantIds: items.map((item) => item.variantId),
        });
      }
      return;
    }

    if (event.target.closest("[data-cart-checkout]")) {
      event.preventDefault();
      void checkout();
    }
  });

  async function checkout() {
    if (checkoutPending || state.hasPendingMutation()) return;

    const items = state.selectedItems().map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    if (!items.length) return;

    checkoutPending = true;
    view.setCheckoutPending(true);

    try {
      const draftId = await requestJson("/api/checkout/drafts", {
        method: "POST",
        body: { source: "cart", items },
      });
      window.location.assign(`/checkout?draft=${encodeURIComponent(draftId)}`);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      checkoutPending = false;
      view.setCheckoutPending(false);
    }
  }
}

export { mountCartActions };
