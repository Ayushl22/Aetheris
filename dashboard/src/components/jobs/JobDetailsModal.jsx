import Modal from "../common/Modal";
import JobStatusBadge from "./JobStatusBadge";
import { formatDate, priorityLabel, safeJson } from "../../utils/formatters";

export default function JobDetailsModal({
  details,
  loading,
  onClose,
  onRetry,
  onCancel,
  actionLoading
}) {
  if (!details && !loading) return null;

  const job = details?.job;
  const attempts = details?.attempts || [];

  return (
    <Modal title="Job details" onClose={onClose} wide>
      {loading ? (
        <div className="modal-loading">Loading job details...</div>
      ) : (
        <>
          <div className="details-hero">
            <div>
              <span className="eyebrow">DATABASE JOB #{job.id}</span>
              <h3>{job.type}</h3>
            </div>
            <JobStatusBadge status={job.status} />
          </div>

          <div className="details-grid">
            <Detail label="BullMQ ID" value={job.bullmq_job_id} mono />
            <Detail label="Project ID" value={job.project_id} />
            <Detail label="Priority" value={priorityLabel(job.priority)} />
            <Detail label="Attempts" value={job.attempts ?? 0} />
            <Detail label="Created" value={formatDate(job.created_at)} />
            <Detail label="Started" value={formatDate(job.started_at)} />
            <Detail label="Completed" value={formatDate(job.completed_at)} />
            <Detail label="Error" value={job.error || "—"} />
          </div>

          <div className="detail-section">
            <h4>Job data</h4>
            <pre className="code-block">{safeJson(job.data)}</pre>
          </div>

          <div className="detail-section">
            <h4>Attempt history</h4>
            {attempts.length ? (
              <div className="attempt-list">
                {attempts.map((attempt) => (
                  <div className="attempt-row" key={attempt.id}>
                    <div>
                      <strong>Attempt {attempt.attempt_number}</strong>
                      <small>
                        Started {formatDate(attempt.started_at)}
                        {attempt.completed_at
                          ? ` · Finished ${formatDate(attempt.completed_at)}`
                          : ""}
                      </small>
                    </div>
                    <div>
                      <JobStatusBadge status={attempt.status} />
                      {attempt.error && <small className="attempt-error">{attempt.error}</small>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No attempts recorded.</p>
            )}
          </div>

          <div className="modal-actions">
            {String(job.status).toUpperCase() === "FAILED" && (
              <button
                className="primary-button"
                onClick={() => onRetry(job.bullmq_job_id || job.id)}
                disabled={actionLoading}
              >
                Retry job
              </button>
            )}
            {!['COMPLETED', 'FAILED'].includes(String(job.status).toUpperCase()) && (
              <button
                className="danger-button"
                onClick={() => onCancel(job.bullmq_job_id || job.id)}
                disabled={actionLoading}
              >
                Cancel job
              </button>
            )}
            <button className="secondary-button" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value ?? "—"}</strong>
    </div>
  );
}