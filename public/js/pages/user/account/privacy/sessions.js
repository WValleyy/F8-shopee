import {
  isAbortError,
  requestJson,
} from "../../../../shared/api/http-client.js";
import { showToast } from "../../../../shared/ui/toast.js";

function mountSessionSettings({ root, refreshPage, signal }) {
  root.addEventListener(
    "click",
    async (event) => {
      const revokeButton = event.target.closest("[data-revoke-auth-session]");

      if (revokeButton) {
        try {
          const result = await requestJson(
            `/api/auth/sessions/${revokeButton.dataset.revokeAuthSession}`,
            { method: "DELETE", signal },
          );

          if (result.revokedCurrentSession) window.location.assign("/");
          else await refreshPage();
        } catch (error) {
          if (isAbortError(error, signal)) return;

          showToast(error.message, "error");
        }
        return;
      }

      if (!event.target.closest("[data-logout-all-sessions]")) return;

      try {
        await requestJson("/api/auth/logout-all", { method: "POST", signal });
        window.location.assign("/");
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
      }
    },
    { signal },
  );
}

export { mountSessionSettings };
