function mountPurchaseFilters({ root, paths, signal }) {
  function syncControls(path = window.location.href) {
    const { tab, query } = paths.read(path);

    root.querySelectorAll("[data-purchase-tab]").forEach((link) => {
      link.setAttribute(
        "aria-current",
        link.dataset.purchaseTab === tab ? "page" : "false",
      );
      link.href = paths.tab(path, link.dataset.purchaseTab);
    });

    const searchInput = root.querySelector(
      '[data-user-search-form="purchase"] [name="q"]',
    );

    searchInput.value = query;
  }

  syncControls();
  root.addEventListener("account:collection-rendered", () => syncControls(), {
    signal,
  });
}

export { mountPurchaseFilters };
