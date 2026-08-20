import { createPageNavigation } from "../../shared/navigation/page-navigation.js";
import { mountPaginatedCollection } from "../../shared/navigation/collection.js";
import { mountHeader } from "../../widgets/header/header.js";

const PAGE_LOADERS = Object.freeze({
  profile: () => import("./account/profile/profile.js"),
  address: () => import("./account/address/address.js"),
  password: () => import("./account/password/password.js"),
  privacy: () => import("./account/privacy/privacy.js"),
  purchase: () => import("./purchase/purchase.js"),
  notifications: () => import("./notification/notification.js"),
  wishlist: () => import("./wishlist/wishlist.js"),
});

function mountAccountCollection(content) {
  if (!content.querySelector("[data-collection-results]")) return null;

  const initialState = JSON.parse(
    content.querySelector("[data-page-initial-state]").textContent,
  );
  const collection = mountPaginatedCollection({
    root: content,
    initialPagination: initialState.pagination,
    afterRender: () => {
      content.dispatchEvent(new Event("account:collection-rendered"));
    },
  });

  collection.renderPagination();
  return collection;
}

function createAccountNavigation(root) {
  const content = root.querySelector("[data-page-content]");
  const sidebarLinks = [
    ...root.querySelectorAll("[data-user-link][data-section]"),
  ];

  return createPageNavigation({
    content,
    initialPage: document.body.dataset.currentPage,
    loaders: PAGE_LOADERS,
    mountPaginatedCollection: mountAccountCollection,
    applyPageState(payload) {
      const { currentPage, activeSection, title } = payload;

      document.body.dataset.currentPage = currentPage;
      document.body.dataset.activeSection = activeSection;
      document.title = title;

      sidebarLinks.forEach((link) => {
        const active = link.dataset.section === activeSection;
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    },
  });
}

function mountAccountPage() {
  const root = document.querySelector("[data-user-page]");
  const navigation = createAccountNavigation(root);

  mountHeader();
  void navigation.start();
}

mountAccountPage();
