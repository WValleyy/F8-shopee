import { showToast } from "../../../../shared/ui/toast.js";
import {
  cleanup as cleanupVariantImages,
  getState as getVariantImageState,
  registerRow as registerVariantImageRow,
  setRowImage as setVariantRowImage,
  unregisterRow as unregisterVariantImageRow,
} from "./variant-images.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function mountProductVariants({ root, signal }) {
  const list = root.querySelector("[data-variant-list]");
  const template = root.querySelector("[data-variant-row-template]");
  const MAX_IMAGE_BYTES = Number(root.dataset.maxProductImageBytes);
  const maxVariants = Number(root.dataset.maxVariants);

  function getRows() {
    return [...list.querySelectorAll("[data-variant-row]")];
  }

  function getActiveRows() {
    return getRows().filter((row) => row.dataset.pendingRemoval !== "true");
  }

  function getPendingRows() {
    return getRows().filter((row) => row.dataset.pendingRemoval === "true");
  }

  function formatMegabytes(bytes) {
    return Math.ceil(bytes / (1024 * 1024));
  }

  list.addEventListener(
    "change",
    (event) => {
      const fileInput = event.target.closest("[data-variant-image-input]");

      if (!fileInput) return;

      const row = fileInput.closest("[data-variant-row]");
      const file = fileInput.files?.[0] || null;

      if (file) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          showToast("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.", "error");
          fileInput.value = "";
          return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
          showToast(
            `Dung lượng mỗi ảnh phiên bản không được vượt quá ${formatMegabytes(MAX_IMAGE_BYTES)} MB.`,
            "error",
          );
          fileInput.value = "";
          return;
        }

        setVariantRowImage(row, file);
        fileInput.value = "";
      }
    },
    { signal },
  );

  function setRowFieldsDisabled(row, disabled) {
    row
      .querySelectorAll(
        "[data-variant-field], [data-variant-image-input]",
      )
      .forEach((field) => {
        field.disabled = disabled;
      });
  }

  function markRowPendingRemoval(row) {
    row.dataset.pendingRemoval = "true";
    setRowFieldsDisabled(row, true);

    const removeButton = row.querySelector("[data-remove-variant]");
    const undoButton = row.querySelector("[data-undo-remove-variant]");
    removeButton.hidden = true;
    undoButton.hidden = false;
  }

  function restoreRow(row) {
    delete row.dataset.pendingRemoval;
    row.dataset.pendingRemoval = "false";
    setRowFieldsDisabled(row, false);

    const removeButton = row.querySelector("[data-remove-variant]");
    const undoButton = row.querySelector("[data-undo-remove-variant]");
    removeButton.hidden = false;
    undoButton.hidden = true;
  }

  function restorePendingRemovals(variantIds = []) {
    const variantIdSet = new Set(variantIds.map(String).filter(Boolean));
    const restoreAll = variantIdSet.size === 0;
    let firstRestoredRow = null;

    getPendingRows().forEach((row) => {
      if (!restoreAll && !variantIdSet.has(row.dataset.variantId)) return;

      restoreRow(row);

      if (!firstRestoredRow) firstRestoredRow = row;
    });

    if (firstRestoredRow) {
      firstRestoredRow
        .querySelector('[data-variant-field="isPublished"]')
        .focus();
    }
  }

  function commitPendingRemovals() {
    getPendingRows().forEach((row) => {
      unregisterVariantImageRow(row);
      row.remove();
    });
  }

  root.querySelector("[data-add-variant]").addEventListener(
    "click",
    () => {
      if (getActiveRows().length >= maxVariants) {
        showToast(
          `Sản phẩm chỉ được có tối đa ${maxVariants} phiên bản.`,
          "error",
        );
        return;
      }

      const newRow = template.content.firstElementChild.cloneNode(true);
      list.append(newRow);
      registerVariantImageRow(newRow);
    },
    { signal },
  );

  list.addEventListener(
    "click",
    (event) => {
      const undoButton = event.target.closest("[data-undo-remove-variant]");

      if (undoButton) {
        restoreRow(undoButton.closest("[data-variant-row]"));
        return;
      }

      const removeButton = event.target.closest("[data-remove-variant]");

      if (!removeButton) return;

      const row = removeButton.closest("[data-variant-row]");

      if (getActiveRows().length === 1) {
        showToast("Sản phẩm phải có ít nhất một phiên bản.", "error");
        return;
      }

      if (!row.dataset.variantId) {
        unregisterVariantImageRow(row);
        row.remove();
        return;
      }

      markRowPendingRemoval(row);
    },
    { signal },
  );

  getRows().forEach(registerVariantImageRow);

  function collect() {
    const variantImageFiles = [];

    const variantsPayload = getActiveRows().map((row) => {
      const variantId = row.dataset.variantId || "";
      const state = getVariantImageState(row);

      let imageFileIndex = null;

      if (state.file) {
        imageFileIndex = variantImageFiles.length;
        variantImageFiles.push(state.file);
      } else if (!variantId) {
        throw new Error("Phiên bản mới phải chọn ảnh.");
      }

      return {
        variantId,
        updatedAt: row.dataset.variantUpdatedAt || null,
        sku: row.querySelector('[data-variant-field="sku"]').value.trim(),
        options: row
          .querySelector('[data-variant-field="options"]')
          .value.trim(),
        price: Number(row.querySelector('[data-variant-field="price"]').value),
        originalPrice: Number(
          row.querySelector('[data-variant-field="originalPrice"]').value,
        ),
        stock: Number(row.querySelector('[data-variant-field="stock"]').value),
        imageFileIndex,
        isPublished: row.querySelector('[data-variant-field="isPublished"]')
          .checked,
      };
    });

    return {
      variants: variantsPayload,
      variantImageFiles,
    };
  }

  return {
    cleanup: cleanupVariantImages,
    collect,
    commitPendingRemovals,
    restorePendingRemovals,
  };
}

export { mountProductVariants };
