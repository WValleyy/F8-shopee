import { mountHeader } from "../../../widgets/header/header.js";
import { mountCheckoutOrder } from "./order.js";
import { mountAddressSelection } from "./address.js";
import { createCheckoutSubmitState } from "./submit-state.js";

function mountCheckoutPage() {
  const root = document.querySelector("[data-checkout-page]");
  const submitState = createCheckoutSubmitState(root);

  mountHeader();
  mountCheckoutOrder(root, submitState);
  mountAddressSelection(root, submitState);
  submitState.sync();
}

mountCheckoutPage();
