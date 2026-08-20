import { normalizePath } from "../../../shared/navigation/path.js";
import { isModalState } from "../../../shared/ui/modal.js";

function mountHomeNavigation({ root, collection, view }) {
  // Collection links are loaded by mountPaginatedCollection. Home only owns
  // local category expansion and browser history synchronization.
  root.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;

    const categoryToggle = event.target.closest("[data-toggle-category]");

    if (categoryToggle) {
      // Expanding a category node changes only local UI state.
      event.preventDefault();
      view.toggleCategoryNode(categoryToggle);
      return;
    }
  });

  // Home is loaded as a standalone entry, so it owns filter synchronization
  // when the browser changes the URL without a page-navigation controller.
  window.addEventListener("popstate", async (event) => {
    if (isModalState(event.state)) return;

    const path = normalizePath();
    await collection.syncFromLocation(path);
  });
}

export { mountHomeNavigation };
