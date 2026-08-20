import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { confirm } from "../../../shared/ui/confirm.js";
import { showToast } from "../../../shared/ui/toast.js";

function mount({ root, collection, signal }) {
  root.addEventListener(
    "click",
    async (event) => {
      const purgeButton = event.target.closest("[data-user-purge]");

      if (purgeButton) {
        const confirmed = await confirm({
          title: "Xóa vĩnh viễn tài khoản",
          message:
            "Dữ liệu tài khoản sẽ bị xóa vĩnh viễn và không thể hoàn tác.",
          confirmText: "Xóa vĩnh viễn",
          tone: "danger",
        });

        if (!confirmed) return;

        const userId = purgeButton.closest("[data-user-id]").dataset.userId;
        purgeButton.disabled = true;

        try {
          await requestJson(`/api/admin/users/${userId}`, {
            method: "DELETE",
            signal,
          });
          await collection.refresh();
        } catch (error) {
          if (isAbortError(error, signal)) return;

          showToast(error.message, "error");
          purgeButton.disabled = false;
        }
        return;
      }

      const activeButton = event.target.closest("[data-user-active]");

      if (!activeButton) return;

      const isActive = activeButton.dataset.userActive === "true";
      const confirmed = await confirm({
        title: isActive ? "Mở khóa tài khoản" : "Khóa tài khoản",
        message: isActive
          ? "Mở khóa tài khoản này?"
          : "Khóa tài khoản và thu hồi các phiên đăng nhập?",
        confirmText: isActive ? "Mở khóa" : "Khóa tài khoản",
        tone: isActive ? "default" : "danger",
      });

      if (!confirmed) return;

      const userId = activeButton.closest("[data-user-id]").dataset.userId;
      activeButton.disabled = true;

      try {
        await requestJson(`/api/admin/users/${userId}/active`, {
          method: "PATCH",
          body: { isActive },
          signal,
        });
        await collection.refresh();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
        activeButton.disabled = false;
      }
    },
    { signal },
  );
}

export { mount };
