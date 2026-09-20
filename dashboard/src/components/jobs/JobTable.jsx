import EmptyState from "../common/EmptyState";
import JobStatusBadge from "./JobStatusBadge";
import { formatDate, priorityLabel } from "../../utils/formatters";

export default function JobTable({ jobs, loading, onSelect, projects = [] }) {
  if (loading) {
    return <div className="table-state">Loading jobs...</div>;
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs yet"
        description="Create your first job to start processing background work."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="job-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Type</th>
            <th>Project</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Attempts</th>
            <th>Created</th>
            <th>Updated</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id ?? job.bullmq_job_id}
              onClick={() => onSelect(job.id)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(job.id);
                }
              }}
            >
              <td>
                <strong>#{job.id}</strong>
                <small>{job.bullmq_job_id || "—"}</small>
              </td>
              <td>{job.type}</td>
              <td>{projects.find((project) => String(project.id) === String(job.project_id))?.name || `Project #${job.project_id}`}</td>
              <td><JobStatusBadge status={job.status} /></td>
              <td><span className="priority">{priorityLabel(job.priority)}</span></td>
              <td>{job.attempts ?? 0}</td>
              <td>{formatDate(job.created_at)}</td>
              <td>{formatDate(job.updated_at)}</td>
              <td className="row-arrow">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
