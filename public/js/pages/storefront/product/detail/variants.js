import { formatPrice } from "../../../../shared/lib/format-price.js";

function formatPriceRange(range) {
  return range.min === range.max
    ? formatPrice(range.min)
    : `${formatPrice(range.min)} - ${formatPrice(range.max)}`;
}

function calculateDiscountPercent(price, originalPrice) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(originalPrice) ||
    originalPrice <= 0 ||
    originalPrice <= price
  ) {
    return 0;
  }

  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

function createVariantSelection(root, initialState, { gallery }) {
  const variants = initialState.variants;
  const optionGroups = initialState.optionGroups;
  const optionButtons = [
    ...root.querySelectorAll("[data-option-name][data-option-value]"),
  ];
  const priceElement = root.querySelector("[data-product-price]");
  const originalPriceElement = root.querySelector(
    "[data-product-original-price]",
  );
  const discountElement = root.querySelector("[data-product-discount]");
  const stockElement = root.querySelector("[data-product-stock]");
  const quantityInput = root.querySelector("[data-product-quantity-input]");
  const decreaseButton = root.querySelector("[data-product-quantity-decrease]");
  const increaseButton = root.querySelector("[data-product-quantity-increase]");
  let activeVariant =
    variants.find((variant) => variant.id === initialState.activeVariantId) ||
    null;
  let activeStock = Number(activeVariant?.stock || 0);
  let purchasableListener = null;
  const selectedOptions = { ...(activeVariant?.optionMap || {}) };

  function findVariantBySelection() {
    const complete = optionGroups.every(
      (group) => selectedOptions[group.name] !== undefined,
    );

    if (!complete) return null;

    return (
      variants.find((variant) =>
        optionGroups.every(
          (group) =>
            variant.optionMap[group.name] === selectedOptions[group.name],
        ),
      ) || null
    );
  }

  function matchingVariants(selection, ignoredGroup = "") {
    return variants.filter((variant) =>
      optionGroups.every(
        (group) =>
          group.name === ignoredGroup ||
          selection[group.name] === undefined ||
          variant.optionMap[group.name] === selection[group.name],
      ),
    );
  }

  function getQuantity() {
    const quantity = Math.max(1, Number(quantityInput.value) || 1);

    return activeStock > 0 ? Math.min(quantity, activeStock) : 1;
  }

  function syncDiscount(price, originalPrice) {
    const hasVariantDiscount = originalPrice > price;
    const discount = hasVariantDiscount
      ? Math.max(1, calculateDiscountPercent(price, originalPrice))
      : 0;

    originalPriceElement.hidden = !hasVariantDiscount;
    discountElement.hidden = !hasVariantDiscount;
    discountElement.textContent = discount ? `-${discount}%` : "";
  }

  function syncGalleryImage(imageUrl, options) {
    if (!imageUrl) return;

    gallery.setImage(imageUrl, options);
  }

  function syncOptionAvailability() {
    optionButtons.forEach((button) => {
      const optionName = button.dataset.optionName;
      const selection = {
        ...selectedOptions,
        [optionName]: button.dataset.optionValue,
      };
      const matches = matchingVariants(selection);
      const hasStock = matches.some((variant) => Number(variant.stock) > 0);
      const unavailable = matches.length === 0 || !hasStock;

      button.disabled = unavailable;
      button.dataset.availability =
        matches.length === 0
          ? "invalid"
          : hasStock
            ? "available"
            : "out-of-stock";
    });
  }

  function syncPurchaseState() {
    const available = activeStock > 0;

    quantityInput.value = String(getQuantity());
    quantityInput.disabled = !available;
    decreaseButton.disabled = !available;
    increaseButton.disabled = !available;
    purchasableListener?.(available);
  }

  function applyVariant(variant) {
    activeVariant = variant;
    activeStock = Number(variant.stock);

    priceElement.textContent = formatPrice(variant.price);
    originalPriceElement.textContent = formatPrice(variant.originalPrice);
    syncDiscount(variant.price, variant.originalPrice);
    stockElement.textContent =
      activeStock > 0 ? `Còn ${activeStock} sản phẩm` : "Hết hàng";

    syncGalleryImage(variant.image, { scroll: false });
    syncOptionAvailability();
    syncPurchaseState();
  }

  function renderSelectedOptions() {
    optionButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(
          selectedOptions[button.dataset.optionName] ===
            button.dataset.optionValue,
        ),
      );
    });
  }

  function clearActiveVariant() {
    activeVariant = null;
    activeStock = 0;

    renderSelectedOptions();
    priceElement.textContent = formatPriceRange(initialState.priceRange);
    originalPriceElement.textContent = formatPriceRange(
      initialState.originalPriceRange,
    );
    const hasAnyDiscount = variants.some(
      (variant) => variant.originalPrice > variant.price,
    );

    originalPriceElement.hidden = !hasAnyDiscount;
    discountElement.hidden = true;
    discountElement.textContent = "";
    stockElement.textContent = "Vui lòng chọn phân loại";
    gallery.reset();
    syncOptionAvailability();
    syncPurchaseState();
  }

  function selectOption(button) {
    const optionName = button.dataset.optionName;
    const optionValue = button.dataset.optionValue;

    if (selectedOptions[optionName] === optionValue) {
      delete selectedOptions[optionName];
      clearActiveVariant();
      return;
    }

    selectedOptions[optionName] = optionValue;
    renderSelectedOptions();
    const variant = findVariantBySelection();

    if (variant) applyVariant(variant);
    else {
      syncOptionAvailability();
      syncPurchaseState();
    }
  }

  optionButtons.forEach((button) => {
    button.addEventListener("click", () => selectOption(button));
  });

  quantityInput.addEventListener("change", syncPurchaseState);
  decreaseButton.addEventListener("click", () => {
    quantityInput.value = String(Math.max(1, getQuantity() - 1));
  });
  increaseButton.addEventListener("click", () => {
    quantityInput.value = String(Math.min(activeStock, getQuantity() + 1));
  });

  // The server preselects the only optionless variant; products with options
  // remain unselected until the user completes the selection.
  if (activeVariant) applyVariant(activeVariant);

  return {
    getVariantId: () => activeVariant?.id || "",
    getQuantity,
    isPurchasable: () => activeStock > 0,
    onPurchasableChange(listener) {
      purchasableListener = listener;
      listener(activeStock > 0);

      return () => {
        if (purchasableListener === listener) purchasableListener = null;
      };
    },
  };
}

export { calculateDiscountPercent, createVariantSelection };
