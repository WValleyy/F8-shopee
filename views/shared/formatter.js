const VIEW_TIME_ZONE = "Asia/Ho_Chi_Minh";

function formatCurrency(value) {
  const amount = new Intl.NumberFormat("vi-VN").format(Number(value || 0));

  return `${amount}đ`;
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VIEW_TIME_ZONE,
  }).format(new Date(value));
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIEW_TIME_ZONE,
  }).format(new Date(value));
}

export { formatCurrency, formatDate, formatDateOnly };
