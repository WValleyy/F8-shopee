const PURCHASE_PATH = "/user/purchase";

function createPurchasePaths() {
  function read(path) {
    const url = new URL(path, window.location.origin);

    return {
      tab: url.searchParams.get("tab") || "all",
      query: url.searchParams.get("q") || "",
    };
  }

  function toPath({ tab, query, page }) {
    const params = new URLSearchParams();

    if (tab && tab !== "all") params.set("tab", tab);
    if (query) params.set("q", query);
    if (Number(page) > 1) params.set("page", String(page));

    const queryString = params.toString();

    return queryString ? `${PURCHASE_PATH}?${queryString}` : PURCHASE_PATH;
  }

  function tab(path, nextTab) {
    const { query } = read(path);

    return toPath({ tab: nextTab, query, page: 1 });
  }

  function query(path, nextQuery) {
    const { tab } = read(path);

    return toPath({
      tab,
      query: String(nextQuery || "").trim(),
      page: 1,
    });
  }

  return { query, read, tab };
}

export { createPurchasePaths };
