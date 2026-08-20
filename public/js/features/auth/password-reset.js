import { requestJson } from "../../shared/api/http-client.js";
import { close, goToStep } from "../../shared/ui/modal.js";
import { showToast } from "../../shared/ui/toast.js";
import { clearFormErrors, setFieldError } from "../../shared/ui/forms.js";
import { validateEmail } from "./form.js";

const PENDING_PASSWORD_RESET_KEY = "pendingPasswordReset";

function createPasswordReset({
  getElement,
  listen,
  modal,
  navigate,
  startCountdown,
  startRateLimitCountdown,
  steps,
}) {
  const resetHeading = steps.reset.querySelector("[data-reset-heading]");
  const resetHeadingText = resetHeading?.textContent || "";
  const resetSuccess = steps.reset.querySelector("[data-reset-success]");
  const resetSections = [...steps.reset.querySelectorAll("[data-reset-default-content]")];
  let otpEmail = "";
  let successCloseTimer = null;
  let forgotPending = false;
  let otpPending = false;
  let resendPending = false;
  let resetPending = false;

  function clearSuccessCloseTimer() {
    if (successCloseTimer) window.clearTimeout(successCloseTimer);
    successCloseTimer = null;
  }

  function readPending() {
    try {
      const pending = JSON.parse(
        sessionStorage.getItem(PENDING_PASSWORD_RESET_KEY) || "null",
      );

      return pending?.purpose === "RESET_PASSWORD" ? pending : null;
    } catch {
      return null;
    }
  }

  function writePending({ email, step }) {
    sessionStorage.setItem(
      PENDING_PASSWORD_RESET_KEY,
      JSON.stringify({
        purpose: "RESET_PASSWORD",
        email,
        step,
      }),
    );
  }

  function clearPending() {
    sessionStorage.removeItem(PENDING_PASSWORD_RESET_KEY);
  }

  function setResetSuccessVisible(visible) {
    steps.reset.dataset.success = String(visible);

    if (resetSuccess) resetSuccess.hidden = !visible;

    resetSections.forEach((section) => {
      if (section) section.hidden = visible;
    });
  }

  async function open() {
    clearSuccessCloseTimer();

    const pending = readPending();

    if (!pending) {
      navigate("forgot");
      return;
    }

    try {
      const status = await requestJson("/api/auth/password/forgot/status");

      if (!status.active) {
        clearPending();
        navigate("forgot");
        return;
      }

      otpEmail = pending.email;
      steps.forgot.elements.email.value = pending.email;
      getElement("[data-otp-email]").textContent = pending.email;
      navigate("forgot");
      goToStep(status.verified && pending.step === "reset" ? "reset" : "otp");
    } catch {
      navigate("forgot");
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    if (forgotPending) return;

    const emailInput = steps.forgot.elements.email;
    const email = emailInput.value.trim();

    if (!validateEmail(email)) {
      setFieldError(emailInput, "Email không hợp lệ.");
      return;
    }

    const submitButton = steps.forgot.querySelector('[type="submit"]');
    let countdownStarted = false;
    forgotPending = true;
    if (submitButton) submitButton.disabled = true;

    try {
      await requestJson("/api/auth/password/forgot", {
        method: "POST",
        body: { email },
      });
      otpEmail = email;
      getElement("[data-otp-email]").textContent = email;
      writePending({ email, step: "otp" });
      goToStep("otp");
      startCountdown(
        getElement("[data-resend-password-otp]"),
        45,
        steps.otp.elements.otp,
        "Bạn có thể gửi lại mã sau",
      );
    } catch (error) {
      countdownStarted = startRateLimitCountdown(
        submitButton,
        error,
        "Thử lại sau",
        emailInput,
      );

      if (countdownStarted) {
        return;
      }

      setFieldError(emailInput, error.message);
    } finally {
      forgotPending = false;
      if (submitButton && !countdownStarted) submitButton.disabled = false;
    }
  }

  async function submitPasswordOtp(event) {
    event.preventDefault();
    if (otpPending) return;

    const otpInput = steps.otp.elements.otp;

    if (!/^\d{6}$/.test(otpInput.value.trim())) {
      setFieldError(otpInput, "Mã xác minh phải gồm 6 chữ số.");
      return;
    }

    const submitButton = steps.otp.querySelector('[type="submit"]');
    let countdownStarted = false;
    otpPending = true;
    if (submitButton) submitButton.disabled = true;

    try {
      await requestJson("/api/auth/password/verify-otp", {
        method: "POST",
        body: { otp: otpInput.value.trim() },
      });
      writePending({ email: otpEmail, step: "reset" });
      goToStep("reset");
    } catch (error) {
      countdownStarted = startRateLimitCountdown(
        submitButton,
        error,
        "Thử lại sau",
        otpInput,
      );

      if (countdownStarted) {
        return;
      }

      setFieldError(otpInput, error.message);
    } finally {
      otpPending = false;
      if (submitButton && !countdownStarted) submitButton.disabled = false;
    }
  }

  async function resendPasswordOtp() {
    if (resendPending) return;

    const resendButton = getElement("[data-resend-password-otp]");
    let cooldownStarted = false;
    resendPending = true;
    resendButton.disabled = true;

    try {
      const data = await requestJson("/api/auth/password/forgot/resend", {
        method: "POST",
      });
      startCountdown(
        getElement("[data-resend-password-otp]"),
        data.resendCooldownSeconds,
        steps.otp.elements.otp,
        "Bạn có thể gửi lại mã sau",
      );
      cooldownStarted = true;
    } catch (error) {
      cooldownStarted = startRateLimitCountdown(
        resendButton,
        error,
        "Gửi lại mã sau",
        steps.otp.elements.otp,
      );

      if (cooldownStarted) {
        return;
      }

      showToast(error.message, "error");
    } finally {
      resendPending = false;
      if (!cooldownStarted) resendButton.disabled = false;
    }
  }

  async function submitNewPassword(event) {
    event.preventDefault();
    if (resetPending) return;

    const password = steps.reset.elements.password;
    const confirmPassword = steps.reset.elements.confirmPassword;

    clearFormErrors(steps.reset);

    if (password.value.length < 6) {
      setFieldError(password, "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password.value !== confirmPassword.value) {
      setFieldError(confirmPassword, "Mật khẩu xác nhận không khớp.");
      return;
    }

    const submitButton = steps.reset.querySelector('[type="submit"]');
    resetPending = true;
    if (submitButton) submitButton.disabled = true;

    try {
      await requestJson("/api/auth/password/reset", {
        method: "POST",
        body: {
          password: password.value,
          confirmPassword: confirmPassword.value,
        },
      });
      setResetSuccessVisible(true);
      clearPending();
      clearSuccessCloseTimer();
      successCloseTimer = window.setTimeout(() => {
        successCloseTimer = null;
        close(modal, { reason: "success" });
      }, 2000);
    } catch (error) {
      if (error.code === "USER_EMAIL_CHANGED") {
        clearPending();
        otpEmail = "";
        password.value = "";
        confirmPassword.value = "";
        navigate("forgot");
        setFieldError(steps.forgot.elements.email, error.message);
        return;
      }

      setFieldError(password, error.message);
    } finally {
      resetPending = false;
      if (submitButton) submitButton.disabled = false;
    }
  }

  function handleStepChange(step, previousStep) {
    clearSuccessCloseTimer();

    if (step === "reset") setResetSuccessVisible(false);

    if (previousStep === "otp" && step === "forgot") {
      steps.otp.elements.otp.value = "";
      clearFormErrors(steps.otp);
    }

    if (previousStep === "reset" && step === "otp") {
      steps.reset.elements.password.value = "";
      steps.reset.elements.confirmPassword.value = "";
      clearFormErrors(steps.reset);
    }

    if (step === "reset" && resetHeading)
      resetHeading.textContent = resetHeadingText;
  }

  function restorePending() {
    const pending = readPending();
    const otpEmailElement = getElement("[data-otp-email]");

    otpEmail = "";
    if (otpEmailElement) otpEmailElement.textContent = "";

    if (!pending) return;

    steps.forgot.elements.email.value = pending.email;
    otpEmail = pending.email;

    if (otpEmailElement) otpEmailElement.textContent = pending.email;
  }

  function restoreHeading() {
    if (resetHeading) resetHeading.textContent = resetHeadingText;
  }

  listen(steps.forgot, "submit", submitForgotPassword);
  listen(steps.otp, "submit", submitPasswordOtp);
  listen(steps.reset, "submit", submitNewPassword);
  listen(getElement("[data-resend-password-otp]"), "click", resendPasswordOtp);

  return {
    clearPending,
    clearSuccessCloseTimer,
    handleStepChange,
    open,
    restoreHeading,
    restorePending,
  };
}

export { createPasswordReset };
