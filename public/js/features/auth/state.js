function isAuthenticated() {
  return document.body.dataset.authenticated === "true";
}

export { isAuthenticated };
