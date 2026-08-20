import {
  buildPhoneValidationMessage,
  clearFormErrors,
  isValidPhoneInput,
  normalizePhone,
  setFieldError,
  syncPhoneInput,
  validateRequired,
} from "../../shared/ui/forms.js";

function resetAddressForm(form) {
  form.reset();
  form.elements.addressId.value = "";
  form.elements.isDefault.checked = false;
  form.elements.isDefault.disabled = false;
  form.querySelector("[data-address-form-title]").textContent = "Địa chỉ";
  clearFormErrors(form);
}

function fillAddressForm(form, addressCard) {
  const isDefault = addressCard.dataset.addressIsDefault === "true";

  form.elements.addressId.value = addressCard.dataset.addressId;
  form.elements.fullName.value = addressCard.dataset.addressFullName;
  form.elements.phone.value = addressCard.dataset.addressPhone;
  form.elements.province.value = addressCard.dataset.addressProvince;
  form.elements.ward.value = addressCard.dataset.addressWard;
  form.elements.addressLine.value = addressCard.dataset.addressLine;
  form.elements.isDefault.checked = isDefault;
  form.elements.isDefault.disabled = isDefault;
  form.querySelector("[data-address-form-title]").textContent =
    "Chỉnh sửa địa chỉ";
  clearFormErrors(form);
}

function readAddressInput(form) {
  clearFormErrors(form);

  const requiredFields = [
    ["fullName", "Vui lòng nhập họ và tên."],
    ["phone", "Vui lòng nhập số điện thoại."],
    ["province", "Vui lòng nhập tỉnh / thành phố."],
    ["ward", "Vui lòng nhập phường / xã."],
    ["addressLine", "Vui lòng nhập địa chỉ cụ thể."],
  ];
  const isValid = requiredFields.every(([name, message]) =>
    validateRequired(form.elements[name], message),
  );

  if (!isValid) return null;

  const phoneInput = form.elements.phone;
  phoneInput.value = normalizePhone(phoneInput.value);

  if (!isValidPhoneInput(phoneInput)) {
    setFieldError(phoneInput, buildPhoneValidationMessage(phoneInput));
    return null;
  }

  return {
    fullName: form.elements.fullName.value.trim(),
    phone: phoneInput.value,
    province: form.elements.province.value.trim(),
    ward: form.elements.ward.value.trim(),
    addressLine: form.elements.addressLine.value.trim(),
    isDefault: form.elements.isDefault.checked,
  };
}

function handleAddressPhoneInput(event) {
  const input = event.target.closest("#address-form [data-phone-max-digits]");

  if (!input) return;

  syncPhoneInput(input);
}

export {
  fillAddressForm,
  handleAddressPhoneInput,
  readAddressInput,
  resetAddressForm,
};
