function formatCurrency(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));

  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

export { formatCurrency };
