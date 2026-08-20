import mongoose from "mongoose";

import Order from "../../../models/commerce/order.model.js";
import { requestError } from "../../../utils/error/app-error.js";
import { logAppEvent } from "../../../utils/error/app-error-logger.js";
import { createNotification } from "../../user/notification.service.js";
import { restoreOrderInventory } from "./order-restoration.service.js";
import { getOrderTransition } from "./order-policy.js";

async function transitionOrderStatus(userId, orderId, action) {
  return transitionOrderStatusBySelector(
    {
      _id: orderId,
      user: userId,
    },
    action,
    "USER",
    "ORDER_STATUS_UPDATE_FAILED",
  );
}

async function transitionOrderStatusAsAdmin(orderId, action) {
  return transitionOrderStatusBySelector(
    {
      _id: orderId,
      user: { $ne: null },
    },
    action,
    "ADMIN",
    "ADMIN_ORDER_TRANSITION_INVALID",
  );
}

async function transitionOrderStatusBySelector(
  selector,
  action,
  actor,
  errorCode,
) {
  const transition = getOrderTransition(action, actor);

  if (!selector._id || !transition) throw requestError(errorCode);

  const session = await mongoose.startSession();
  let completedOrder = null;

  try {
    completedOrder = await session.withTransaction(async () => {
      const order = await Order.findOne(selector).session(session);

      if (!order || !transition.fromStatuses.includes(order.status))
        throw requestError(errorCode);

      const now = new Date();

      order.status = transition.toStatus;

      if (action === "complete") order.completedAt = now;

      if (action === "cancel") {
        order.cancellationReason =
          actor === "ADMIN" ? "ADMIN_CANCELLED" : "USER_CANCELLED";
      }

      // Establish an early write conflict before related documents mutate.
      await order.save({ session });

      if (action === "cancel") await restoreOrderInventory(order, session);

      return action === "complete" ? { id: order._id, user: order.user } : null;
    });
  } finally {
    await session.endSession();
  }

  if (completedOrder) {
    await createNotification(completedOrder.user, {
      type: "ORDER_COMPLETED",
      title: "Đơn hàng đã hoàn thành",
      description:
        `Đơn hàng #${completedOrder.id.toString().slice(-8).toUpperCase()} ` +
        "của bạn đã được giao thành công.",
    }).catch((error) =>
      logAppEvent(
        "commerce-store:order-completed-notification-failed",
        "warning",
        {
          orderId: completedOrder.id.toString(),
          userId: completedOrder.user.toString(),
          error: error?.message || String(error),
        },
      ),
    );
  }

  return completedOrder;
}

export { transitionOrderStatus, transitionOrderStatusAsAdmin };
