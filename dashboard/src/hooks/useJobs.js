import { useCallback, useEffect, useRef, useState } from "react";
import { jobService } from "../services/job.service";

const ACTIVE_STATUSES = new Set([
  "QUEUED",
  "WAITING",
  "DELAYED",
  "PROCESSING",
  "ACTIVE"
]);

export function useJobs(enabled) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  const loadJobs = useCallback(async () => {
    if (!enabled || requestInFlight.current) return;

    requestInFlight.current = true;
    setLoading((current) => (jobs.length === 0 ? true : current));
    setError("");

    try {
      const result = await jobService.list();
      setJobs(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || "Failed to load jobs.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [enabled, jobs.length]);

  // Initial load.
  useEffect(() => {
    if (!enabled) return;
    loadJobs();
  }, [enabled, loadJobs]);

  // Poll while there is work that can still change state.
  // Socket.IO gives immediate updates; polling is the reliability fallback
  // so a missed Pub/Sub/socket event can never leave the table stale.
  useEffect(() => {
    if (!enabled) return;

    const hasActiveJobs = jobs.some((job) =>
      ACTIVE_STATUSES.has(String(job.status || "").toUpperCase())
    );

    if (!hasActiveJobs) return;

    const timer = setInterval(() => {
      loadJobs();
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, jobs, loadJobs]);

  const applyEvent = useCallback((event) => {
    if (!event?.jobId) return;

    setJobs((current) => {
      const index = current.findIndex(
        (job) =>
          String(job.bullmq_job_id) === String(event.jobId) ||
          String(job.id) === String(event.databaseJobId)
      );

      if (index === -1) return current;

      const next = [...current];
      next[index] = {
        ...next[index],
        status: event.status || next[index].status,
        error: event.error ?? next[index].error
      };
      return next;
    });
  }, []);

  return { jobs, setJobs, loading, error, reload: loadJobs, applyEvent };
}
