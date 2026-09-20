import EmptyState from "../common/EmptyState";
import { formatDate } from "../../utils/formatters";

export default function FailedJobTable({
  entries,
  onRetry,
  onInspect,
  loading,
  projects = [],
}) {
  if (loading)
    return (
      <div className="skeleton-table" aria-label="Loading dead-letter entries">
        <i />
        <i />
        <i />
      </div>
    );
  if (!entries.length)
    return (
      <EmptyState
        title="Dead letter queue is clear"
        description="Jobs that exhaust their retries will appear here for inspection and recovery."
      />
    );
  return (
    <div className="table-wrap">
      <table className="job-table">
        <thead>
          <tr>
            <th>Failed job</th>
            <th>Project</th>
            <th>Failure reason</th>
            <th>Attempts</th>
            <th>Last failure</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.dlq_id}>
              <td>
                <strong>{entry.type}</strong>
                <small>
                  Job #{entry.job_id} · {entry.dlq_id}
                </small>
              </td>
              <td>
                {projects.find(
                  (project) => String(project.id) === String(entry.project_id),
                )?.name || `Project #${entry.project_id}`}
              </td>
              <td>
                <span className="error-summary" title={entry.error}>
                  {entry.error}
                </span>
              </td>
              <td>{entry.attempts ?? "—"}</td>
              <td>{formatDate(entry.last_failure_at || entry.created_at)}</td>
              <td>
                <div className="stack-actions">
                  <button
                    className="small-button"
                    onClick={() => onInspect(entry.job_id)}
                  >
                    Inspect
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => onRetry(entry)}
                  >
                    Retry
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
