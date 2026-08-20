function createCheckoutSubmitState(root) {
  const submitButton = root.querySelector("[data-checkout-submit]");
  const selectedAddressInput = root.querySelector('[name="selectedAddressId"]');
  let hasAddress = Boolean(selectedAddressInput?.value);
  let orderPending = false;

  function sync() {
    if (submitButton) submitButton.disabled = orderPending || !hasAddress;
  }

  return {
    isOrderPending() {
      return orderPending;
    },
    setHasAddress(value) {
      hasAddress = Boolean(value);
      sync();
    },
    setOrderPending(value) {
      orderPending = Boolean(value);
      sync();
    },
    sync,
  };
}

export { createCheckoutSubmitState };
