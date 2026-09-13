import { apiRequest, jsonBody } from "./api";

export const projectService = {
  list() {
    return apiRequest("/projects");
  },

  get(id) {
    return apiRequest(`/projects/${id}`);
  },

  create(name) {
    return apiRequest("/projects", {
      method: "POST",
      body: jsonBody({ name })
    });
  },

  remove(id) {
    return apiRequest(`/projects/${id}`, { method: "DELETE" });
  }
};