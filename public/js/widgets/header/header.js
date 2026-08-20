import { mountAuth } from "../../features/auth/auth.js";
import {
  mountHeaderNotifications,
  renderHeaderNotificationPreview,
} from "./notifications.js";
import { renderHeaderCartPreview } from "./cart-preview.js";
import { mountHeaderSearch } from "./search.js";

function mountHeader() {
  const initialState = JSON.parse(
    document.querySelector("[data-header-state]").textContent,
  );

  if (document.querySelector("[data-header-cart-preview]"))
    renderHeaderCartPreview(initialState.cartPreview);

  renderHeaderNotificationPreview(initialState.notificationPreview);

  mountAuth();

  if (document.querySelector("[data-header-search]")) mountHeaderSearch();

  mountHeaderNotifications();
}

export { mountHeader };
