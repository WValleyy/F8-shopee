import { requestPayload } from "../../../shared/api/http-client.js";
import { close, open } from "../../../shared/ui/modal.js";
import { showToast } from "../../../shared/ui/toast.js";
import {
  fillAddressForm,
  handleAddressPhoneInput,
  readAddressInput,
  resetAddressForm,
} from "../../../features/address/form.js";
import {
  makeAddressDefault,
  saveAddress,
} from "../../../features/address/api.js";

const CHECKOUT_ADDRESS_STORAGE_KEY = "pendingCheckoutAddressId";

function mountAddressSelection(root, submitState) {
  const checkoutForm = root.querySelector("[data-checkout-management]");
  const selectedInput = checkoutForm.elements.selectedAddressId;
  const warning = checkoutForm.querySelector("[data-checkout-address-warning]");
  let defaultAddressPending = false;
  let addressFormPending = false;

  function persist() {
    const addressId = checkoutForm.elements.selectedAddressId.value;

    if (addressId)
      sessionStorage.setItem(CHECKOUT_ADDRESS_STORAGE_KEY, addressId);
    else sessionStorage.removeItem(CHECKOUT_ADDRESS_STORAGE_KEY);
  }

  function updateSummary(card) {
    const summary = checkoutForm.querySelector(
      "[data-checkout-address-summary]",
    );
    const identity = summary.querySelector("[data-checkout-address-name]");
    const address = summary.querySelector("[data-checkout-address-full]");
    const defaultBadge = summary.querySelector(
      "[data-checkout-address-default]",
    );
    const emptyState = summary.querySelector("[data-checkout-address-empty]");
    const changeButton = summary.querySelector("[data-open-address-selector]");
    const hasAddress = Boolean(card);

    if (card) {
      const name = card.dataset.addressFullName || "";
      const phone = card.dataset.addressPhone || "";
      const addressLines = [
        card.dataset.addressLine,
        card.dataset.addressWard,
        card.dataset.addressProvince,
      ].filter(Boolean);

      identity.textContent = `${name} ${phone}`.trim();
      address.textContent = addressLines.join(", ");
    } else {
      identity.textContent = "";
      address.textContent = "";
    }

    identity.hidden = !hasAddress;
    address.hidden = !hasAddress;
    defaultBadge.hidden = card?.dataset.addressIsDefault !== "true";
    emptyState.hidden = hasAddress;
    changeButton.textContent = hasAddress ? "Thay đổi" : "Chọn địa chỉ";
    warning.hidden = hasAddress;
    submitState.setHasAddress(hasAddress);
  }

  function selectAddress(card) {
    selectedInput.value = card?.dataset.addressId || "";
    root.querySelectorAll("[data-select-address-card]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === card));
    });
    updateSummary(card);
    persist();
  }

  async function refreshPartials() {
    const query = new URLSearchParams({
      selectedAddressId: selectedInput.value,
    });
    const payload = await requestPayload(`/checkout/addresses?${query}`, {
      headers: { "X-Partial-Target": "fragment" },
    });
    const list = root.querySelector("[data-checkout-address-list]");

    list.innerHTML = payload.html;
    selectAddress(
      list.querySelector('[data-select-address-card][aria-pressed="true"]'),
    );
  }

  root.addEventListener("input", handleAddressPhoneInput);

  root.addEventListener("click", async (event) => {
    const openSelector = event.target.closest("[data-open-address-selector]");
    const openForm = event.target.closest("[data-open-address-form]");
    const backToSelector = event.target.closest(
      "#address-modal [data-address-form-back]",
    );
    const card = event.target.closest("[data-select-address-card]");
    const editButton = event.target.closest("[data-edit-address]");
    const defaultButton = event.target.closest("[data-set-default-address]");

    if (openSelector) {
      event.preventDefault();
      open(root.querySelector("#checkout-address-selector-modal"));
      return;
    }

    if (backToSelector) {
      close(root.querySelector("#address-modal"));
      open(root.querySelector("#checkout-address-selector-modal"));
      return;
    }

    if (openForm) {
      event.preventDefault();
      close(root.querySelector("#checkout-address-selector-modal"));
      resetAddressForm(root.querySelector("#address-form"));
      open(root.querySelector("#address-modal"));
      return;
    }

    if (
      card &&
      !event.target.closest("[data-address-card-action]") &&
      !event.target.closest("[data-address-default-action]")
    ) {
      event.preventDefault();
      selectAddress(card);
      close(root.querySelector("#checkout-address-selector-modal"));
      return;
    }

    if (editButton) {
      event.preventDefault();
      const addressCard = editButton.closest("[data-address-card]");

      if (!addressCard) return;

      fillAddressForm(root.querySelector("#address-form"), addressCard);
      open(root.querySelector("#address-modal"));
      return;
    }
    // set address as default
    if (defaultButton) {
      event.preventDefault();

      if (defaultAddressPending) return;

      defaultAddressPending = true;
      defaultButton.disabled = true;
      const addressCard = defaultButton.closest("[data-address-card]");

      if (!addressCard) {
        defaultAddressPending = false;
        defaultButton.disabled = false;
        return;
      }

      try {
        await makeAddressDefault(addressCard.dataset.addressId);
        await refreshPartials();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        defaultAddressPending = false;
        defaultButton.disabled = false;
      }
      return;
    }
  });

  root.addEventListener("submit", async (event) => {
    const form = event.target.closest("#address-form");

    if (!form) return;

    event.preventDefault();

    const input = readAddressInput(form);

    if (!input) return;
    if (addressFormPending) return;

    const addressId = form.elements.addressId.value.trim();
    const formSubmitButton = form.querySelector('[type="submit"]');
    addressFormPending = true;
    if (formSubmitButton) formSubmitButton.disabled = true;

    try {
      await saveAddress(addressId, input);
      close(form.closest("[data-modal]"));
      await refreshPartials();
      open(root.querySelector("#checkout-address-selector-modal"));
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      addressFormPending = false;
      if (formSubmitButton) formSubmitButton.disabled = false;
    }
  });
}

export { CHECKOUT_ADDRESS_STORAGE_KEY, mountAddressSelection };
