import { authFetch, requestJson } from "../../../shared/api/http-client.js";
import { renderButtons } from "../../../shared/navigation/pagination.js";
import { showToast } from "../../../shared/ui/toast.js";
import { openAuthModal } from "../../../features/auth/auth.js";
import { isAuthenticated } from "../../../features/auth/state.js";

function mountProductReviews({ root, initialState }) {
  const contentRoot = root.querySelector("[data-product-reviews-content]");
  const productSlug = initialState.slug;
  let currentRating = 0;
  let activeRequestController = null;

  function renderReviewPagination(pagination) {
    const paginationRoot = root.querySelector("[data-pagination-root]");
    renderButtons(paginationRoot, pagination);
  }

  function renderRatingState() {
    root.querySelectorAll("[data-review-rating]").forEach((button) => {
      const rating = Number(button.dataset.reviewRating);
      const isActive = rating === currentRating;

      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function setLoading(isLoading) {
    root.dataset.reviewsLoading = String(isLoading);
  }

  async function fetchReviews({ rating, page }, requestSignal) {
    const params = new URLSearchParams({
      page: String(page),
    });

    if (rating >= 1 && rating <= 5) {
      params.set("rating", String(rating));
    }

    const response = await authFetch(
      `/product/${encodeURIComponent(productSlug)}/reviews?${params.toString()}`,
      {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Partial-Target": "fragment",
        },
        signal: requestSignal,
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Không thể tải đánh giá.");
    }

    return payload;
  }

  async function loadReviews({ rating = currentRating, page = 1 } = {}) {
    activeRequestController?.abort();
    const requestController = new AbortController();
    activeRequestController = requestController;

    setLoading(true);

    try {
      const payload = await fetchReviews(
        { rating, page },
        requestController.signal,
      );

      contentRoot.innerHTML = payload.html;
      currentRating = Number(payload.rating);
      renderRatingState();
      renderReviewPagination(payload.pagination);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
      }
    } finally {
      if (activeRequestController === requestController) {
        activeRequestController = null;
        setLoading(false);
      }
    }
  }

  function readHelpfulState(button) {
    return {
      isHelpful: button.getAttribute("aria-pressed") === "true",
      helpfulCount: Number(
        button.querySelector("[data-review-helpful-count]").textContent,
      ),
    };
  }

  function renderHelpfulState(button, state) {
    button.setAttribute("aria-pressed", String(state.isHelpful));
    button.querySelector("[data-review-helpful-count]").textContent = String(
      state.helpfulCount,
    );
  }

  root.addEventListener("click", async (event) => {
    const ratingButton = event.target.closest("[data-review-rating]");
    const pageButton = event.target.closest(
      "[data-pagination-root] [data-pagination-page]",
    );
    const helpfulButton = event.target.closest("[data-review-helpful]");

    if (ratingButton) {
      const rating = Number(ratingButton.dataset.reviewRating);

      if (rating !== currentRating) {
        await loadReviews({ rating, page: 1 });
      }
      return;
    }

    if (pageButton) {
      if (pageButton.disabled) {
        return;
      }

      const page = Number(pageButton.dataset.paginationPage);

      if (Number.isInteger(page) && page >= 1) {
        await loadReviews({ rating: currentRating, page });
      }
      return;
    }

    if (!helpfulButton) return;

    if (!isAuthenticated()) {
      openAuthModal("login");
      return;
    }

    const previous = readHelpfulState(helpfulButton);
    const next = {
      isHelpful: !previous.isHelpful,
      helpfulCount: Math.max(
        0,
        previous.helpfulCount + (previous.isHelpful ? -1 : 1),
      ),
    };

    helpfulButton.disabled = true;

    try {
      await requestJson(
        `/api/reviews/${helpfulButton.dataset.reviewId}/helpful`,
        { method: next.isHelpful ? "PUT" : "DELETE" },
      );
      renderHelpfulState(helpfulButton, next);
    } catch (error) {
      if (error.status === 401) openAuthModal("login");
      else showToast(error.message, "error");
    } finally {
      helpfulButton.disabled = false;
    }
  });

  renderReviewPagination(initialState.pagination); // render pagination on initial load
}

export { mountProductReviews };
