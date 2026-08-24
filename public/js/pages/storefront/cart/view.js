import { formatPrice } from "../../../shared/lib/format-price.js";

function createCartView(root, state) {
  const cartHeader = root.querySelector("[data-cart-header]");
  const cartFooter = root.querySelector("[data-cart-footer]");
  const emptyState = root.querySelector("[data-cart-empty-state]");
  const headerSelectAll = root.querySelector("[data-cart-header] [data-cart-select-all]");
  const footerSelectAll = root.querySelector("[data-cart-footer] [data-cart-select-all]");
  const summaryLabel = root.querySelector("[data-cart-select-all-label]");
  const selectedCount = root.querySelector("[data-cart-selected-count]");
  const summaryTotal = root.querySelector("[data-cart-total]");
  const checkoutButton = root.querySelector("[data-cart-checkout]");

  function renderSummary() {
    const items = state.getItems();
    const selectableItems = state.selectableItems();
    const selectedItems = state.selectedItems();
    selectedCount.textContent = `Đã chọn (${selectedItems.length})`;
    const allSelected =
      selectableItems.length > 0 &&
      selectableItems.every((item) => item.selected);
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    [headerSelectAll, footerSelectAll].forEach((checkbox) => {
      checkbox.checked = allSelected;
      checkbox.indeterminate = selectedItems.length > 0 && !allSelected;
      checkbox.disabled = selectableItems.length === 0;
    });

    summaryLabel.textContent = `Chọn tất cả (${items.length})`;
    summaryTotal.textContent = formatPrice(subtotal);

    const checkoutEnabled =
      selectedItems.length > 0 && !state.hasPendingMutation();

    checkoutButton.disabled = !checkoutEnabled;
  }

  function syncItemTotal(item) {
    const buttons = item.row.querySelectorAll("[data-cart-decrease], [data-cart-increase]");
    const input = item.row.querySelector("[data-cart-quantity-input]");

    input.value = String(item.quantity);
    input.disabled = item.quantityPending;
    buttons[0].disabled = item.quantityPending || item.quantity <= 1;
    buttons[1].disabled =
      item.quantityPending || item.quantity >= item.maxQuantity;
    item.row.querySelector("[data-cart-item-total]").textContent = formatPrice(
      item.price * item.quantity,
    );
  }

  function setQuantityPending(item, pending) {
    item.quantityPending = pending;
    syncItemTotal(item);
    renderSummary();
  }

  function setCheckoutPending(pending) {
    checkoutButton.disabled =
      pending ||
      state.selectedItems().length === 0 ||
      state.hasPendingMutation();
  }

  function removeItems(items) {
    items.forEach((item) => {
      item.row.remove();
    });
    state.removeItems(items);
    renderSummary();

    if (state.getItems().length) return;

    cartHeader.hidden = true;
    cartFooter.hidden = true;
    emptyState.hidden = false;
  }

  return {
    removeItems,
    renderSummary,
    setCheckoutPending,
    setQuantityPending,
  };
}

export { createCartView };
