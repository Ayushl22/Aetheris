import { API_URL } from "../config";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("aetheris_token");
  const headers = new Headers(options.headers || {});

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch {
    throw new Error(
      `Cannot reach Aetheris backend at ${API_URL}. Make sure the backend is running on port 3000.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let body;

  try {
    body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const isAuthEndpoint =
      path === "/auth/login" || path === "/auth/register";

    if (
      response.status === 401 &&
      !isAuthEndpoint &&
      localStorage.getItem("aetheris_token")
    ) {
      window.dispatchEvent(new Event("aetheris:unauthorized"));
    }

    const message =
      typeof body === "object" && body?.message
        ? body.message
        : typeof body === "string" && body.trim()
          ? body
          : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return body;
}

export function jsonBody(value) {
  return JSON.stringify(value);
}
