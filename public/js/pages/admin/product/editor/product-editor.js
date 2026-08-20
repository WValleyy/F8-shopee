import { requestJson } from "../../../../shared/api/http-client.js";
import { confirm } from "../../../../shared/ui/confirm.js";
import { showToast } from "../../../../shared/ui/toast.js";
import { mountProductMedia } from "./media.js";
import { mountProductSpecifications } from "./specifications.js";
import { mountProductVariants } from "./variants.js";

function mount({ loadPage, refreshPage, root: pageRoot, signal }) {
  const root = pageRoot.querySelector("[data-admin-product-editor]");
  const form = root.querySelector("[data-product-form]");
  const notice = root.querySelector("[data-form-notice]");
  const variants = mountProductVariants({ root, signal });
  const specifications = mountProductSpecifications({ root, signal });
  const media = mountProductMedia({
    root,
    signal,
  });

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      notice.textContent = "";
      notice.dataset.type = "";

      const submitButton = form.querySelector('[type="submit"]');
      const productId = root.dataset.productId;
      const formData = new FormData();

      let collectedVariants;
      let collectedSpecifications;
      try {
        collectedVariants = variants.collect();
        collectedSpecifications = specifications.collect();
      } catch (error) {
        notice.textContent = error.message;
        notice.dataset.type = "error";
        return;
      }

      const { variants: variantsPayload, variantImageFiles } =
        collectedVariants;

      const productImageFiles = [...media.newImages.values()].map(
        (item) => item.file,
      );
      const totalUploadBytes = [
        ...productImageFiles,
        ...variantImageFiles,
      ].reduce((total, file) => total + file.size, 0);
      const maxUploadBytes = Number(root.dataset.maxProductUploadBytes);

      if (totalUploadBytes > maxUploadBytes) {
        const maxMb = Math.ceil(maxUploadBytes / (1024 * 1024));
        notice.textContent = `Tổng dung lượng ảnh tải lên không được vượt quá ${maxMb} MB.`;
        notice.dataset.type = "error";
        return;
      }

      submitButton.disabled = true;
      formData.set("name", form.elements.name.value.trim());
      formData.set("brand", form.elements.brand.value.trim());
      formData.set("categoryId", form.elements.categoryId.value);
      formData.set("description", form.elements.description.value.trim());
      formData.set("isPublished", String(form.elements.isPublished.checked));
      formData.set("specifications", JSON.stringify(collectedSpecifications));
      formData.set(
        "retainedImagePublicIds",
        JSON.stringify(media.listRetainedImagePublicIds()),
      );

      formData.set("variants", JSON.stringify(variantsPayload));

      media.newImages.forEach(({ file }) => {
        formData.append("productImages", file, file.name);
      });

      variantImageFiles.forEach((file) => {
        formData.append("variantImages", file, file.name);
      });

      try {
        await requestJson(
          productId
            ? `/api/admin/products/${productId}`
            : "/api/admin/products",
          {
            method: productId ? "PATCH" : "POST",
            body: formData,
            signal,
          },
        );
        variants.commitPendingRemovals();
        showToast("Sản phẩm đã được lưu.");

        if (productId) {
          await refreshPage();
        } else {
          await loadPage("/admin/products");
        }
      } catch (error) {
        if (error.code === "PRODUCT_VARIANT_HAS_ORDERS") {
          const blockedVariantIds = Array.isArray(error.meta?.variantIds)
            ? error.meta.variantIds
            : [];

          variants.restorePendingRemovals(blockedVariantIds);
        }

        const validationMessages = Array.isArray(error.meta?.messages)
          ? error.meta.messages
          : [];

        notice.textContent = validationMessages.length
          ? validationMessages.join(" ")
          : error.message;
        notice.dataset.type = "error";
      } finally {
        submitButton.disabled = false;
      }
    },
    { signal },
  );

  root.querySelector("[data-refresh-product-rating]")?.addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget;

      button.disabled = true;

      try {
        await requestJson("/api/admin/products/actions", {
          method: "POST",
          body: {
            productIds: [root.dataset.productId],
            action: "REFRESH_RATING",
          },
          signal,
        });
        showToast("Đánh giá đã được tính lại từ đánh giá công khai.");
      } catch (error) {
        notice.textContent = error.message;
        notice.dataset.type = "error";
      } finally {
        button.disabled = false;
      }
    },
    { signal },
  );

  const deleteButton = root.querySelector("[data-delete-product]");
  if (deleteButton) {
    deleteButton.addEventListener(
      "click",
      async () => {
        const confirmed = await confirm({
          title: "Xóa vĩnh viễn sản phẩm",
          message:
            "Sản phẩm chỉ được xóa nếu chưa từng phát sinh đơn hàng. Toàn bộ phiên bản và wishlist liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.",
          confirmText: "Xóa vĩnh viễn",
          tone: "danger",
        });

        if (!confirmed) return;

        deleteButton.disabled = true;

        try {
          await requestJson(
            `/api/admin/products/${encodeURIComponent(root.dataset.productId)}`,
            {
              method: "DELETE",
              signal,
            },
          );
          await loadPage("/admin/products");
        } catch (error) {
          notice.textContent = error.message;
          notice.dataset.type = "error";
          deleteButton.disabled = false;
        }
      },
      { signal },
    );
  }

  return () => {
    variants.cleanup();
    media.cleanup();
  };
}

export { mount };
