import { requestJson } from "../../shared/api/http-client.js";

function saveAddress(addressId, input, options = {}) {
  return requestJson(
    addressId
      ? `/api/account/addresses/${addressId}`
      : "/api/account/addresses",
    {
      method: addressId ? "PATCH" : "POST",
      body: input,
      ...options,
    },
  );
}

function removeAddress(addressId, options = {}) {
  return requestJson(`/api/account/addresses/${addressId}`, {
    method: "DELETE",
    ...options,
  });
}

function makeAddressDefault(addressId, options = {}) {
  return requestJson(`/api/account/addresses/${addressId}/default`, {
    method: "PATCH",
    ...options,
  });
}

export { makeAddressDefault, removeAddress, saveAddress };
