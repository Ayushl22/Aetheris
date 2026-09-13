import { apiRequest, jsonBody } from "./api";

const priorityMap = {
  HIGH: 1,
  MEDIUM: 5,
  LOW: 10
};

function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `aetheris-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const jobService = {
  list() {
    return apiRequest("/jobs");
  },

  get(id) {
    return apiRequest(`/jobs/${id}`);
  },

  failed() {
    return apiRequest("/jobs/failed");
  },

  create({ projectId, type, data, priority }) {
    return apiRequest("/jobs", {
      method: "POST",
      body: jsonBody({
        projectId,
        type,
        data,
        priority
      })
    });
  },

  createDelayed({ projectId, type, data, priority, delay }) {
    return apiRequest("/jobs/delayed", {
      method: "POST",
      body: jsonBody({
        projectId,
        type,
        data,
        priority: priorityMap[priority] ?? 5,
        delay
      })
    });
  },

  createRecurring({ projectId, type, data, every }) {
    return apiRequest("/jobs/recurring", {
      method: "POST",
      body: jsonBody({
        projectId,
        type,
        data,
        every
      })
    });
  },

  retry(id) {
    return apiRequest(`/jobs/failed/${id}/retry`, {
      method: "POST"
    });
  },

  cancel(id) {
    return apiRequest(`/jobs/${id}`, {
      method: "DELETE"
    });
  },

  pauseQueue() {
    return apiRequest("/jobs/pause", { method: "POST" });
  },

  resumeQueue() {
    return apiRequest("/jobs/resume", { method: "POST" });
  },

  createApiJob({ apiKey, type, data, priority, idempotencyKey = generateIdempotencyKey() }) {
    return apiRequest("/api/v1/jobs", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Idempotency-Key": idempotencyKey
      },
      body: jsonBody({ type, data, priority })
    });
  }
};