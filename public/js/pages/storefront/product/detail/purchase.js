import { requestJson } from "../../../../shared/api/http-client.js";
import { showToast } from "../../../../shared/ui/toast.js";
import { openAuthModal } from "../../../../features/auth/auth.js";
import { isAuthenticated } from "../../../../features/auth/state.js";
import { renderHeaderCartPreview } from "../../../../widgets/header/cart-preview.js";

function mountProductPurchase({ root, selection }) {
  const addButton = root.querySelector("[data-add-to-cart]");
  const buyButton = root.querySelector("[data-buy-now]");
  let pending = false;
  let purchasable = selection.isPurchasable();

  function syncButtons() {
    const disabled = pending || !purchasable;

    addButton.disabled = disabled;
    buyButton.disabled = disabled;
  }

  function setPending(value) {
    pending = value;
    syncButtons();
  }

  async function submit(redirectToCheckout) {
    if (pending) return;

    if (!isAuthenticated()) {
      openAuthModal("login");
      return;
    }

    const item = {
      variantId: selection.getVariantId(),
      quantity: selection.getQuantity(),
    };

    setPending(true);

    try {
      if (redirectToCheckout) {
        const draftId = await requestJson("/api/checkout/drafts", {
          method: "POST",
          body: { source: "buy-now", items: [item] },
        });
        window.location.assign(
          `/checkout?draft=${encodeURIComponent(draftId)}`,
        );
        return;
      }

      const data = await requestJson("/api/cart/items", {
        method: "POST",
        body: item,
      });

      renderHeaderCartPreview(data.cartPreview);
      showToast("Đã thêm sản phẩm vào giỏ hàng.");
    } catch (error) {
      if (error.status === 401) openAuthModal("login");
      else showToast(error.message, "error");
    } finally {
      setPending(false);
    }
  }

  addButton.addEventListener("click", () => void submit(false));
  buyButton.addEventListener("click", () => void submit(true));

  selection.onPurchasableChange((value) => {
    purchasable = value;
    syncButtons();
  });
}

export { mountProductPurchase };
