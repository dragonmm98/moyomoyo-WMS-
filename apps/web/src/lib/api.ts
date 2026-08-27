import { API_URL } from "./api-url";

export const ACCESS_TOKEN_KEY = "wms_access_token";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = typeof input === "string" && input.startsWith("/") && !input.startsWith("/wms-data")
    ? `${API_URL}${input}`
    : input;
  return fetch(url, { ...init, credentials: "include", headers });
}
