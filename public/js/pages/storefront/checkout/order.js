import { requestJson } from "../../../shared/api/http-client.js";
import { showToast } from "../../../shared/ui/toast.js";
import { CHECKOUT_ADDRESS_STORAGE_KEY } from "./address.js";

function mountCheckoutOrder(root, submitState) {
  const checkoutForm = root.querySelector("[data-checkout-form]");

  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitState.isOrderPending()) return;

    const formData = new FormData(checkoutForm);
    const payload = {
      note: formData.get("note"),
      selectedAddressId: formData.get("selectedAddressId"),
      draftId: formData.get("draftId"),
    };

    submitState.setOrderPending(true);

    try {
      await requestJson("/api/orders", {
        method: "POST",
        body: payload,
      });
      sessionStorage.removeItem(CHECKOUT_ADDRESS_STORAGE_KEY);
      window.location.assign("/user/purchase");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      submitState.setOrderPending(false);
    }
  });
}

export { mountCheckoutOrder };
