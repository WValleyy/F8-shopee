function getNotificationUrl(type) {
  if (type === "EMAIL_VERIFICATION_REQUIRED") return "/user/account/profile";

  if (type === "ORDER_COMPLETED") return "/user/purchase";

  return "/user/notifications";
}

export { getNotificationUrl };
