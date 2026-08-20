let hideTimer = null;

function hideToast() {
  const toast = document.querySelector("[data-toast]");

  if (!toast) return;

  window.clearTimeout(hideTimer);
  hideTimer = null;
  toast.dataset.visible = "false";
}

function showToast(message, type = "success") {
  const toast = document.querySelector("[data-toast]");

  if (!toast) return;

  toast.textContent = message;
  toast.dataset.type = type;

  // Restart the transition even when another toast is already visible.
  toast.dataset.visible = "false";
  void toast.offsetWidth;
  toast.dataset.visible = "true";
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    hideToast();
  }, 3200);
}

document.querySelector("[data-toast]")?.addEventListener("click", hideToast);

export { showToast };
