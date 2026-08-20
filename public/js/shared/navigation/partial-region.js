import { authFetch } from "../api/http-client.js";
import { exitForNavigation } from "../ui/modal.js";
import { normalizePath } from "./path.js";

const pendingNavigationControllers = new Set();
let navigationGeneration = 0;

async function fetchPartialPayload(path, signal, target) {
  const response = await authFetch(path, {
    headers: { "X-Partial-Target": target },
    signal,
  });

  if (response.status === 401) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : {};
    const error = new Error(payload.message || "Authentication required.");

    error.name = "PartialAuthenticationError";
    error.redirectTo = payload.redirectTo || "/";
    throw error;
  }

  if (!response.ok) {
    throw new Error("Failed to load partial content.");
  }

  return response.json();
}

function cancelPendingNavigations() {
  navigationGeneration += 1;
  pendingNavigationControllers.forEach((controller) => controller.abort());
  pendingNavigationControllers.clear();
}

function createPartialRegion({
  target,
  beforeReplace,
  replaceHtml,
  afterRender,
}) {
  let currentPath = normalizePath();
  let activeController = null;

  async function applyPayload(payload, path) {
    await beforeReplace?.(payload, path);
    await replaceHtml(payload.html);
    await afterRender(payload, path);
  }

  async function load(path, pushState = true) {
    // Public callers must pass a canonical same-origin pathname and search string.
    const isNavigation = pushState;

    if (isNavigation) await exitForNavigation();

    const requestGeneration = navigationGeneration;

    activeController?.abort();
    activeController = new AbortController();
    const requestController = activeController;

    if (isNavigation) pendingNavigationControllers.add(requestController);

    try {
      const payload = await fetchPartialPayload(
        path,
        requestController.signal,
        target,
      );

      if (isNavigation && requestGeneration !== navigationGeneration)
        return false;

      currentPath = path;

      if (isNavigation) {
        history.pushState(null, "", path);
      }

      await applyPayload(payload, path);
      return true;
    } catch (error) {
      if (error.name === "AbortError") {
        return false;
      }

      if (error.name === "PartialAuthenticationError") {
        window.location.assign(error.redirectTo);
        return false;
      }

      console.error(error);
      window.location.assign(path);
      return false;
    } finally {
      if (isNavigation) pendingNavigationControllers.delete(requestController);

      if (activeController === requestController) activeController = null;
    }
  }

  function refresh() {
    return load(currentPath, false);
  }

  async function syncFromLocation(path) {
    if (path === currentPath) return false;

    return load(path, false);
  }

  return {
    load,
    refresh,
    syncFromLocation,
    cancel: () => activeController?.abort(),
    getPath: () => currentPath,
  };
}

document.addEventListener(
  "partial-navigation:cancel",
  cancelPendingNavigations,
);

export { cancelPendingNavigations, createPartialRegion };
