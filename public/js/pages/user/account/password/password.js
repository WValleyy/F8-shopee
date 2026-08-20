import { requestJson } from "../../../../shared/api/http-client.js";
import {
  clearFormErrors,
  setFieldError,
  showFormNotice,
  validateRequired,
} from "../../../../shared/ui/forms.js";

function mountPasswordSettings({ root, signal }) {
  let passwordPending = false;

  function showPasswordError(error, fields) {
    const fieldByCode = {
      CURRENT_PASSWORD_INCORRECT: fields.currentPassword,
      CURRENT_PASSWORD_REQUIRED: fields.currentPassword,
      PASSWORD_CONFIRMATION_MISMATCH: fields.confirmPassword,
      NEW_PASSWORD_MUST_DIFFER: fields.newPassword,
    };
    setFieldError(
      fieldByCode[error.code] || fields.currentPassword,
      error.message,
    );
  }

  root.addEventListener(
    "submit",
    async (event) => {
      const form = event.target.closest("#password-form");

      if (!form) return;

      event.preventDefault();
      if (passwordPending) return;

      clearFormErrors(form);

      const currentPassword = form.elements.currentPassword;
      const newPassword = form.elements.newPassword;
      const confirmPassword = form.elements.confirmPassword;

      if (
        !validateRequired(currentPassword, "Vui lòng nhập mật khẩu hiện tại.")
      ) {
        return;
      }

      if (currentPassword.value.length < 6) {
        setFieldError(
          currentPassword,
          "Mật khẩu hiện tại phải có ít nhất 6 ký tự.",
        );
        return;
      }

      if (!validateRequired(newPassword, "Vui lòng nhập mật khẩu mới.")) return;

      if (newPassword.value.length < 6) {
        setFieldError(newPassword, "Mật khẩu mới phải có ít nhất 6 ký tự.");
        return;
      }

      if (
        !validateRequired(confirmPassword, "Vui lòng xác nhận mật khẩu mới.")
      ) {
        return;
      }

      if (newPassword.value !== confirmPassword.value) {
        setFieldError(confirmPassword, "Mật khẩu xác nhận không khớp.");
        return;
      }

      if (currentPassword.value === newPassword.value) {
        setFieldError(newPassword, "Mật khẩu mới phải khác mật khẩu hiện tại.");
        return;
      }

      const submitButton = form.querySelector('[type="submit"]');
      passwordPending = true;
      if (submitButton) submitButton.disabled = true;

      try {
        const data = await requestJson("/api/account/password", {
          method: "PATCH",
          body: {
            currentPassword: currentPassword.value,
            newPassword: newPassword.value,
            confirmPassword: confirmPassword.value,
          },
          signal,
        });
        showFormNotice(
          form,
          "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.",
        );

        if (data.requiresReauth) {
          window.setTimeout(() => window.location.assign("/"), 500);
        }
      } catch (error) {
        showPasswordError(error, {
          currentPassword,
          confirmPassword,
          newPassword,
        });
      } finally {
        passwordPending = false;
        if (submitButton) submitButton.disabled = false;
      }
    },
    { signal },
  );
}

function mount({ root, signal }) {
  mountPasswordSettings({ root, signal });
}

export { mount };
