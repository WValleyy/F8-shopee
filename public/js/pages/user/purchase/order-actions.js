import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { showToast } from "../../../shared/ui/toast.js";
import { renderHeaderNotificationPreview } from "../../../widgets/header/notifications.js";

const RETURN_ACTIONS = new Set(["return"]);

function mountOrderActions({ root, refreshCollection, signal }) {
  root.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest("[data-order-action]");
      const action = button?.dataset.orderAction;

      if (!button || RETURN_ACTIONS.has(action)) return;

      event.preventDefault();

      const card = button.closest("[data-order-card]");
      const orderId = button.dataset.orderId;

      card.querySelectorAll("[data-order-action]").forEach((actionButton) => {
        actionButton.disabled = true;
      });

      try {
        const data = await requestJson(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          body: { action },
          signal,
        });
        if (action === "complete" && data.notificationPreview)
          renderHeaderNotificationPreview(data.notificationPreview);

        await refreshCollection();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
        card.querySelectorAll("[data-order-action]").forEach((actionButton) => {
          actionButton.disabled = false;
        });
      }
    },
    { signal },
  );
}

export { mountOrderActions };
