const REFRESH_PATH = "/api/auth/session/refresh";

function createAuthFetch({ origin }) {
  let refreshPromise = null;

  async function readErrorCode(response) {
    if (response.status !== 401) return "";

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) return "";

    try {
      const payload = await response.clone().json();
      return payload.code || "";
    } catch {
      return "";
    }
  }

  function refreshSessionOnce() {
    if (!refreshPromise) {
      refreshPromise = fetch(REFRESH_PATH, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
        .then((response) => {
          if (!response.ok) {
            const error = new Error("Session refresh failed.");
            error.name = "SessionRefreshError";
            throw error;
          }

          return response;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  }

  async function fetchWithAuth(input, init = {}) {
    const response = await fetch(input, init);

    const requestUrl = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
      origin,
    );

    if (requestUrl.origin !== origin || requestUrl.pathname === REFRESH_PATH)
      return response;

    const errorCode = await readErrorCode(response);

    if (
      errorCode !== "ACCESS_TOKEN_EXPIRED" &&
      errorCode !== "ACCESS_TOKEN_MISSING"
    ) {
      return response;
    }

    try {
      await refreshSessionOnce();
    } catch {
      window.location.assign("/");
      return response;
    }

    return fetch(input, init);
  }

  return fetchWithAuth;
}

const authFetch = createAuthFetch({
  origin: window.location.origin,
});

function createRequestError(response, payload) {
  const error = new Error(payload?.message || "Không thể hoàn tất yêu cầu.");

  error.status = response.status;
  error.code = payload?.code || "";
  error.meta = payload?.meta || null;
  error.retryAfter = Number(response.headers.get("Retry-After")) || 0;
  return error;
}

async function requestPayload(url, options = {}) {
  const {
    body: rawBody,
    headers: optionHeaders = {},
    ...requestOptions
  } = options;
  const isFormData = rawBody instanceof FormData;
  const hasJsonBody =
    rawBody != null && !isFormData && typeof rawBody !== "string";
  const body = hasJsonBody ? JSON.stringify(rawBody) : rawBody;
  const response = await authFetch(url, {
    credentials: "same-origin",
    ...requestOptions,
    ...(body == null ? {} : { body }),
    headers: {
      Accept: "application/json",
      ...(body != null && !isFormData
        ? { "Content-Type": "application/json" }
        : {}),
      ...optionHeaders,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) throw createRequestError(response, payload);

  return payload;
}

async function requestJson(url, options = {}) {
  const payload = await requestPayload(url, options);
  return payload.data;
}

function isAbortError(error, signal) {
  return signal?.aborted || error?.name === "AbortError";
}

export {
  createAuthFetch,
  isAbortError,
  requestPayload,
  requestJson,
};
