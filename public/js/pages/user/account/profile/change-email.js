import {
  isAbortError,
  requestJson,
} from "../../../../shared/api/http-client.js";
import { cancelPendingNavigations } from "../../../../shared/navigation/partial-region.js";
import {
  clearFormErrors,
  setFieldError,
  showFormNotice,
  validateRequired,
} from "../../../../shared/ui/forms.js";
import {
  close,
  goToStep,
  open,
  register,
} from "../../../../shared/ui/modal.js";
import { showToast } from "../../../../shared/ui/toast.js";

const WORKFLOW_ID = "change-email";
const STORAGE_KEY = "pendingEmailChange";

function mountChangeEmail({ root, signal, tools }) {
  let reloadTimer = null;
  let requestPending = false;
  let otpPending = false;
  let resendPending = false;

  function readPending() {
    try {
      const pending = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");

      return pending?.purpose === "CHANGE_EMAIL" ? pending : null;
    } catch {
      return null;
    }
  }

  function writePending(targetEmail) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        purpose: "CHANGE_EMAIL",
        targetEmail,
        step: "otp",
      }),
    );
  }

  function clearPending() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  const unregister = register(WORKFLOW_ID, {
    initialStep: "request",
    steps: {
      request: () => root.querySelector("#change-email-modal"),
      otp: () => root.querySelector("#change-email-otp-modal"),
    },
    onApply: ({ step, previousStep }) => {
      const pending = readPending();

      if (previousStep === "otp" && step === "request") {
        root.querySelector('#change-email-otp-form [name="otp"]').value = "";
        tools.resetCountdown();
      }

      if (step === "request" && pending?.targetEmail) {
        root.querySelector('#change-email-form [name="email"]').value =
          pending.targetEmail;
      }

      if (step === "otp") {
        root.querySelector("[data-email-change-target]").textContent =
          pending?.targetEmail || "";
      }
    },
    onClose: ({ reason }) => {
      const requestForm = root.querySelector("#change-email-form");
      const otpForm = root.querySelector("#change-email-otp-form");
      const pending = readPending();

      tools.resetCountdown();
      requestForm.elements.currentPassword.value = "";

      if (!pending) requestForm.elements.email.value = "";

      otpForm.elements.otp.value = "";
      clearFormErrors(requestForm);
      clearFormErrors(otpForm);

      if (reason === "success") {
        clearPending();
        requestForm.elements.email.value = "";
      }
    },
  });

  async function openWorkflow(opener) {
    if (signal.aborted) return;

    cancelPendingNavigations();

    const pending = readPending();

    if (pending) {
      try {
        const status = await requestJson("/api/auth/email-change/status", {
          signal,
        });

        if (status.active) {
          if (signal.aborted) return;

          writePending(status.targetEmail || pending.targetEmail);
          open("#change-email-modal", {
            history: true,
            workflowId: WORKFLOW_ID,
            step: "request",
            opener,
          });
          goToStep("otp");
          return;
        }
      } catch (error) {
        if (isAbortError(error, signal)) return;

        // The stale local workflow is discarded below.
      }

      clearPending();
    }

    open("#change-email-modal", {
      history: true,
      workflowId: WORKFLOW_ID,
      step: "request",
      opener,
    });
  }

  async function submitRequest(form) {
    if (requestPending) return;

    const emailInput = form.elements.email;
    const passwordInput = form.elements.currentPassword;
    const email = emailInput.value.trim();

    if (!validateRequired(emailInput, "Vui lòng nhập email.")) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(emailInput, "Email không hợp lệ.");
      return;
    }

    const currentEmail = root
      .querySelector("[data-change-email]")
      .closest("[data-form-field]")
      .querySelector("[data-profile-field-value]")
      .textContent.trim()
      .toLowerCase();

    if (email.toLowerCase() === currentEmail) {
      setFieldError(emailInput, "Email mới phải khác email hiện tại.");
      return;
    }

    if (!validateRequired(passwordInput, "Vui lòng nhập mật khẩu hiện tại.")) {
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    let countdownStarted = false;
    requestPending = true;
    if (submitButton) submitButton.disabled = true;

    try {
      const data = await requestJson("/api/auth/email-change/request", {
        method: "POST",
        body: {
          email,
          currentPassword: passwordInput.value,
        },
        signal,
      });

      if (signal.aborted) return;

      passwordInput.value = "";
      writePending(email);
      goToStep("otp");
      tools.startCountdown(
        root.querySelector("[data-resend-email-change]"),
        data.resendCooldownSeconds,
      );
    } catch (error) {
      if (isAbortError(error, signal)) return;

      countdownStarted = tools.handleRateLimit(
        submitButton,
        error,
        "Thử lại sau",
      );

      if (!countdownStarted) {
        setFieldError(emailInput, error.message);
      }
    } finally {
      requestPending = false;
      if (submitButton && !countdownStarted) submitButton.disabled = false;
    }
  }

  async function submitOtp(form) {
    if (otpPending) return;

    const otpInput = form.elements.otp;

    if (!/^\d{6}$/.test(otpInput.value.trim())) {
      setFieldError(otpInput, "Mã xác minh phải gồm 6 chữ số.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    let countdownStarted = false;
    otpPending = true;
    if (submitButton) submitButton.disabled = true;

    try {
      await requestJson("/api/auth/email-change/confirm", {
        method: "POST",
        body: { otp: otpInput.value.trim() },
        signal,
      });
      if (signal.aborted) return;

      showFormNotice(form, "Email đã được thay đổi.");
      clearPending();
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        close(form.closest("[data-modal]"), { reason: "success" });
        window.location.reload();
      }, 2000);
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
      otpPending = false;
      if (submitButton && !countdownStarted) submitButton.disabled = false;
    }
  }

  root.addEventListener(
    "click",
    async (event) => {
      const changeButton = event.target.closest("[data-change-email]");

      if (changeButton) {
        await openWorkflow(changeButton);
        return;
      }

      const resendButton = event.target.closest("[data-resend-email-change]");

      if (!resendButton) return;
      if (resendPending) return;

      let cooldownStarted = false;
      resendPending = true;
      resendButton.disabled = true;
      try {
        const data = await requestJson("/api/auth/email-change/resend", {
          method: "POST",
          signal,
        });
        tools.startCountdown(resendButton, data.resendCooldownSeconds);
        cooldownStarted = true;
      } catch (error) {
        if (isAbortError(error, signal)) return;

        cooldownStarted = tools.handleRateLimit(resendButton, error);
        if (!cooldownStarted) showToast(error.message, "error");
      } finally {
        resendPending = false;
        if (!cooldownStarted) resendButton.disabled = false;
      }
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    (event) => {
      const form = event.target;

      if (form.matches("#change-email-form")) {
        event.preventDefault();
        void submitRequest(form);
      } else if (form.matches("#change-email-otp-form")) {
        event.preventDefault();
        void submitOtp(form);
      }
    },
    { signal },
  );

  return () => {
    if (reloadTimer) window.clearTimeout(reloadTimer);
    reloadTimer = null;
    tools.resetCountdown();
    unregister();
  };
}

export { mountChangeEmail };
