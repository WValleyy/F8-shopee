import { createPartialRegion } from "./partial-region.js";
import { normalizePath } from "./path.js";
import { isPlainLeftClick } from "./link.js";
import { closeWithin, isModalState } from "../ui/modal.js";

const NOOP = () => {};

function createPageNavigation({
  content,
  initialPage,
  loaders,
  mountPaginatedCollection,
  applyPageState,
}) {
  // State shared by the current page navigation lifecycle.
  let collection = null;
  let cleanupPage = NOOP;
  let generation = 0;
  let pageRegion = null;
  let pageController = null;
  let renderedPathname = window.location.pathname;

  // Lifecycle
  async function start() {
    pageRegion = createPageRegion();
    document.addEventListener("click", handlePageNavigationClick);
    window.addEventListener("popstate", handlePopState);
    await activatePage(initialPage);
  }

  function destroyPage() {
    generation += 1;
    pageController?.abort();
    pageController = null;
    cleanupPage();
    cleanupPage = NOOP;
    collection?.destroy();
    collection = null;
  }

  // Event handlers
  function handlePageNavigationClick(event) {
    if (event.defaultPrevented) return;

    const link = event.target.closest("a[data-page-navigation-link][href]");

    if (!link || !isPlainLeftClick(event)) return;

    event.preventDefault();

    if (link.getAttribute("href") !== "#")
      void pageRegion.load(normalizePath(link.href));
  }

  async function handlePopState(event) {
    if (isModalState(event.state)) return;

    const path = normalizePath();

    if (window.location.pathname === renderedPathname && collection) {
      await collection.syncFromLocation(path);
      return;
    }

    if (path !== pageRegion.getPath()) await pageRegion.load(path, false);
  }

  // Page region
  function createPageRegion() {
    return createPartialRegion({
      target: "page",
      beforeReplace: () => {
        closeWithin(content);
        destroyPage();
      },
      replaceHtml: (html) => {
        content.innerHTML = html;
      },
      afterRender: async (payload, path) => {
        renderedPathname = new URL(path, window.location.origin).pathname;
        applyPageState(payload);
        await activatePage(payload.currentPage);
      },
    });
  }

  // Page module activation
  async function activatePage(page) {
    const currentGeneration = ++generation;
    pageController?.abort();
    const controller = new AbortController();
    pageController = controller;
    cleanupPage();
    cleanupPage = NOOP;
    collection?.destroy();
    collection = mountPaginatedCollection(content);

    const loader = loaders[page];
    const pageModule = loader ? await loader() : null;

    if (currentGeneration !== generation) return;

    const cleanup = pageModule
      ? // Every page module shares this lifecycle signal. Navigation aborts
        // it before replacing the page content or mounting another page.
        await pageModule.mount({
          root: content,
          collection,
          loadPage: pageRegion.load,
          refreshPage: pageRegion.refresh,
          signal: controller.signal,
        })
      : NOOP;

    if (currentGeneration !== generation || controller.signal.aborted) {
      cleanup?.();
      return;
    }

    // Some pages only register listeners, which are removed by signal.abort().
    // They may return undefined, so normalize the cleanup value before it is
    // called during the next navigation.
    cleanupPage = cleanup ?? NOOP;
  }

  // Public API
  return {
    start,
  };
}

export { createPageNavigation };
