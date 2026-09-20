import Modal from "../common/Modal";
import JsonViewer from "../common/JsonViewer";
import JobStatusBadge from "./JobStatusBadge";
import { formatDate, priorityLabel } from "../../utils/formatters";

export default function JobDetailsModal({
  details,
  loading,
  onClose,
  onRetry,
  onCancel,
  dlqEntry,
  actionLoading,
}) {
  if (!details && !loading) return null;

  const job = details?.job;
  const attempts = details?.attempts || [];

  return (
    <Modal
      title={job ? `Job #${job.id}` : "Job details"}
      onClose={onClose}
      wide
    >
      {loading ? (
        <div className="modal-loading">Loading job details...</div>
      ) : (
        <>
          <div className="details-hero">
            <div>
              <span className="job-identity">{job.bullmq_job_id}</span>
              <h3>{job.type}</h3>
              <p>Created {formatDate(job.created_at)}</p>
            </div>
            <JobStatusBadge status={job.status} />
          </div>

          <div className="detail-section">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">OVERVIEW</span>
                <h4>Job configuration</h4>
              </div>
            </div>
            <div className="details-grid">
              <Detail label="Project ID" value={job.project_id} />
              <Detail label="Priority" value={priorityLabel(job.priority)} />
              <Detail label="Attempts" value={job.attempts ?? 0} />
              <Detail label="Max attempts" value={job.max_attempts ?? 3} />
              <Detail label="Delay" value={`${job.delay_ms || 0} ms`} />
              <Detail label="Queue delivery" value={job.enqueue_status} />
            </div>
          </div>

          <div className="detail-section">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">EXECUTION</span>
                <h4>Timeline</h4>
              </div>
            </div>
            <div className="timeline">
              <Timeline label="Created" value={job.created_at} active />
              <Timeline
                label="Started"
                value={job.started_at}
                active={Boolean(job.started_at)}
              />
              <Timeline
                label="Completed"
                value={job.completed_at}
                active={Boolean(job.completed_at)}
              />
            </div>
            <div className="queue-identity">
              <span>BullMQ ID</span>
              <code>{job.bullmq_job_id}</code>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">PAYLOAD</span>
                <h4>Input data</h4>
              </div>
            </div>
            <JsonViewer value={job.data} label="input.json" />
          </div>

          <div className="detail-section">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">ATTEMPTS</span>
                <h4>Execution history</h4>
              </div>
              <span className="count-pill">{attempts.length}</span>
            </div>
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
                      {attempt.error && (
                        <small className="attempt-error">{attempt.error}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No attempts recorded.</p>
            )}
          </div>

          {job.error && (
            <div className="detail-section">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">ERROR</span>
                  <h4>Latest failure</h4>
                </div>
              </div>
              <div className="error-panel">
                <strong>{job.error}</strong>
              </div>
            </div>
          )}

          {job.result !== null && job.result !== undefined && (
            <div className="detail-section">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">RESULT</span>
                  <h4>Handler output</h4>
                </div>
              </div>
              <JsonViewer
                value={job.result}
                label="result.json"
                tone="result"
              />
            </div>
          )}

          <div className="modal-actions">
            {String(job.status).toUpperCase() === "FAILED" && dlqEntry && (
              <button
                className="primary-button"
                onClick={() => onRetry(dlqEntry.dlq_id)}
                disabled={actionLoading}
              >
                Retry job
              </button>
            )}
            {!["COMPLETED", "FAILED"].includes(
              String(job.status).toUpperCase(),
            ) && (
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

function Timeline({ label, value, active }) {
  return (
    <div className={`timeline-item ${active ? "active" : ""}`}>
      <i />
      <span>{label}</span>
      <strong>{formatDate(value)}</strong>
    </div>
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
