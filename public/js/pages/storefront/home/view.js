const SELECTORS = Object.freeze({
  categoryItem: "[data-category-node]",
  categoryLink: "[data-category-link]",
  categoryNode: "[data-category-node]",
  pageCurrent: "[data-home-page-current]",
  pageTotal: "[data-home-page-total]",
  sortButton: "[data-home-sort-button][data-sort]",
  sortItem: "[data-sort-item]",
  sortLabel: "[data-home-sort-label]",
  sortLink: "[data-home-sort-link][data-sort]",
  topPager: "[data-home-top-pager]",
});

function createHomeView(root, paths, sortGroups) {
  function toggleCategoryNode(button) {
    const node = button.closest(SELECTORS.categoryNode);
    const children = node.querySelector(":scope > [data-category-children]");
    const nextExpanded = children.hidden;

    node.dataset.expanded = String(nextExpanded);
    button.setAttribute("aria-expanded", String(nextExpanded));
    children.hidden = !nextExpanded;
  }

  function updatePagerSummary(pagination) {
    const totalPages = Number(pagination.totalPages);

    root.querySelector(SELECTORS.pageCurrent).textContent = String(
      totalPages ? pagination.page : 0,
    );
    root.querySelector(SELECTORS.pageTotal).textContent = String(totalPages);
  }

  function updateTopPager(path, pagination) {
    const pager = root.querySelector(SELECTORS.topPager);
    const previous = pager.querySelector('[data-navigation="prev"]');
    const next = pager.querySelector('[data-navigation="next"]');
    const page = Number(pagination.page);
    const totalPages = Number(pagination.totalPages);
    const hasPrevious = page > 1;
    const hasNext = page < totalPages;

    pager.hidden = totalPages <= 1;
    previous.href = hasPrevious ? paths.page(path, page - 1) : "#";
    next.href = hasNext ? paths.page(path, page + 1) : "#";
    previous.dataset.disabled = String(!hasPrevious);
    next.dataset.disabled = String(!hasNext);
    previous.setAttribute("aria-disabled", String(!hasPrevious));
    next.setAttribute("aria-disabled", String(!hasNext));
  }

  function updateCategoryLinks(path) {
    root.querySelectorAll(SELECTORS.categoryLink).forEach((link) => {
      const category = link.dataset.category;

      link.href = paths.category(path, category);
    });
  }

  function updateCategoryState(path) {
    const { category: activeCategory } = paths.read(path);

    root.querySelectorAll(SELECTORS.categoryItem).forEach((item) => {
      item.dataset.active = "false";
      item.dataset.ancestorActive = "false";
    });

    const activeLink = [...root.querySelectorAll(SELECTORS.categoryLink)].find(
      (link) => link.dataset.category === activeCategory,
    );

    if (activeLink) {
      const activeItem = activeLink.closest(SELECTORS.categoryItem);
      activeItem.dataset.active = "true";

      let ancestor = activeItem.parentElement?.closest(SELECTORS.categoryItem);

      while (ancestor) {
        ancestor.dataset.ancestorActive = "true";
        ancestor = ancestor.parentElement?.closest(SELECTORS.categoryItem);
      }
    }

    root.querySelectorAll(SELECTORS.categoryNode).forEach((node) => {
      const isActiveBranch =
        node.dataset.active === "true" ||
        node.dataset.ancestorActive === "true";
      if (!isActiveBranch) return;

      const children = node.querySelector(":scope > [data-category-children]");
      if (!children) return;

      node.dataset.expanded = "true";
      children.hidden = false;
    });
  }

  function updateSortLinks(path) {
    root.querySelectorAll(SELECTORS.sortButton).forEach((button) => {
      const sort = button.dataset.sort;

      button.href = paths.sort(path, sort);
    });

    root.querySelectorAll(SELECTORS.sortLink).forEach((link) => {
      const sort = link.dataset.sort;

      link.href = paths.sort(path, sort);
    });
  }

  function updateSortState(path) {
    const { sortCriteria } = paths.read(path);

    root.querySelectorAll(SELECTORS.sortButton).forEach((button) => {
      const sort = button.dataset.sort;

      button.dataset.active = String(sortCriteria.includes(sort));
    });

    root.querySelectorAll(SELECTORS.sortLink).forEach((link) => {
      const sort = link.dataset.sort;
      const active = sortCriteria.includes(sort);

      link.closest(SELECTORS.sortItem).dataset.active = String(active);
    });

    const priceSort = sortCriteria.find((item) => sortGroups[item] === "price");
    const sortLabel = root.querySelector(SELECTORS.sortLabel);
    const activePriceLink = priceSort
      ? root.querySelector(`${SELECTORS.sortLink}[data-sort="${priceSort}"]`)
      : null;

    sortLabel.textContent = activePriceLink
      ? activePriceLink.textContent.trim()
      : "Giá";
  }

  function renderCatalogChrome(pagination, path) {
    updatePagerSummary(pagination);
    updateCategoryLinks(path);
    updateCategoryState(path);
    updateSortLinks(path);
    updateSortState(path);
    updateTopPager(path, pagination);
  }

  return {
    renderCatalogChrome,
    toggleCategoryNode,
  };
}

export { createHomeView };
