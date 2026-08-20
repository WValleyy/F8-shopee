import { createPageNavigation } from "../../shared/navigation/page-navigation.js";
import { mountPaginatedCollection } from "../../shared/navigation/collection.js";

const PAGE_LOADERS = Object.freeze({
  categories: () => import("./category/category.js"),
  orders: () => import("./order/order.js"),
  users: () => import("./user/user.js"),
  products: () => import("./product/products.js"),
  "product-editor": () => import("./product/editor/product-editor.js"),
  reviews: () => import("./review/review.js"),
});

function mountAdminCollection(container) {
  const root = container.querySelector("[data-admin-collection]");

  if (!root) return null;

  const filterForm = root.querySelector("[data-admin-filter-form]");
  const initialState = JSON.parse(
    root.querySelector("[data-page-initial-state]").textContent,
  );
  const lifecycleController = new AbortController();
  const { signal } = lifecycleController;

  function syncFilterForm(path) {
    const url = new URL(path, window.location.origin);

    if (filterForm) {
      [...filterForm.elements].forEach((field) => {
        if (!field.name) return;

        const value = url.searchParams.get(field.name);

        if (value !== null) field.value = value;
        else if (field.tagName === "SELECT") field.selectedIndex = 0;
        else field.value = "";
      });
    }
  }

  const collection = mountPaginatedCollection({
    root,
    initialPagination: initialState.pagination,
    afterRender: (_pagination, path) => {
      syncFilterForm(path);
      root.dispatchEvent(new Event("admin:collection-rendered"));
    },
  });

  collection.renderPagination();

  filterForm?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const url = new URL(filterForm.action, window.location.origin);
      const formData = new FormData(filterForm);

      formData.forEach((value, key) => {
        const normalized = String(value).trim();

        if (normalized && normalized !== "all")
          url.searchParams.set(key, normalized);
      });

      void collection.load(`${url.pathname}${url.search}`);
    },
    { signal },
  );

  filterForm?.querySelectorAll("select, input[type='date'], input[type='number']").forEach((field) => {
    field.addEventListener("change", () => filterForm.requestSubmit(), {
      signal,
    });
  });

  return {
    load: collection.load,
    refresh: collection.refresh,
    syncFromLocation: collection.syncFromLocation,
    destroy() {
      lifecycleController.abort();
      collection.destroy();
    },
  };
}

function createAdminNavigation(content) {
  const sidebarLinks = [
    ...document.querySelectorAll("[data-admin-link][data-section]"),
  ];

  return createPageNavigation({
    content,
    initialPage: document.body.dataset.currentPage,
    loaders: PAGE_LOADERS,
    mountPaginatedCollection: mountAdminCollection,
    applyPageState(payload) {
      const { currentPage, activeSection, title: pageTitle } = payload;

      document.body.dataset.currentPage = currentPage;
      document.body.dataset.activeSection = activeSection;
      document.title = pageTitle;

      sidebarLinks.forEach((link) => {
        const active = link.dataset.section === activeSection;

        link.setAttribute("aria-current", active ? "page" : "false");
      });
    },
  });
}

function mountAdminPage() {
  const root = document.querySelector("[data-admin-page]");
  const navigation = createAdminNavigation(root);

  void navigation.start();
}

mountAdminPage();
