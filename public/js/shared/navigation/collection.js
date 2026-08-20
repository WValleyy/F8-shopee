import { isPlainLeftClick } from "./link.js";
import { normalizePath } from "./path.js";
import { createPartialRegion } from "./partial-region.js";
import { renderLinks } from "./pagination.js";

function mountPaginatedCollection({
  root,
  initialPagination,
  afterRender: onCollectionRendered,
}) {
  const controller = new AbortController();
  const { signal } = controller;
  const paginationRoot = root.querySelector("[data-pagination-root]");
  const resultsRoot = root.querySelector("[data-collection-results]");
  let currentPagination = initialPagination;
  const region = createPartialRegion({
    target: "paginated-collection",
    replaceHtml: (html) => {
      resultsRoot.innerHTML = html;
    },
    afterRender: async (payload, path) => {
      currentPagination = payload.pagination;
      renderPagination();
      await onCollectionRendered(currentPagination, path);
    },
  });

  function renderPagination() {
    renderLinks(paginationRoot, currentPagination);
  }

  // Collection links may be rendered outside a fixed container, so use
  // document delegation and let the marker identify this collection's links.
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest(
        "a[data-collection-navigation-link][href]",
      );

      if (!link || !root.contains(link) || !isPlainLeftClick(event)) {
        return;
      }

      event.preventDefault();

      if (link.getAttribute("href") !== "#")
        void region.load(normalizePath(link.href));
    },
    { signal },
  );

  return {
    load: region.load,
    refresh: region.refresh,
    syncFromLocation: region.syncFromLocation,
    renderPagination,
    destroy() {
      controller.abort();
      region.cancel();
    },
  };
}

export { mountPaginatedCollection };
