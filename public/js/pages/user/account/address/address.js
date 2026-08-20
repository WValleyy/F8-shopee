import { isAbortError } from "../../../../shared/api/http-client.js";
import { close, open } from "../../../../shared/ui/modal.js";
import { showFormNotice } from "../../../../shared/ui/forms.js";
import { showToast } from "../../../../shared/ui/toast.js";
import {
  fillAddressForm,
  handleAddressPhoneInput,
  readAddressInput,
  resetAddressForm,
} from "../../../../features/address/form.js";
import {
  makeAddressDefault,
  removeAddress,
  saveAddress as persistAddress,
} from "../../../../features/address/api.js";

function mount({ root, refreshPage, signal }) {
  const pendingAddressIds = new Set();
  let formPending = false;

  function setFormPending(pending) {
    formPending = pending;
    root.querySelector('#address-form [type="submit"]').disabled = pending;
  }

  async function saveAddress(form) {
    const input = readAddressInput(form);

    if (!input) return;

    const addressId = form.elements.addressId.value.trim();

    if (formPending) return;

    setFormPending(true);

    try {
      await persistAddress(addressId, input, { signal });
      form.reset();
      close(form.closest("[data-modal]"), { reason: "success" });
      await refreshPage();
    } catch (error) {
      if (isAbortError(error, signal)) return;

      showFormNotice(form, error.message);
    } finally {
      setFormPending(false);
    }
  }

  async function deleteAddress(addressId) {
    if (pendingAddressIds.has(addressId)) return;

    pendingAddressIds.add(addressId);
    try {
      await removeAddress(addressId, { signal });
      await refreshPage();
    } catch (error) {
      if (isAbortError(error, signal)) return;

      showToast(error.message, "error");
    } finally {
      pendingAddressIds.delete(addressId);
    }
  }

  async function setDefaultAddress(addressId) {
    if (pendingAddressIds.has(addressId)) return;

    pendingAddressIds.add(addressId);
    try {
      await makeAddressDefault(addressId, { signal });
      await refreshPage();
    } catch (error) {
      if (isAbortError(error, signal)) return;

      showToast(error.message, "error");
    } finally {
      pendingAddressIds.delete(addressId);
    }
  }

  root.addEventListener(
    "click",
    async (event) => {
      const addButton = event.target.closest(
        "#btn-add-address, #btn-add-address-empty",
      );
      const editButton = event.target.closest("[data-edit-address]");
      const deleteButton = event.target.closest("[data-delete-address]");
      const defaultButton = event.target.closest("[data-set-default-address]");

      if (addButton) {
        resetAddressForm(root.querySelector("#address-form"));
        open(root.querySelector("#address-modal"));
        return;
      }

      if (editButton) {
        const addressCard = editButton.closest("[data-address-card]");

        if (!addressCard) return;

        fillAddressForm(root.querySelector("#address-form"), addressCard);
        open(root.querySelector("#address-modal"));
        return;
      }

      if (deleteButton) {
        const addressCard = deleteButton.closest("[data-address-card]");

        if (!addressCard) return;

        await deleteAddress(addressCard.dataset.addressId);
        return;
      }

      if (defaultButton) {
        const addressCard = defaultButton.closest("[data-address-card]");

        if (!addressCard) return;

        await setDefaultAddress(addressCard.dataset.addressId);
      }
    },
    { signal },
  );

  root.addEventListener("input", handleAddressPhoneInput, { signal });
  root.addEventListener(
    "submit",
    async (event) => {
      if (!event.target.matches("#address-form")) return;

      event.preventDefault();
      await saveAddress(event.target);
    },
    { signal },
  );
}

export { mount };
