import { apiRequest, jsonBody } from "./api";

export const authService = {
  async login(email, password) {
    return apiRequest("/auth/login", {
      method: "POST",
      body: jsonBody({ email, password })
    });
  },

  async register(name, email, password) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: jsonBody({ name, email, password })
    });
  }
};