import { formatPrice } from "../../shared/lib/format-price.js";

function renderHeaderCartPreview(preview) {
  const root = document.querySelector("[data-header-cart-preview]");

  if (!root || !preview) return;

  const { itemCount, items } = preview;
  const notice = root.querySelector("[data-cart-preview-notice]");
  const list = root.querySelector("[data-cart-preview-list]");
  const emptyState = root.querySelector("[data-cart-preview-empty]");
  const populatedState = root.querySelectorAll("[data-cart-preview-populated]");
  const itemList = root.querySelector("[data-header-cart-items]");
  const itemTemplate = root.querySelector("[data-cart-preview-item-template]");

  list.hidden = false;
  notice.textContent = String(itemCount);
  notice.hidden = itemCount === 0;
  list.dataset.empty = String(items.length === 0);
  emptyState.hidden = items.length > 0;
  populatedState.forEach((element) => {
    element.hidden = items.length === 0;
  });
  itemList.replaceChildren();

  items.forEach((item) => {
    const fragment = itemTemplate.content.cloneNode(true);
    const element = fragment.querySelector("[data-cart-preview-item]");
    const image = fragment.querySelector("[data-cart-preview-image]");
    const optionValues = item.options.map((option) => option.value);
    const optionText = optionValues.length
      ? optionValues.join(", ")
      : "Mặc định";
    const priceText = item.isAvailable
      ? formatPrice(item.price)
      : "Không khả dụng";

    element.dataset.variantId = item.variantId;
    image.src = item.image || "/img/no_img.png";
    image.alt = item.productName || "Sản phẩm không còn tồn tại";
    fragment.querySelector("[data-cart-preview-name]").textContent =
      item.productName || "Sản phẩm không còn tồn tại";
    fragment.querySelector("[data-cart-preview-price]").textContent = priceText;
    fragment.querySelector("[data-cart-preview-quantity]").textContent = String(
      item.quantity,
    );
    fragment.querySelector("[data-cart-preview-classify]").textContent =
      optionText;
    itemList.append(fragment);
  });
}

export { renderHeaderCartPreview };
