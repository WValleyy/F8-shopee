function formatPrice(value) {
  const amount = new Intl.NumberFormat("vi-VN").format(
    Math.max(0, Math.round(Number(value) || 0)),
  );

  return `${amount}đ`;
}

export { formatPrice };
