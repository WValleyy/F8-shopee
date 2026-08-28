function validateRequired(field, message) {
  if (field.value.trim()) return true;

  setFieldError(field, message);
  return false;
}

function normalizePhone(value) {
  return String(value)
    .trim()
    .replace(/[\s-]+/g, "");
}

function isValidPhoneInput(field) {
  const minDigits = Number(field.dataset.phoneMinDigits);
  const maxDigits = Number(field.dataset.phoneMaxDigits);
  const pattern = new RegExp(`^\\+?\\d{${minDigits},${maxDigits}}$`);

  return pattern.test(field.value);
}

function buildPhoneValidationMessage(field) {
  const minDigits = Number(field.dataset.phoneMinDigits);
  const maxDigits = Number(field.dataset.phoneMaxDigits);

  return (
    `Số điện thoại phải có từ ${minDigits} đến ${maxDigits} chữ số` +
    " và dấu + chỉ được đặt ở đầu."
  );
}

function syncPhoneInput(field) {
  field.value = normalizePhone(field.value);
  clearFieldError(field);

  const maxDigits = Number(field.dataset.phoneMaxDigits);
  const digitCount = field.value.replace(/\D/g, "").length;

  if (!/^\+?\d*$/.test(field.value) || digitCount > maxDigits)
    setFieldError(
      field,
      `Số điện thoại chỉ được có tối đa ${maxDigits} chữ số.`,
    );
}

const fieldGroupSelector = "[data-form-field]";
const fieldMessageSelector = "[data-form-message]";
const generatedMessageSelector = "[data-form-message-generated]";

function clearFieldError(field) {
  field.removeAttribute("aria-invalid");
  const message = field.closest(fieldGroupSelector)?.querySelector(fieldMessageSelector);
  if (!message) return;

  if (message.matches(generatedMessageSelector)) message.remove();
  else message.textContent = "";
}

function getOrCreateFieldMessage(field) {
  const group = field.closest(fieldGroupSelector);
  if (!group) return null;

  let messageElement = group.querySelector(fieldMessageSelector);

  if (!messageElement) {
    messageElement = document.createElement("span");
    messageElement.className = "form-field__message";
    messageElement.dataset.formMessage = "";
    messageElement.dataset.formMessageGenerated = "";
    group.append(messageElement);
  }

  return messageElement;
}

function setFieldMessage(field, message) {
  const messageElement = getOrCreateFieldMessage(field);
  if (!messageElement) return;

  messageElement.textContent = message;
}

function setFieldError(field, message) {
  field.setAttribute("aria-invalid", "true");

  const messageElement = getOrCreateFieldMessage(field);
  if (!messageElement) return;

  messageElement.textContent = message;
}

function clearFormErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
    field.removeAttribute("aria-invalid");
  });

  form.querySelectorAll(fieldMessageSelector).forEach((message) => {
    if (message.matches(generatedMessageSelector)) message.remove();
    else message.textContent = "";
  });

  form.querySelectorAll("[data-form-notice]").forEach((notice) => {
    notice.remove();
  });
}

function showFormNotice(form, message) {
  const notice = document.createElement("p");

  notice.className = "form-notice";
  notice.dataset.formNotice = "";
  notice.textContent = message;

  form.append(notice);

  window.setTimeout(() => {
    notice.remove();
  }, 2500);
}

export {
  buildPhoneValidationMessage,
  clearFieldError,
  clearFormErrors,
  getOrCreateFieldMessage,
  isValidPhoneInput,
  normalizePhone,
  setFieldError,
  setFieldMessage,
  showFormNotice,
  syncPhoneInput,
  validateRequired,
};
