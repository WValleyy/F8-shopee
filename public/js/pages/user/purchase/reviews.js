import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { clearFormErrors, setFieldError } from "../../../shared/ui/forms.js";
import {
  close as closeDialog,
  open as openDialog,
} from "../../../shared/ui/modal.js";
import { showToast } from "../../../shared/ui/toast.js";

const IMAGE_MAX_COUNT = 3;
const IMAGE_MAX_SIZE = 1024 * 1024;

function mountPurchaseReviews({ root, refreshCollection, signal }) {
  const images = [];

  function getContext() {
    const modal = root.querySelector("#purchase-review-modal");
    const form = root.querySelector("#purchase-review-form");

    return {
      modal,
      form,
      title: form.querySelector("[data-purchase-review-title]"),
      image: form.querySelector("[data-purchase-review-image]"),
      name: form.querySelector("[data-purchase-review-name]"),
      classify: form.querySelector("[data-purchase-review-classify]"),
      orderIdInput: form.elements.orderId,
      variantIdInput: form.elements.variantId,
      ratingInput: form.elements.rating,
      productIdInput: form.elements.productId,
      contentInput: form.elements.content,
      imageFilesInput: form.elements.imageFiles,
      imageList: form.querySelector("[data-purchase-review-image-list]"),
      imageTemplate: root.querySelector("[data-purchase-review-image-template]"),
      submitButton: form.querySelector("[data-purchase-review-submit]"),
      ratingButtons: [...form.querySelectorAll("[data-rating-value]")],
    };
  }

  function renderImagePreviews(context) {
    if (!images.length) {
      context.imageList.replaceChildren();
      context.imageList.hidden = true;
      return;
    }

    const previews = images.map((item, index) => {
      const preview = context.imageTemplate.content.firstElementChild.cloneNode(true);
      const removeButton = preview.querySelector("[data-review-image-remove]");
      const image = preview.querySelector("[data-purchase-review-image-preview]");

      removeButton.dataset.reviewImageRemove = String(index);
      image.src = item.previewUrl;
      image.alt = `Ảnh đánh giá ${index + 1}`;
      return preview;
    });

    context.imageList.hidden = false;
    context.imageList.replaceChildren(...previews);
  }

  function resetImages(context) {
    images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    images.length = 0;
    context.imageFilesInput.value = "";
    renderImagePreviews(context);
  }

  function addReviewFiles(files) {
    const context = getContext();

    clearFormErrors(context.form);

    if (images.length >= IMAGE_MAX_COUNT) {
      setFieldError(
        context.imageFilesInput,
        `Chỉ được đính kèm tối đa ${IMAGE_MAX_COUNT} ảnh.`,
      );
      context.imageFilesInput.value = "";
      return;
    }

    for (const file of files) {
      if (images.length >= IMAGE_MAX_COUNT) break;

      if (!file.type.startsWith("image/")) {
        setFieldError(
          context.imageFilesInput,
          "Chỉ chấp nhận tệp hình ảnh hợp lệ.",
        );
        continue;
      }

      if (file.size > IMAGE_MAX_SIZE) {
        setFieldError(context.imageFilesInput, "Mỗi ảnh chỉ được tối đa 1 MB.");
        continue;
      }

      const duplicate = images.some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified,
      );

      if (duplicate) continue;

      images.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    context.imageFilesInput.value = "";
    renderImagePreviews(context);
  }

  function syncRating(context, rating) {
    const normalizedRating = Math.max(1, Math.min(5, Number(rating) || 5));

    context.ratingInput.value = String(normalizedRating);
    context.ratingButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.ratingValue) === normalizedRating),
      );
    });
  }

  function openReview(itemNode, opener) {
    const context = getContext();

    clearFormErrors(context.form);
    context.productIdInput.value = itemNode.dataset.productId;
    context.orderIdInput.value = itemNode.dataset.orderId;
    context.variantIdInput.value = itemNode.dataset.variantId;
    context.contentInput.value = "";
    resetImages(context);
    syncRating(context, 5);
    context.image.src = itemNode.dataset.productImage;
    context.image.alt = itemNode.dataset.productName;
    context.name.textContent = itemNode.dataset.productName;
    context.classify.textContent = `Phân loại hàng: ${itemNode.dataset.productClassify}`;
    context.title.textContent = "Đánh giá sản phẩm";
    openDialog(context.modal, { opener });
  }

  root.addEventListener(
    "click",
    (event) => {
      const openButton = event.target.closest("[data-open-review-modal]");

      if (openButton) {
        event.preventDefault();
        openReview(openButton.closest("[data-order-item]"), openButton);
        return;
      }

      const removeButton = event.target.closest("[data-review-image-remove]");

      if (removeButton) {
        event.preventDefault();

        const [removed] = images.splice(
          Number(removeButton.dataset.reviewImageRemove),
          1,
        );

        URL.revokeObjectURL(removed.previewUrl);
        renderImagePreviews(getContext());
        return;
      }

      const ratingButton = event.target.closest(
        "#purchase-review-form [data-rating-value]",
      );

      if (ratingButton) {
        syncRating(getContext(), ratingButton.dataset.ratingValue);
      }
    },
    { signal },
  );

  root.addEventListener(
    "change",
    (event) => {
      if (!event.target.matches('#purchase-review-form [name="imageFiles"]')) {
        return;
      }

      if (event.target.files.length) addReviewFiles(event.target.files);
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    async (event) => {
      if (!event.target.matches("#purchase-review-form")) return;

      event.preventDefault();

      const context = getContext();
      const productId = context.productIdInput.value.trim();
      const rating = Number(context.ratingInput.value);

      clearFormErrors(context.form);

      if (!productId) {
        showToast("Không tìm thấy sản phẩm để đánh giá.", "error");
        return;
      }
      if (rating < 1 || rating > 5) {
        setFieldError(context.ratingInput, "Vui lòng chọn từ 1 đến 5 sao.");
        return;
      }

      context.submitButton.disabled = true;

      try {
        const formData = new FormData();

        formData.set("orderId", context.orderIdInput.value.trim());
        formData.set("variantId", context.variantIdInput.value.trim());
        formData.set("rating", String(rating));
        formData.set("content", context.contentInput.value.trim());
        images.forEach((item) => {
          formData.append("images", item.file, item.file.name);
        });

        await requestJson(
          `/api/reviews/products/${encodeURIComponent(productId)}`,
          { method: "POST", body: formData, signal },
        );
        closeDialog(context.modal);
        await refreshCollection();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
      } finally {
        context.submitButton.disabled = false;
      }
    },
    { signal },
  );

  return () => {
    images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    images.length = 0;
  };
}

export { mountPurchaseReviews };
