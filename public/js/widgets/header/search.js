import { requestJson } from "../../shared/api/http-client.js";
import { formatPrice } from "../../shared/lib/format-price.js";
import {
  loadSearchHistory,
  normalizeSearchTerm,
  recordSearch,
  removeSearch,
} from "./search-history.js";

function defaultBuildPath(form, term) {
  const url = new URL(form.action);
  const currentUrl = new URL(window.location.href);
  const category = currentUrl.searchParams.get("category");

  if (term) url.searchParams.set("q", term);

  if (category) url.searchParams.set("category", category);

  return `${url.pathname}${url.search}`;
}

function cloneTemplate(root, selector) {
  const template = root.querySelector(selector);
  return template.content.cloneNode(true);
}

function renderSuggestions(list, suggestions) {
  const root = list.closest("[data-header-search-root]");

  list.replaceChildren();

  if (!suggestions.length) {
    const empty = cloneTemplate(root, "[data-search-empty-template]");
    list.append(empty);
    return;
  }

  suggestions.forEach((suggestion) => {
    const fragment = cloneTemplate(root, "[data-search-suggestion-template]");
    const link = fragment.querySelector("[data-search-suggestion-link]");
    const image = fragment.querySelector("[data-search-suggestion-image]");

    link.href = `/product/${encodeURIComponent(suggestion.slug)}`;
    image.src = suggestion.image;
    fragment.querySelector("[data-search-suggestion-name]").textContent =
      suggestion.name;
    fragment.querySelector("[data-search-suggestion-price]").textContent =
      formatPrice(suggestion.price);
    list.append(fragment);
  });
}

function renderHistory(list, terms, buildPath) {
  const root = list.closest("[data-header-search-root]");

  list.replaceChildren();
  terms.forEach((term) => {
    const fragment = cloneTemplate(root, "[data-search-history-item-template]");
    const link = fragment.querySelector("[data-search-history-link]");
    const removeButton = fragment.querySelector("[data-search-history-remove]");

    link.href = buildPath(term);
    link.textContent = term;
    removeButton.dataset.term = term;
    list.append(fragment);
  });
}

function mountHeaderSearch() {
  const root = document.querySelector("[data-header-search-root]");
  const form = root.querySelector("[data-header-search]");
  const input = root.querySelector("[data-header-search-input]");
  const resultsBox = root.querySelector("[data-search-results]");
  const historyContent = root.querySelector("[data-search-history]");
  const historyList = root.querySelector("[data-search-history-list]");
  const suggestionsPanel = root.querySelector("[data-search-suggestions]");
  const suggestionsList = root.querySelector("[data-search-suggestions-list]");

  const buildPath = (term) => defaultBuildPath(form, term);
  let debounceTimer = null;
  let requestController = null;

  function setExpanded(expanded) {
    resultsBox.hidden = !expanded;
  }

  function showHistory() {
    suggestionsPanel.hidden = true;
    historyContent.hidden = false;
    setExpanded(historyList.children.length > 0);
  }

  async function refreshHistory() {
    try {
      renderHistory(historyList, await loadSearchHistory(), buildPath);
    } catch (error) {
      console.error(error);
      renderHistory(historyList, [], buildPath);
    }
  }

  async function loadSuggestions() {
    const query = normalizeSearchTerm(input.value);
    if (query.length < 2) {
      requestController?.abort();
      showHistory();
      return;
    }

    requestController?.abort();
    requestController = new AbortController();

    try {
      const url = new URL(
        "/api/catalog/search-suggestions",
        window.location.origin,
      );
      url.searchParams.set("q", query);
      const data = await requestJson(url, {
        signal: requestController.signal,
      });
      if (normalizeSearchTerm(input.value) !== query) return;

      renderSuggestions(suggestionsList, data.suggestions);
      historyContent.hidden = true;
      suggestionsPanel.hidden = false;
      setExpanded(true);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
        setExpanded(false);
      }
    }
  }

  function scheduleSuggestions(immediate = false) {
    window.clearTimeout(debounceTimer);
    if (normalizeSearchTerm(input.value).length < 2) {
      void loadSuggestions();
      return;
    }
    debounceTimer = window.setTimeout(loadSuggestions, immediate ? 0 : 250);
  }

  input.addEventListener("input", () => scheduleSuggestions());
  input.addEventListener("focus", () => scheduleSuggestions(true));
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-header-search-root]")) setExpanded(false);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = normalizeSearchTerm(input.value);
    if (query) recordSearch(query).catch((error) => console.error(error));
    window.location.assign(buildPath(query));
  });
  historyList.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-search-history-remove]");

    if (!removeButton) return;

    event.preventDefault();
    event.stopPropagation();
    const item = removeButton.closest("[data-search-history-item]");
    const nextSibling = item.nextSibling;

    item.remove();
    setExpanded(historyList.children.length > 0);

    try {
      await removeSearch(removeButton.dataset.term);
    } catch (error) {
      historyList.insertBefore(item, nextSibling);
      setExpanded(true);
      console.error(error);
    }
  });

  const url = new URL(window.location.href);
  input.value = url.searchParams.get("q") ?? "";
  void refreshHistory();
}

export { mountHeaderSearch };
