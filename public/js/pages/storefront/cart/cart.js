import { mountHeader } from "../../../widgets/header/header.js";
import { mountCartActions } from "./actions.js";
import { createCartState } from "./state.js";
import { createCartView } from "./view.js";

function mountCartPage() {
  const root = document.querySelector("[data-cart-page]");

  mountHeader();

  if (!root.querySelector("[data-cart-item][data-variant-id]")) return;

  const state = createCartState(root);
  const view = createCartView(root, state);
  mountCartActions({ root, state, view });
}



mountCartPage();
