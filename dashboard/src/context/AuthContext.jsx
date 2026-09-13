import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/auth.service";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem("aetheris_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem("aetheris_user");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("aetheris_token"));
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("aetheris_token");
    localStorage.removeItem("aetheris_user");
    localStorage.removeItem("aetheris_project_id");
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("aetheris_token");

    if (!storedToken) {
      setLoading(false);
      return;
    }

    const decoded = decodeJwt(storedToken);
    if (!decoded?.userId || !decoded?.email || !decoded?.exp || decoded.exp * 1000 <= Date.now()) {
      logout();
      setLoading(false);
      return;
    }

    setToken(storedToken);
    const nextUser = { userId: decoded.userId, email: decoded.email };
    setUser(nextUser);
    localStorage.setItem("aetheris_user", JSON.stringify(nextUser));
    setLoading(false);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      throw new Error("Email and password are required.");
    }

    setLoading(true);
    try {
      const result = await authService.login(normalizedEmail, password);

      if (!result?.token || typeof result.token !== "string") {
        throw new Error("Authentication response did not include a valid token.");
      }

      const decoded = decodeJwt(result.token);
      if (!decoded?.userId || !decoded?.email) {
        throw new Error("The server returned an invalid authentication token.");
      }

      const nextUser = { userId: decoded.userId, email: decoded.email };
      localStorage.setItem("aetheris_token", result.token);
      localStorage.setItem("aetheris_user", JSON.stringify(nextUser));
      setToken(result.token);
      setUser(nextUser);

      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    if (!normalizedName || !normalizedEmail || !password) {
      throw new Error("Name, email and password are required.");
    }

    setLoading(true);
    try {
      await authService.register(normalizedName, normalizedEmail, password);

      // The backend registration endpoint intentionally returns only the
      // created user, not a JWT. Log in immediately so the user goes straight
      // to the dashboard after creating an account.
      const result = await authService.login(normalizedEmail, password);

      if (!result?.token || typeof result.token !== "string") {
        throw new Error("Account was created, but automatic login failed.");
      }

      const decoded = decodeJwt(result.token);
      if (!decoded?.userId || !decoded?.email) {
        throw new Error("The server returned an invalid authentication token.");
      }

      const nextUser = { userId: decoded.userId, email: decoded.email };
      localStorage.setItem("aetheris_token", result.token);
      localStorage.setItem("aetheris_user", JSON.stringify(nextUser));
      setToken(result.token);
      setUser(nextUser);

      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout
    }),
    [token, user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
