import { startButtonCountdown } from "../../shared/ui/countdown.js";
import {
  getActiveWorkflow,
  goToStep,
  open,
  register,
} from "../../shared/ui/modal.js";
import { mountCredentials } from "./credentials.js";
import { setFieldMessage } from "../../shared/ui/forms.js";
import { createPasswordReset } from "./password-reset.js";

const AUTH_WORKFLOW_ID = "auth";

let navigateAuthModal = null;

function mountAuth() {
  const getElement = (selector) => document.querySelector(selector);
  const getElements = (selector) => [...document.querySelectorAll(selector)];
  const modal = getElement("#auth-modal");
  const listen = (target, type, handler) =>
    target?.addEventListener(type, handler);
  const steps = {
    login: getElement('[data-auth-step="login"]'),
    register: getElement('[data-auth-step="register"]'),
    forgot: getElement('[data-auth-step="forgot"]'),
    otp: getElement('[data-auth-step="otp"]'),
    reset: getElement('[data-auth-step="reset"]'),
    sessionLimit: getElement('[data-auth-step="sessionLimit"]'),
  };
  const loginForm = steps.login;
  const registerForm = steps.register;
  const elements = {
    guestItems: getElements("[data-auth-guest-item]"),
    loginEmail: loginForm?.elements.email,
    loginPassword: loginForm?.elements.password,
    loginRememberMe: loginForm?.elements.rememberMe,
    loginSubmit: loginForm?.querySelector('[type="submit"]'),
    logoutButton: getElement("#logout-btn"),
    registerConfirmPassword: registerForm?.elements["confirm-password"],
    registerEmail: registerForm?.elements.email,
    registerName: registerForm?.elements.name,
    registerPassword: registerForm?.elements.password,
    registerSubmit: registerForm?.querySelector('[type="submit"]'),
    returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    sessionLimitCancelButtons: getElements("[data-session-limit-cancel]"),
    sessionLimitConfirm: getElement("[data-session-limit-confirm]"),
    sessionLimitMessage: getElement("[data-session-limit-message]"),
    steps,
    userItem: getElement("[data-auth-user-item]"),
  };
  let stopCountdown = () => {};

  const passwordReset = createPasswordReset({
    getElement,
    listen,
    modal,
    navigate,
    startCountdown,
    startRateLimitCountdown,
    steps,
  });

  function navigate(step) {
    const activeWorkflow = getActiveWorkflow();

    if (activeWorkflow?.id === AUTH_WORKFLOW_ID) {
      goToStep(step);
      return;
    }

    open(modal, {
      history: true,
      workflowId: AUTH_WORKFLOW_ID,
      step,
    });
  }

  function setVisibleStep(step) {
    Object.values(steps).forEach((form) => {
      if (form) form.hidden = true;
    });

    if (steps[step]) steps[step].hidden = false;
  }

  function resetCountdownButtons() {
    modal.querySelectorAll("[data-countdown-ready-text]").forEach((button) => {
      button.disabled = false;
      button.textContent = button.dataset.countdownReadyText;
    });
  }

  function setCountdownMessage(input, message) {
    if (!input) return;

    if (
      typeof input.closest !== "function" ||
      !input.closest("[data-form-field]")
    ) {
      input.textContent = message;
      return;
    }

    setFieldMessage(input, message);
  }

  function startCountdown(
    button,
    seconds,
    messageInput = null,
    messagePrefix = "Vui lòng thử lại sau",
  ) {
    stopCountdown();
    stopCountdown = startButtonCountdown(
      button,
      seconds,
      (remaining, timeText) =>
        setCountdownMessage(
          messageInput,
          remaining > 0 ? `${messagePrefix} ${timeText}.` : "",
        ),
    );
  }

  function startRateLimitCountdown(
    button,
    error,
    prefix = "Thử lại sau",
    messageInput = null,
  ) {
    if (error.code !== "RATE_LIMITED" || error.retryAfter < 1) return false;

    startCountdown(
      button,
      error.retryAfter,
      messageInput,
      error.message || prefix,
    );
    return true;
  }

  function clearPendingAuthUiState() {
    passwordReset.clearPending();
    sessionStorage.removeItem("pendingEmailChange");
  }

  function clearForms({ preservePending = false } = {}) {
    getElements("#auth-modal input").forEach((input) => {
      if (input.type === "checkbox") input.checked = false;
      else input.value = "";

      input.removeAttribute("aria-invalid");
    });
    getElements("#auth-modal [data-form-message]").forEach((message) => {
      message.textContent = "";
    });
    resetCountdownButtons();

    passwordReset.restoreHeading();

    if (preservePending) passwordReset.restorePending();

    setVisibleStep("login");
  }

  function applyAuthStep({ step, previousStep }) {
    if (previousStep === "otp" && step === "forgot") {
      stopCountdown();
      stopCountdown = () => {};
      resetCountdownButtons();
    }

    passwordReset.handleStepChange(step, previousStep);
    setVisibleStep(step);
  }

  function cleanupAuthModal(reason) {
    stopCountdown();
    stopCountdown = () => {};
    passwordReset.clearSuccessCloseTimer();
    clearForms({ preservePending: reason !== "success" });
  }

  register(AUTH_WORKFLOW_ID, {
    initialStep: "login",
    steps: Object.fromEntries(
      Object.keys(steps).map((step) => [step, "#auth-modal"]),
    ),
    onApply: applyAuthStep,
    onClose: ({ reason }) => cleanupAuthModal(reason),
  });
  navigateAuthModal = navigate;

  listen(getElement("#login-btn"), "click", (event) => {
    event.preventDefault();
    navigate("login");
  });
  listen(getElement("#register-btn"), "click", (event) => {
    event.preventDefault();
    navigate("register");
  });
  getElements("[data-notification-login]").forEach((button) => {
    listen(button, "click", (event) => {
      event.preventDefault();
      navigate("login");
    });
  });
  listen(getElement("[data-forgot-password]"), "click", () => {
    void passwordReset.open();
  });
  listen(
    getElement('[data-auth-step="register"] [data-switch="login"]'),
    "click",
    () => navigate("login"),
  );
  listen(
    getElement('[data-auth-step="login"] [data-switch="register"]'),
    "click",
    () => navigate("register"),
  );

  mountCredentials({
    elements,
    listen,
    navigate,
    startRateLimitCountdown,
    clearPendingAuthUiState,
  });
}

function openAuthModal(step = "login") {
  navigateAuthModal?.(step);
}

export { mountAuth, openAuthModal };
