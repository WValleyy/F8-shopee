import { mountOrderActions } from "./actions.js";

function mount({ root, collection, signal }) {
  mountOrderActions({
    root,
    refreshCollection: collection.refresh,
    signal,
  });
}

export { mount };
