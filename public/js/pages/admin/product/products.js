import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { confirm } from "../../../shared/ui/confirm.js";
import { showToast } from "../../../shared/ui/toast.js";

function mount({ root: pageRoot, collection, signal }) {
  const root = pageRoot.querySelector('[data-admin-collection="products"]');

  mountProductBulkActions({ root, collection, signal });
}

function runProductAction(productIds, action, signal) {
  return requestJson("/api/admin/products/actions", {
    method: "POST",
    body: { productIds, action },
    signal,
  });
}

function deleteProduct(productId, signal) {
  return requestJson(`/api/admin/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    signal,
  });
}

function mountProductBulkActions({ root, collection, signal }) {
  const toolbar = root.querySelector("[data-admin-product-bulk-toolbar]");
  const selectionCount = root.querySelector(
    "[data-admin-product-selection-count]",
  );
  const selectedProductIds = new Set();

  function syncSelection() {
    const selections = [
      ...root.querySelectorAll("[data-admin-product-selection]"),
    ];
    const selectPage = root.querySelector("[data-admin-product-select-page]");

    selections.forEach((checkbox) => {
      checkbox.checked = selectedProductIds.has(checkbox.value);
    });

    const selectedOnPage = selections.filter(
      (checkbox) => checkbox.checked,
    ).length;
    if (selectPage) {
      selectPage.checked =
        selections.length > 0 && selectedOnPage === selections.length;
      selectPage.indeterminate =
        selectedOnPage > 0 && selectedOnPage < selections.length;
    }

    const selectedCount = selectedProductIds.size;
    toolbar.hidden = selectedCount === 0;
    selectionCount.textContent = `Đã chọn ${selectedCount} sản phẩm`;
    root
      .querySelectorAll("[data-admin-product-bulk-action]")
      .forEach((button) => {
        button.disabled = selectedCount === 0;
      });
  }

  root.addEventListener(
    "change",
    (event) => {
      const checkbox = event.target.closest("[data-admin-product-selection]");

      if (checkbox) {
        if (checkbox.checked) selectedProductIds.add(checkbox.value);
        else selectedProductIds.delete(checkbox.value);

        syncSelection();
        return;
      }

      const selectPage = event.target.closest(
        "[data-admin-product-select-page]",
      );
      if (!selectPage) return;

      root
        .querySelectorAll("[data-admin-product-selection]")
        .forEach((item) => {
          if (selectPage.checked) selectedProductIds.add(item.value);
          else selectedProductIds.delete(item.value);
        });
      syncSelection();
    },
    { signal },
  );

  root.addEventListener(
    "click",
    async (event) => {
      const unpublishButton = event.target.closest("[data-unpublish-product]");

      if (unpublishButton) {
        const confirmed = await confirm({
          title: "Ẩn sản phẩm",
          message: "Ẩn sản phẩm này khỏi cửa hàng?",
          confirmText: "Ẩn sản phẩm",
          tone: "danger",
        });

        if (!confirmed) return;

        const productId = unpublishButton.closest("[data-admin-product-id]")
          .dataset.adminProductId;
        unpublishButton.disabled = true;

        try {
          await runProductAction([productId], "UNPUBLISH", signal);
          await collection.refresh();
        } catch (error) {
          if (isAbortError(error, signal)) return;

          showToast(error.message, "error");
          unpublishButton.disabled = false;
        }
        return;
      }

      const deleteButton = event.target.closest("[data-delete-product]");

      if (deleteButton) {
        const confirmed = await confirm({
          title: "Xóa vĩnh viễn sản phẩm",
          message:
            "Sản phẩm chỉ được xóa nếu chưa từng phát sinh đơn hàng. Toàn bộ phiên bản và wishlist liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.",
          confirmText: "Xóa vĩnh viễn",
          tone: "danger",
        });

        if (!confirmed) return;

        const productId = deleteButton.closest("[data-admin-product-id]")
          .dataset.adminProductId;
        deleteButton.disabled = true;

        try {
          await deleteProduct(productId, signal);
          selectedProductIds.delete(productId);
          syncSelection();
          await collection.refresh();
        } catch (error) {
          if (isAbortError(error, signal)) return;

          showToast(error.message, "error");
          deleteButton.disabled = false;
        }
        return;
      }

      const button = event.target.closest("[data-admin-product-bulk-action]");
      if (!button || !selectedProductIds.size) return;

      const action = button.dataset.adminProductBulkAction;
      const details = {
        REFRESH_RATING: {
          title: "Tính lại rating",
          message:
            "Tính lại rating từ toàn bộ đánh giá công khai của sản phẩm đã chọn?",
          confirmText: "Tính lại",
          success: "Đã tính lại rating sản phẩm.",
          tone: "default",
        },
        PUBLISH: {
          title: "Hiện sản phẩm",
          message: "Hiện sản phẩm đã chọn tại cửa hàng?",
          confirmText: "Hiện sản phẩm",
          success: "Đã hiện sản phẩm.",
          tone: "default",
        },
        UNPUBLISH: {
          title: "Ẩn sản phẩm",
          message: "Ẩn sản phẩm đã chọn khỏi cửa hàng?",
          confirmText: "Ẩn sản phẩm",
          success: "Đã ẩn sản phẩm.",
          tone: "danger",
        },
      }[action];

      if (!details) return;

      const confirmed = await confirm({
        ...details,
      });

      if (!confirmed) return;

      button.disabled = true;

      try {
        await runProductAction([...selectedProductIds], action, signal);
        selectedProductIds.clear();
        syncSelection();
        await collection.refresh();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
        syncSelection();
      }
    },
    { signal },
  );

  root.addEventListener(
    "admin:collection-rendered",
    () => {
      syncSelection();
    },
    { signal },
  );

  syncSelection();
}

export { mount };
