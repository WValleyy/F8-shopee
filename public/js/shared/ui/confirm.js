import { close, open } from "./modal.js";

let confirmResolver = null;

function configureConfirmModal({ title, message, confirmText, tone }) {
  const modal = document.querySelector("[data-confirm-modal]");
  modal.querySelector("[data-confirm-title]").textContent = title;
  modal.querySelector("[data-confirm-message]").textContent = message;

  const confirmButton = modal.querySelector("[data-confirm-submit]");

  confirmButton.textContent = confirmText;
  confirmButton.dataset.tone = tone === "danger" ? "danger" : "primary";

  return modal;
}

function handleConfirmSubmit(event) {
  const confirmButton = event.target.closest("[data-confirm-submit]");
  const modal = confirmButton?.closest("[data-confirm-modal]");

  if (!modal) return;

  const resolver = confirmResolver;

  confirmResolver = null;
  close(modal, { reason: "success" });
  resolver(true);
}

function handleConfirmModalClosed(event) {
  if (!event.target.matches("[data-confirm-modal]") || !confirmResolver) return;

  const resolver = confirmResolver;

  confirmResolver = null;
  resolver(false);
}

function confirm({ title, message, confirmText, tone }) {
  confirmResolver?.(false);

  const modal = configureConfirmModal({ title, message, confirmText, tone });
  open(modal);

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

document.addEventListener("click", handleConfirmSubmit);
document.addEventListener("modal:closed", handleConfirmModalClosed, true);

export { confirm };
