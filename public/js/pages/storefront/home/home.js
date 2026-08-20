import { mountPaginatedCollection } from "../../../shared/navigation/collection.js";
import { mountProductCardWishlist } from "../../../features/wishlist/product-card.js";
import { mountHeader } from "../../../widgets/header/header.js";
import { mountHomeNavigation } from "./navigation.js";
import { createHomePaths } from "./paths.js";
import { createHomeView } from "./view.js";

function mountHomePage() {
  const root = document.querySelector("[data-home-page]");

  mountHeader();
  const initialState = JSON.parse(
    root.querySelector("[data-page-initial-state]").textContent,
  );
  const paths = createHomePaths(initialState.sortGroups);
  const view = createHomeView(root, paths, initialState.sortGroups);
  const collection = mountPaginatedCollection({
    root,
    initialPagination: initialState.pagination,
    afterRender: (pagination, path) => {
      view.renderCatalogChrome(pagination, path);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  mountHomeNavigation({ root, collection, view });
  mountProductCardWishlist(root);
  collection.renderPagination();
}

mountHomePage();
