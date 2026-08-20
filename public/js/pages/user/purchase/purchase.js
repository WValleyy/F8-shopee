import { mountPurchaseFilters } from "./filters.js";
import { mountOrderActions } from "./order-actions.js";
import { createPurchasePaths } from "./paths.js";
import { mountPurchaseReturns } from "./returns.js";
import { mountPurchaseReviews } from "./reviews.js";

function mount({ root, collection, signal }) {
  const paths = createPurchasePaths();
  const options = {
    root,
    refreshCollection: collection.refresh,
    signal,
  };

  mountPurchaseFilters({ ...options, paths });
  mountOrderActions(options);

  mountPurchaseReturns(options);
  const cleanupReviews = mountPurchaseReviews(options);

  root.addEventListener(
    "submit",
    async (event) => {
      const form = event.target.closest('[data-user-search-form="purchase"]');

      if (!form) return;

      event.preventDefault();

      const query = form.elements.q.value.trim();

      await collection.load(paths.query(window.location.href, query));
    },
    { signal },
  );

  return cleanupReviews;
}

export { mount };
