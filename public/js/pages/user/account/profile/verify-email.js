import {
  isAbortError,
  requestJson,
} from "../../../../shared/api/http-client.js";
import { cancelPendingNavigations } from "../../../../shared/navigation/partial-region.js";
import { clearFormErrors, setFieldError } from "../../../../shared/ui/forms.js";
import { confirm } from "../../../../shared/ui/confirm.js";
import { close, open, register } from "../../../../shared/ui/modal.js";
import { showToast } from "../../../../shared/ui/toast.js";
import { renderHeaderNotificationPreview } from "../../../../widgets/header/notifications.js";

const WORKFLOW_ID = "verify-email";

function mountVerifyEmail({ root, signal, tools }) {
  let requestPending = false;
  let verifyPending = false;

  function setRequestLoading(button, loading) {
    button.dataset.loading = String(loading);
    button.setAttribute("aria-busy", String(loading));
  }

  function setVerifiedState() {
    const status = root.querySelector("[data-profile-verification-status]");

    status.dataset.verified = "true";
    status.textContent = "Trạng thái xác thực: Đã xác minh";

    const action = root.querySelector("[data-profile-email-action]");

    delete action.dataset.verifyEmail;
    action.dataset.changeEmail = "";
    action.querySelector("[data-profile-email-action-label]").textContent =
      "Thay đổi email";
  }

  const unregister = register(WORKFLOW_ID, {
    initialStep: "otp",
    steps: {
      otp: () => root.querySelector("#email-verification-modal"),
    },
    onClose: () => {
      const form = root.querySelector("#email-verification-form");

      tools.resetCountdown();
      form.reset();
      clearFormErrors(form);
    },
  });

  async function requestCode(button) {
    if (requestPending) return false;

    requestPending = true;
    button.disabled = true;
    setRequestLoading(button, true);
    let cooldownStarted = false;

    try {
      const data = await requestJson("/api/auth/email/verify/request", {
        method: "POST",
        signal,
      });
      tools.startCountdown(button, data.resendCooldownSeconds);
      cooldownStarted = true;
      return true;
    } catch (error) {
      if (isAbortError(error, signal)) return false;

      cooldownStarted = tools.handleRateLimit(button, error);
      if (!cooldownStarted) {
        showToast(error.message, "error");
        return false;
      }

      return true;
    } finally {
      requestPending = false;
      setRequestLoading(button, false);
      if (!cooldownStarted) button.disabled = false;
    }
  }

  async function openWorkflow(opener) {
    if (signal.aborted) return;

    cancelPendingNavigations();

      const confirmed = await confirm({
      title: "Xác minh email",
      message: "Bạn có muốn gửi mã xác minh đến email của mình không?",
      confirmText: "Gửi mã",
    });

    if (!confirmed || signal.aborted) return;

    const button = root.querySelector("[data-resend-email-verification]");
    const openerWasDisabled = opener.disabled;

    opener.disabled = true;
    setRequestLoading(opener, true);

    try {
      const status = await requestJson("/api/auth/email/verify/status", {
        signal,
      });

      if (!status.active && !(await requestCode(button))) return;
    } catch (error) {
      if (isAbortError(error, signal)) return;

      if (!tools.handleRateLimit(button, error)) {
        showToast(error.message, "error");
        return;
      }
    } finally {
      setRequestLoading(opener, false);
      opener.disabled = openerWasDisabled;
    }

    open("#email-verification-modal", {
      history: true,
      workflowId: WORKFLOW_ID,
      step: "otp",
      opener,
    });
  }

  async function submit(form) {
    if (verifyPending) return;

    const otpInput = form.elements.otp;

    if (!/^\d{6}$/.test(otpInput.value.trim())) {
      setFieldError(otpInput, "Mã xác minh phải gồm 6 chữ số.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    let countdownStarted = false;
    verifyPending = true;
    if (submitButton) submitButton.disabled = true;

    try {
      const data = await requestJson("/api/auth/email/verify", {
        method: "POST",
        body: { otp: otpInput.value.trim() },
        signal,
      });
      if (signal.aborted) return;

      setVerifiedState();
      renderHeaderNotificationPreview(data.notificationPreview);
      close(form.closest("[data-modal]"), { reason: "success" });
    } catch (error) {
      if (isAbortError(error, signal)) return;

      countdownStarted = tools.handleRateLimit(
        submitButton,
        error,
        "Thử lại sau",
      );

      if (!countdownStarted) {
        setFieldError(otpInput, error.message);
      }
    } finally {
      verifyPending = false;
      if (submitButton && !countdownStarted) submitButton.disabled = false;
    }
  }

  root.addEventListener(
    "click",
    async (event) => {
      const verifyButton = event.target.closest("[data-verify-email]");

      if (verifyButton) {
        await openWorkflow(verifyButton);
        return;
      }

      const resendButton = event.target.closest(
        "[data-resend-email-verification]",
      );

      if (resendButton) await requestCode(resendButton);
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    (event) => {
      if (!event.target.matches("#email-verification-form")) return;

      event.preventDefault();
      void submit(event.target);
    },
    { signal },
  );

  return unregister;
}

export { mountVerifyEmail };
