import { startButtonCountdown } from "../../../../shared/ui/countdown.js";
import { setFieldMessage } from "../../../../shared/ui/forms.js";

function createEmailWorkflowTools(root) {
  let stopCountdown = () => {};

  function resetCountdown() {
    stopCountdown();
    stopCountdown = () => {};
    root.querySelectorAll("[data-countdown-ready-text]").forEach((button) => {
      button.disabled = false;
      button.textContent = button.dataset.countdownReadyText;
    });
  }

  function startCountdown(
    button,
    seconds,
    messagePrefix = "Bạn có thể gửi lại mã sau",
  ) {
    stopCountdown();

    const form = button.closest("form");
    const input =
      form.elements.otp ||
      form.querySelector("input:not([type='hidden']), textarea, select");

    stopCountdown = startButtonCountdown(
      button,
      seconds,
      (remaining, timeText) =>
        setFieldMessage(
          input,
          remaining > 0 ? `${messagePrefix} ${timeText}.` : "",
        ),
    );
  }

  function handleRateLimit(button, error, prefix = "Gửi lại mã sau") {
    if (error.code !== "RATE_LIMITED" || error.retryAfter < 1) return false;

    startCountdown(button, error.retryAfter, error.message || prefix);
    return true;
  }

  return { handleRateLimit, resetCountdown, startCountdown };
}

export { createEmailWorkflowTools };
