function startButtonCountdown(button, seconds, onTick) {
  let remaining = Number(seconds);
  const readyText =
    button.dataset.countdownReadyText || button.textContent.trim();

  button.dataset.countdownReadyText = readyText;
  button.disabled = true;
  button.textContent = readyText;
  onTick(remaining, formatCountdownTime(remaining));

  const timer = window.setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      window.clearInterval(timer);
      button.disabled = false;
      button.textContent = readyText;
      onTick(0, "");
      return;
    }

    onTick(remaining, formatCountdownTime(remaining));
  }, 1000);

  return () => window.clearInterval(timer);
}

function formatCountdownTime(seconds) {
  const remaining = Math.max(1, Math.ceil(Number(seconds) || 1));

  return remaining < 60
    ? `${remaining}s`
    : `${Math.ceil(remaining / 60)} phút`;
}

export { startButtonCountdown };
