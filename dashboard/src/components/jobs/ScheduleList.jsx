import { useState } from "react";
import EmptyState from "../common/EmptyState";
import JobStatusBadge from "./JobStatusBadge";
import { formatDate, priorityLabel } from "../../utils/formatters";

function frequency(ms) {
  if (ms % 86400000 === 0)
    return `Every ${ms / 86400000} day${ms === 86400000 ? "" : "s"}`;
  if (ms % 3600000 === 0)
    return `Every ${ms / 3600000} hour${ms === 3600000 ? "" : "s"}`;
  if (ms % 60000 === 0)
    return `Every ${ms / 60000} minute${ms === 60000 ? "" : "s"}`;
  return `Every ${ms.toLocaleString()} ms`;
}

export default function ScheduleList({
  schedules,
  onUpdate,
  onDelete,
  loading,
  projects = [],
}) {
  if (loading)
    return (
      <div className="skeleton-table" aria-label="Loading schedules">
        <i />
        <i />
        <i />
      </div>
    );
  if (!schedules.length)
    return (
      <EmptyState
        title="No recurring schedules"
        description="Create a schedule to dispatch registered jobs at a fixed interval."
      />
    );
  return (
    <div className="table-wrap">
      <table className="job-table">
        <thead>
          <tr>
            <th>Schedule</th>
            <th>Project</th>
            <th>Frequency</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => (
            <ScheduleRow
              key={schedule.schedule_id}
              schedule={schedule}
              project={projects.find(
                (item) => String(item.id) === String(schedule.project_id),
              )}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleRow({ schedule, project, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [interval, setIntervalValue] = useState(schedule.every_ms);
  const save = () => {
    const every = Number(interval);
    if (!Number.isInteger(every) || every < 1000) return;
    onUpdate(schedule.schedule_id, { every });
    setEditing(false);
  };
  return (
    <tr>
      <td>
        <strong>{schedule.type}</strong>
        <small>{schedule.schedule_id}</small>
      </td>
      <td>{project?.name || `Project #${schedule.project_id}`}</td>
      <td>
        {editing ? (
          <input
            className="table-input"
            type="number"
            min="1000"
            value={interval}
            onChange={(event) => setIntervalValue(event.target.value)}
            aria-label="Interval in milliseconds"
          />
        ) : (
          frequency(schedule.every_ms)
        )}
      </td>
      <td>
        <JobStatusBadge
          status={
            schedule.sync_status === "SYNCED"
              ? schedule.status
              : schedule.sync_status
          }
        />
      </td>
      <td>
        <span className="priority">{priorityLabel(schedule.priority)}</span>
      </td>
      <td>{formatDate(schedule.created_at)}</td>
      <td>
        <div className="stack-actions">
          {editing ? (
            <>
              <button className="small-button" onClick={save}>
                Save
              </button>
              <button
                className="small-button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button className="small-button" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          <button className="danger-button" onClick={() => onDelete(schedule)}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
