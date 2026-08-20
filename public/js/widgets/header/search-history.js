import { requestJson } from "../../shared/api/http-client.js";
import { isAuthenticated } from "../../features/auth/state.js";

const STORAGE_KEY = "f8-shopee.home-search-history";
const MAX_ITEMS = 6;

function normalizeSearchTerm(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 128);
}

function loadGuestHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    return Array.isArray(value)
      ? value.map(normalizeSearchTerm).filter(Boolean).slice(0, MAX_ITEMS)
      : [];
  } catch {
    return [];
  }
}

function saveGuestHistory(history) {
  const nextHistory = history
    .map(normalizeSearchTerm)
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

async function requestHistory(method, query = "") {
  const data = await requestJson("/api/search-history", {
    method,
    keepalive: method === "PUT",
    ...(query ? { body: { query } } : {}),
  });

  return data.history.map(normalizeSearchTerm).filter(Boolean);
}

async function loadSearchHistory() {
  return isAuthenticated() ? requestHistory("GET") : loadGuestHistory();
}

async function recordSearch(rawQuery) {
  const query = normalizeSearchTerm(rawQuery);

  if (!query) return loadSearchHistory();

  if (isAuthenticated()) return requestHistory("PUT", query);

  const normalizedQuery = query.toLocaleLowerCase("vi-VN");

  return saveGuestHistory([
    query,
    ...loadGuestHistory().filter(
      (item) => item.toLocaleLowerCase("vi-VN") !== normalizedQuery,
    ),
  ]);
}

async function removeSearch(rawQuery) {
  const query = normalizeSearchTerm(rawQuery);

  if (!query) return;

  if (isAuthenticated()) {
    await requestJson("/api/search-history", {
      method: "DELETE",
      body: { query },
    });
    return;
  }

  const normalizedQuery = query.toLocaleLowerCase("vi-VN");

  saveGuestHistory(
    loadGuestHistory().filter(
      (item) => item.toLocaleLowerCase("vi-VN") !== normalizedQuery,
    ),
  );
}

export { loadSearchHistory, normalizeSearchTerm, recordSearch, removeSearch };
