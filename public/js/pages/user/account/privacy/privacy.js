import { requestJson } from "../../../../shared/api/http-client.js";
import { confirm } from "../../../../shared/ui/confirm.js";
import { close, open } from "../../../../shared/ui/modal.js";
import { mountSessionSettings } from "./sessions.js";
import {
  setFieldError,
  showFormNotice,
  validateRequired,
} from "../../../../shared/ui/forms.js";

function mountPrivacySettings({ root, refreshPage, signal }) {
  let deleteAccountPending = false;

  root.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest("#btn-delete-user");

      if (!button) return;

      const shouldContinue = await confirm({
        title: "Xóa tài khoản",
        message:
          "Tài khoản sẽ được vô hiệu hóa và lên lịch xóa. Bạn có muốn tiếp tục không?",
        confirmText: "Tiếp tục",
        tone: "danger",
      });

      if (!shouldContinue) return;

      open(root.querySelector("#delete-user-modal"), {
        opener: button,
      });
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    async (event) => {
      const form = event.target.closest("#delete-user-form");

      if (!form) return;

      event.preventDefault();
      if (deleteAccountPending) return;

      if (
        !validateRequired(
          form.elements.password,
          "Vui lòng nhập mật khẩu để xác nhận.",
        )
      ) {
        return;
      }

      const submitButton = form.querySelector('[type="submit"]');
      deleteAccountPending = true;
      if (submitButton) submitButton.disabled = true;

      try {
        await requestJson("/api/account/account", {
          method: "DELETE",
          body: { password: form.elements.password.value },
          signal,
        });
        close(form.closest("[data-modal]"), { reason: "success" });
        window.location.assign("/");
      } catch (error) {
        if (error.code === "CURRENT_PASSWORD_INCORRECT")
          setFieldError(form.elements.password, error.message);
        else showFormNotice(form, error.message);
      } finally {
        deleteAccountPending = false;
        if (submitButton) submitButton.disabled = false;
      }
    },
    { signal },
  );

  mountSessionSettings({ root, refreshPage, signal });
}

function mount({ root, refreshPage, signal }) {
  mountPrivacySettings({ root, refreshPage, signal });
}

export { mount };
