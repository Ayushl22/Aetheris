import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function useUnauthorized() {
  const { logout } = useAuth();

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("aetheris:unauthorized", handler);
    return () => window.removeEventListener("aetheris:unauthorized", handler);
  }, [logout]);
}