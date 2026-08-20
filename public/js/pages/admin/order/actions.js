import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { confirm } from "../../../shared/ui/confirm.js";
import { showToast } from "../../../shared/ui/toast.js";

function mountOrderActions({ root, refreshCollection, signal }) {
  root.addEventListener(
    "click",
    async (event) => {
      const detailButton = event.target.closest("[data-order-details-toggle]");

      if (detailButton) {
        const details = detailButton
          .closest("[data-admin-order-id]")
          .querySelector("[data-order-details]");

        details.hidden = !details.hidden;
        detailButton.setAttribute("aria-expanded", String(!details.hidden));
        return;
      }

      const button = event.target.closest("[data-admin-order-action]");

      if (!button) return;

      const confirmed = await confirm({
        title: "Cập nhật trạng thái đơn hàng",
        message: "Xác nhận cập nhật trạng thái đơn hàng này?",
        confirmText: "Cập nhật",
      });

      if (!confirmed) return;

      const orderId = button.closest("[data-admin-order-id]").dataset
        .adminOrderId;
      const action = button.dataset.adminOrderAction;

      button.disabled = true;

      try {
        await requestJson(`/api/admin/orders/${orderId}/status`, {
          method: "PATCH",
          body: { action },
          signal,
        });
        await refreshCollection();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
        button.disabled = false;
      }
    },
    { signal },
  );
}

export { mountOrderActions };
