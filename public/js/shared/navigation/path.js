function normalizePath(
  path = `${window.location.pathname}${window.location.search}`,
) {
  const url = new URL(path, window.location.origin);

  if (url.origin !== window.location.origin) {
    throw new Error("Navigation only supports same-origin URLs.");
  }

  return `${url.pathname}${url.search}`;
}

export { normalizePath };
