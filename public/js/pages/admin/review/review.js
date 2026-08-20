import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import { mountImageLightbox } from "../../../shared/ui/image-lightbox.js";
import { showToast } from "../../../shared/ui/toast.js";

function mount({ root: pageRoot, collection, signal }) {
  const root = pageRoot.querySelector('[data-admin-collection="reviews"]');

  mountReviewActions({ root, collection, signal });
  mountImageLightbox(pageRoot, signal);
}

function mountReviewActions({ root, collection, signal }) {
  root.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest("[data-review-publication]");

      if (!button) return;

      const review = button.closest("[data-review-id]");
      button.disabled = true;

      try {
        await requestJson(
          `/api/admin/reviews/${review.dataset.reviewId}/publication`,
          {
            method: "PATCH",
            body: {
              isPublished: button.dataset.nextPublished === "true",
            },
            signal,
          },
        );
        await collection.refresh();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        showToast(error.message, "error");
        button.disabled = false;
      }
    },
    { signal },
  );
}

export { mount };
