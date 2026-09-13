export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function statusClass(status = "") {
  return `status status-${String(status).toLowerCase()}`;
}

export function priorityLabel(priority) {
  if (priority === 1) return "HIGH";
  if (priority === 10) return "LOW";
  return "MEDIUM";
}

export function safeJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}