import { requestJson } from "../../shared/api/http-client.js";
import { exitForNavigation } from "../../shared/ui/modal.js";
import { showToast } from "../../shared/ui/toast.js";
import {
  clearFormErrors,
  setFieldError,
  setFieldMessage,
} from "../../shared/ui/forms.js";
import { validateEmail } from "./form.js";

function mountCredentials({
  elements,
  listen,
  navigate,
  startRateLimitCountdown,
  clearPendingAuthUiState,
}) {
  const {
    guestItems,
    loginEmail,
    loginPassword,
    loginRememberMe,
    logoutButton,
    registerConfirmPassword,
    registerEmail,
    registerName,
    registerPassword,
    returnPath,
    sessionLimitConfirm,
    sessionLimitMessage,
    steps,
    userItem,
  } = elements;
  let loginPending = false;
  let registerPending = false;
  let logoutPending = false;

  function setSessionLimitMessage(message) {
    if (sessionLimitMessage) sessionLimitMessage.textContent = message;
  }

  function validateLogin() {
    let valid = true;

    if (!validateEmail(loginEmail.value.trim())) {
      setFieldError(loginEmail, "Email không hợp lệ.");
      valid = false;
    }
    if (!loginPassword.value) {
      setFieldError(loginPassword, "Vui lòng nhập mật khẩu.");
      valid = false;
    }

    return valid;
  }

  function validateRegister() {
    let valid = true;

    if (!registerName.value.trim()) {
      setFieldError(registerName, "Vui lòng nhập tên.");
      valid = false;
    }
    if (!validateEmail(registerEmail.value.trim())) {
      setFieldError(registerEmail, "Email không hợp lệ.");
      valid = false;
    }
    if (registerPassword.value.length < 6) {
      setFieldError(registerPassword, "Mật khẩu phải có ít nhất 6 ký tự.");
      valid = false;
    }
    if (registerPassword.value !== registerConfirmPassword.value) {
      setFieldError(registerConfirmPassword, "Mật khẩu xác nhận không khớp.");
      valid = false;
    }

    return valid;
  }

  async function submitLogin(event = null, force = false) {
    event?.preventDefault();

    if (loginPending) return;

    clearFormErrors(steps.login);
    setSessionLimitMessage("");

    if (!validateLogin()) return;

    loginPending = true;
    const submitButton = force ? sessionLimitConfirm : elements.loginSubmit;
    let countdownStarted = false;
    if (submitButton) submitButton.disabled = true;

    try {
      await requestJson("/api/auth/login", {
        method: "POST",
        body: {
          email: loginEmail.value.trim(),
          password: loginPassword.value,
          rememberMe: Boolean(loginRememberMe?.checked),
          force,
        },
      });
      await exitForNavigation("success");
      window.location.reload();
    } catch (error) {
      if (error.code === "SESSION_LIMIT_REACHED" && !force) {
        setSessionLimitMessage(
          error.message || "Tài khoản đã đạt giới hạn phiên đăng nhập.",
        );
        navigate("sessionLimit");
        return;
      }

      if (error.code === "SESSION_LIMIT_REACHED") {
        setSessionLimitMessage(
          error.message || "Tài khoản vẫn đang đạt giới hạn phiên đăng nhập.",
        );
        return;
      }

      countdownStarted = startRateLimitCountdown(
        force ? sessionLimitConfirm : elements.loginSubmit,
        error,
        "Thử lại sau",
        force ? sessionLimitMessage : loginPassword,
      );

      if (countdownStarted) {
        return;
      }

      setFieldError(loginPassword, error.message);
    } finally {
      loginPending = false;
      if (submitButton && !countdownStarted) submitButton.disabled = false;
    }
  }

  async function submitRegister(event) {
    event?.preventDefault();

    if (registerPending) return;

    clearFormErrors(steps.register);

    if (!validateRegister()) return;

    registerPending = true;
    let countdownStarted = false;
    elements.registerSubmit.disabled = true;

    try {
      const result = await requestJson("/api/auth/register", {
        method: "POST",
        body: {
          name: registerName.value.trim(),
          email: registerEmail.value.trim(),
          password: registerPassword.value,
          confirmPassword: registerConfirmPassword.value,
        },
      });

      if (result.authenticated === false) {
        loginEmail.value = registerEmail.value.trim();
        navigate("login");
        setFieldMessage(
          loginEmail,
          result.message || "Tài khoản đã được tạo. Vui lòng đăng nhập.",
        );
        return;
      }

      await exitForNavigation("success");
      window.location.assign(returnPath || "/");
    } catch (error) {
      countdownStarted = startRateLimitCountdown(
        elements.registerSubmit,
        error,
        "Thử lại sau",
        registerEmail,
      );

      if (countdownStarted) {
        return;
      }

      setFieldError(registerEmail, error.message);
    } finally {
      registerPending = false;
      if (!countdownStarted) elements.registerSubmit.disabled = false;
    }
  }

  async function logout(event) {
    event.preventDefault();

    if (logoutPending) return;

    logoutPending = true;
    logoutButton.disabled = true;

    try {
      await requestJson("/api/auth/session/logout", { method: "POST" });
      clearPendingAuthUiState();
      window.location.reload();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      logoutPending = false;
      logoutButton.disabled = false;
    }
  }

  function handleSessionEnded() {
    clearPendingAuthUiState();
    document.body.dataset.authenticated = "false";
    guestItems.forEach((item) => {
      item.hidden = false;
    });

    if (userItem) userItem.hidden = true;

    if (
      window.location.pathname === "/checkout" ||
      window.location.pathname.startsWith("/user")
    ) {
      window.location.assign("/");
    }
  }

  listen(steps.login, "submit", submitLogin);
  listen(sessionLimitConfirm, "click", () => void submitLogin(null, true));
  listen(steps.register, "submit", submitRegister);
  listen(logoutButton, "click", logout);
  listen(window, "auth:session-ended", handleSessionEnded);

  elements.sessionLimitCancelButtons.forEach((button) => {
    listen(button, "click", () => {
      setSessionLimitMessage("");
      navigate("login");
    });
  });
}

export { mountCredentials };
