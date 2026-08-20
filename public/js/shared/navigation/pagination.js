const LINK_SELECTORS = {
  itemTemplate: "#shared-pagination-link-item-template",
  iconTemplate: "#shared-pagination-link-icon-template",
  ellipsisTemplate: "#shared-pagination-link-ellipsis-template",
  listTemplate: "#shared-pagination-link-list-template",
};

const BUTTON_SELECTORS = {
  itemTemplate: "#shared-pagination-button-item-template",
  iconTemplate: "#shared-pagination-button-icon-template",
  ellipsisTemplate: "#shared-pagination-button-ellipsis-template",
  listTemplate: "#shared-pagination-button-list-template",
};

function buildPagePath(page) {
  const url = new URL(window.location.href);
  const nextPage = Math.max(1, Number(page));

  if (nextPage > 1) {
    url.searchParams.set("page", String(nextPage));
  } else {
    url.searchParams.delete("page");
  }

  return `${url.pathname}${url.search}`;
}

function cloneTemplate(selector) {
  const template = document.querySelector(selector);

  return template.content.firstElementChild.cloneNode(true);
}

function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: "page",
      value: index + 1,
      isActive: index + 1 === currentPage,
    }));
  }

  const items = [
    {
      type: "page",
      value: 1,
      isActive: currentPage === 1,
    },
  ];
  const startPage = Math.max(2, currentPage - 1);
  const endPage = Math.min(totalPages - 1, currentPage + 1);

  if (startPage > 2) {
    items.push({ type: "ellipsis" });
  }

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    items.push({
      type: "page",
      value: pageNumber,
      isActive: pageNumber === currentPage,
    });
  }

  if (endPage < totalPages - 1) {
    items.push({ type: "ellipsis" });
  }

  items.push({
    type: "page",
    value: totalPages,
    isActive: currentPage === totalPages,
  });

  return items;
}

function renderPaginationControls({
  root,
  pagination,
  selectors,
  createPageControl,
  createIconControl,
}) {
  root.innerHTML = "";

  const totalPages = Math.max(0, Number(pagination.totalPages));

  if (totalPages <= 1) return;

  const currentPage = Math.min(
    Math.max(1, Number(pagination.page)),
    totalPages,
  );
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const items = buildPaginationItems(currentPage, totalPages);

  const list = cloneTemplate(selectors.listTemplate);
  const prevItem = createIconControl("prev", hasPrev, currentPage - 1);

  list.appendChild(prevItem);

  items.forEach((item) => list.appendChild(createPageControl(item)));

  const nextItem = createIconControl("next", hasNext, currentPage + 1);
  list.appendChild(nextItem);
  root.appendChild(list);
}

function renderLinks(root, pagination) {
  renderPaginationControls({
    root,
    pagination,
    selectors: LINK_SELECTORS,
    createPageControl: (item) => {
      if (item.type === "ellipsis") {
        return cloneTemplate(LINK_SELECTORS.ellipsisTemplate);
      }

      const element = cloneTemplate(LINK_SELECTORS.itemTemplate);
      const link = element.querySelector("a");
      const page = Number(item.value);

      if (item.isActive) element.setAttribute("aria-current", "page");
      link.dataset.collectionNavigationLink = "";
      link.href = buildPagePath(page);
      link.textContent = String(page);

      return element;
    },
    createIconControl: (direction, enabled, targetPage) => {
      const element = cloneTemplate(LINK_SELECTORS.iconTemplate);
      const link = element.querySelector("a");
      const icon = element.querySelector("i");

      element.dataset.disabled = String(!enabled);
      link.setAttribute("aria-disabled", String(!enabled));
      link.dataset.collectionNavigationLink = "";
      link.href = enabled ? buildPagePath(targetPage) : "#";
      icon.classList.toggle("fa-chevron-left", direction === "prev");
      icon.classList.toggle("fa-chevron-right", direction === "next");

      return element;
    },
  });
}

function renderButtons(root, pagination) {
  renderPaginationControls({
    root,
    pagination,
    selectors: BUTTON_SELECTORS,
    createPageControl: (item) => {
      if (item.type === "ellipsis") {
        return cloneTemplate(BUTTON_SELECTORS.ellipsisTemplate);
      }

      const element = cloneTemplate(BUTTON_SELECTORS.itemTemplate);
      const button = element.querySelector("button");
      const page = Number(item.value);

      if (item.isActive) element.setAttribute("aria-current", "page");
      button.dataset.paginationPage = String(page);
      button.textContent = String(page);
      button.disabled = Boolean(item.isActive);

      return element;
    },
    createIconControl: (direction, enabled, targetPage) => {
      const element = cloneTemplate(BUTTON_SELECTORS.iconTemplate);
      const button = element.querySelector("button");
      const icon = element.querySelector("i");

      element.dataset.disabled = String(!enabled);
      button.dataset.paginationPage = String(targetPage);
      button.disabled = !enabled;
      icon.classList.toggle("fa-chevron-left", direction === "prev");
      icon.classList.toggle("fa-chevron-right", direction === "next");

      return element;
    },
  });
}

export { renderButtons, renderLinks };
