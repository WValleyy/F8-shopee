import { isAbortError, requestJson } from "../../../shared/api/http-client.js";
import {
  close as closeDialog,
  open as openDialog,
} from "../../../shared/ui/modal.js";

function mountPurchaseReturns({ root, refreshCollection, signal }) {
  function setError(modal, message = "") {
    const errorElement = modal.querySelector("[data-purchase-return-error]");

    errorElement.textContent = message;
    errorElement.hidden = !message;
  }

  function appendReturnItem(container, item) {
    const maxQuantity = Number(item.dataset.returnableQuantity);

    if (maxQuantity < 1) return;

    const row = document.createElement("label");
    const checkbox = document.createElement("input");
    const image = document.createElement("img");
    const content = document.createElement("span");
    const name = document.createElement("strong");
    const classify = document.createElement("span");
    const available = document.createElement("span");
    const quantity = document.createElement("input");

    row.className = "purchase-return-item";
    checkbox.type = "checkbox";
    checkbox.name = "selectedVariant";
    checkbox.value = item.dataset.variantId;
    checkbox.className = "purchase-return-item__checkbox";
    image.src = item.dataset.productImage;
    image.alt = item.dataset.productName;
    image.className = "purchase-return-item__image";
    content.className = "purchase-return-item__content";
    name.textContent = item.dataset.productName;
    classify.textContent = `Phân loại: ${item.dataset.productClassify}`;
    available.textContent = `Có thể trả: ${maxQuantity}`;
    quantity.type = "number";
    quantity.name = `quantity:${checkbox.value}`;
    quantity.min = "1";
    quantity.max = String(maxQuantity);
    quantity.step = "1";
    quantity.value = "1";
    quantity.disabled = true;
    quantity.className = "form-control purchase-return-item__quantity";

    content.append(name, classify, available);
    checkbox.addEventListener(
      "change",
      () => {
        quantity.disabled = !checkbox.checked;

        if (checkbox.checked) quantity.focus();
      },
      { signal },
    );
    row.append(checkbox, image, content, quantity);
    container.append(row);
  }

  function openReturnModal(card, opener) {
    const modal = root.querySelector("#purchase-return-modal");
    const form = modal.querySelector("#purchase-return-form");
    const itemContainer = modal.querySelector("[data-purchase-return-items]");

    if (modal.dataset.returnResultUnknown === "true") {
      openDialog(modal, { opener });
      return;
    }

    form.reset();
    form.querySelector("[data-purchase-return-submit]").disabled = false;
    form.querySelector("[data-purchase-return-reload]").hidden = true;
    form.elements.orderId.value = card.dataset.orderId;
    itemContainer.replaceChildren();
    card.querySelectorAll("[data-order-item]").forEach((item) => {
      appendReturnItem(itemContainer, item);
    });
    setError(modal);
    openDialog(modal, { opener });
  }

  root.addEventListener(
    "click",
    (event) => {
      if (event.target.closest("[data-purchase-return-reload]")) {
        window.location.reload();
        return;
      }

      const button = event.target.closest('[data-order-action="return"]');

      if (!button) return;

      event.preventDefault();
      openReturnModal(button.closest("[data-order-card]"), button);
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    async (event) => {
      const form = event.target.closest("#purchase-return-form");

      if (!form) return;

      event.preventDefault();

      const modal = form.closest("[data-modal]");
      const submitButton = form.querySelector("[data-purchase-return-submit]");
      const selectedItems = Array.from(
        form.querySelectorAll('input[name="selectedVariant"]:checked'),
      ).map((checkbox) => {
        const quantityInput = form.elements[`quantity:${checkbox.value}`];

        return {
          variantId: checkbox.value,
          quantity: Number(quantityInput.value),
          maxQuantity: Number(quantityInput.max),
        };
      });

      if (!selectedItems.length) {
        setError(modal, "Vui lòng chọn ít nhất một sản phẩm.");
        return;
      }

      if (
        selectedItems.some(
          (item) =>
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > item.maxQuantity,
        )
      ) {
        setError(modal, "Số lượng trả hàng không hợp lệ.");
        return;
      }

      setError(modal);
      submitButton.disabled = true;

      let resultIsUnknown = false;

      try {
        await requestJson(
          `/api/orders/${form.elements.orderId.value}/returns`,
          {
            method: "POST",
            body: {
              items: selectedItems.map((item) => ({
                variantId: item.variantId,
                quantity: item.quantity,
              })),
            },
            signal,
          },
        );
        closeDialog(modal);
        await refreshCollection();
      } catch (error) {
        if (isAbortError(error, signal)) return;

        const isClientError = error.status >= 400 && error.status < 500;

        if (isClientError) {
          setError(modal, error.message);
        } else {
          resultIsUnknown = true;
          modal.dataset.returnResultUnknown = "true";
          setError(
            modal,
            "Mất kết nối nên chưa thể xác nhận kết quả. " +
              "Vui lòng tải lại trang để kiểm tra trước khi gửi lại.",
          );
          form.querySelector("[data-purchase-return-reload]").hidden = false;
        }
      } finally {
        if (submitButton.isConnected && !resultIsUnknown)
          submitButton.disabled = false;
      }
    },
    { signal },
  );
}

export { mountPurchaseReturns };
