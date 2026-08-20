import { requestJson } from "../../shared/api/http-client.js";

function mountHeaderNotifications() {
  document.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-notification-link]");

    if (!link) return;

    event.preventDefault();
    const notificationId = link.dataset.notificationId;
    const href = link.getAttribute("href");

    if (notificationId) {
      try {
        const data = await requestJson(
          `/api/notifications/${notificationId}/read`,
          { method: "PATCH" },
        );
        renderHeaderNotificationPreview(data.notificationPreview);
      } catch {
        // Navigation remains available if marking the item fails.
      }
    }

    if (!href) return;

    window.location.assign(href);
  });
}

function renderHeaderNotificationPreview(preview) {
  const root = document.querySelector("[data-header-notification-preview]");

  if (!root || !preview) return;

  const unreadCount = preview.unreadCount;
  const items = preview.items;
  const notice = root.querySelector("[data-notification-preview-notice]");
  const list = root.querySelector("[data-notification-preview-list]");
  const emptyState = root.querySelector("[data-notification-preview-empty]");
  const itemList = root.querySelector("[data-notification-preview-items]");
  const itemTemplate = root.querySelector(
    "[data-notification-preview-item-template]",
  );
  notice.textContent = String(unreadCount);
  notice.hidden = unreadCount === 0;
  list.hidden = false;
  emptyState.hidden = items.length > 0;
  itemList.hidden = items.length === 0;
  itemList.replaceChildren();

  items.forEach((item) => {
    const fragment = itemTemplate.content.cloneNode(true);
    const element = fragment.querySelector("[data-notification-preview-item]");
    const link = fragment.querySelector("[data-notification-link]");

    element.dataset.unread = String(!item.readAt);
    link.href = getNotificationUrl(item.type);
    link.dataset.notificationId = item.id;
    fragment.querySelector("[data-notification-preview-title]").textContent =
      item.title;
    fragment.querySelector(
      "[data-notification-preview-description]",
    ).textContent = item.description;
    itemList.append(fragment);
  });
}

function getNotificationUrl(type) {
  if (type === "EMAIL_VERIFICATION_REQUIRED") return "/user/account/profile";

  if (type === "ORDER_COMPLETED") return "/user/purchase";

  return "/user/notifications";
}

export { mountHeaderNotifications, renderHeaderNotificationPreview };
