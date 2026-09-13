const configuredApiUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    "http://localhost:3000";

export const API_URL = configuredApiUrl.replace(/\/$/, "");

export const SOCKET_URL =
    (import.meta.env.VITE_SOCKET_URL || API_URL).replace(/\/$/, "");