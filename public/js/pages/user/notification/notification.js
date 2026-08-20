import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { showToast } from "../../../shared/ui/toast.js";
import { renderHeaderNotificationPreview } from "../../../widgets/header/notifications.js";

function mount({ root, signal }) {
  root.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest("[data-mark-all-notifications]");

      if (!button) return;

      event.preventDefault();
      button.disabled = true;

      try {
        const data = await requestJson("/api/notifications/read-all", {
          method: "PATCH",
          signal,
        });
        root
          .querySelectorAll('[data-unread="true"]')
          .forEach((item) => item.setAttribute("data-unread", "false"));
        renderHeaderNotificationPreview(data.notificationPreview);
        button.remove();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        button.disabled = false;
        showToast(error.message, "error");
      }
    },
    { signal },
  );
}

export { mount };
