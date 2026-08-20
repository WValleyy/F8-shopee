function createCartState(root) {
  let items = [...root.querySelectorAll("[data-cart-item][data-variant-id]")].map(
    (row) => ({
      row,
      variantId: row.dataset.variantId,
      available: row.dataset.available === "true",
      maxQuantity: Number(row.dataset.maxQuantity),
      quantityPending: false,
      removalPending: false,
      selected: row.querySelector("[data-cart-item-select]").checked,
      quantity: Number(row.querySelector("[data-cart-quantity-input]").value),
      price: Number(row.dataset.price),
    }),
  );

  function getItems() {
    return items;
  }

  function removeItems(itemsToRemove) {
    const removedItems = new Set(itemsToRemove);

    items = items.filter((item) => !removedItems.has(item));
  }

  function selectedItems() {
    return getItems().filter((item) => item.available && item.selected);
  }

  function selectableItems() {
    return getItems().filter((item) => item.available);
  }

  function hasPendingMutation() {
    return selectedItems().some(
      (item) => item.quantityPending || item.removalPending,
    );
  }

  function findItem(row) {
    return items.find((item) => item.row === row);
  }

  return {
    findItem,
    getItems,
    hasPendingMutation,
    removeItems,
    selectableItems,
    selectedItems,
  };
}

export { createCartState };
