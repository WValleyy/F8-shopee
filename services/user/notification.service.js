import paginationConfig from "../../config/pagination.js";
import UserNotification from "../../models/user/notification.model.js";
import { requestError } from "../../utils/error/app-error.js";
import { buildPagination } from "../../utils/pagination.js";

async function getNotificationPreview(userId) {
  const [notifications, unreadCount] = await Promise.all([
    UserNotification.find({ user: userId })
      .select("type title description readAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .lean(),
    UserNotification.countDocuments({
      user: userId,
      readAt: null,
    }),
  ]);

  return {
    unreadCount,
    items: notifications.map(toNotificationPreviewItem),
  };
}

async function listNotificationsPage(userId, options) {
  const { page } = options;
  const limit = paginationConfig.notifications;

  const totalItems = await UserNotification.countDocuments({ user: userId });
  const pagination = buildPagination({
    page,
    limit,
    totalItems,
  });

  const notifications = await UserNotification.find({ user: userId })
    .select("type title description readAt createdAt")
    .sort({ createdAt: -1, _id: -1 })
    .skip((pagination.page - 1) * limit)
    .limit(limit)
    .lean();
  const unreadCount = await UserNotification.countDocuments({
    user: userId,
    readAt: null,
  });

  return {
    notifications: notifications.map((notification) => ({
      ...toNotificationPreviewItem(notification),
      createdAt: notification.createdAt,
    })),
    unreadNotificationCount: unreadCount,
    pagination,
  };
}

async function createNotification(
  userId,
  { type, title, description },
  { session } = {},
) {
  await UserNotification.create(
    [
      {
        user: userId,
        type,
        title,
        description,
      },
    ],
    session ? { session } : undefined,
  );
}

async function markNotificationAsRead(userId, notificationId) {
  const result = await UserNotification.updateOne(
    {
      _id: notificationId,
      user: userId,
    },
    [
      {
        $set: {
          readAt: {
            $ifNull: ["$readAt", "$$NOW"],
          },
        },
      },
    ],
    { updatePipeline: true },
  );

  if (result.matchedCount !== 1) throw requestError("NOTIFICATION_NOT_FOUND");
}

async function markAllNotificationsAsRead(userId) {
  await UserNotification.updateMany(
    {
      user: userId,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
  );
}

function toNotificationPreviewItem(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    description: notification.description,
    readAt: notification.readAt,
  };
}

export {
  getNotificationPreview,
  createNotification,
  listNotificationsPage,
  markAllNotificationsAsRead,
  markNotificationAsRead,
};
