import { formatDate } from "../../utils/formatters";

export default function ProjectCard({ project, selected, onSelect, onDelete }) {
  return (
    <article className={`project-card ${selected ? "selected" : ""}`}>
      <div className="project-card-head">
        <div>
          <span className="project-icon">P</span>
          <h3>{project.name}</h3>
        </div>
        <span className="project-id">#{project.id}</span>
      </div>

      <p>Created {formatDate(project.created_at)}</p>

      <div className="project-metrics"><div><strong>{project.job_count ?? 0}</strong><span>Total jobs</span></div><div><strong>Active</strong><span>API access</span></div></div>

      <div className="api-key-row">
        <code>{`${project.api_key_prefix || "aetheris"}••••${project.api_key_last_four || "••••"}`}</code>
      </div>

      <div className="project-actions">
        <button className="secondary-button" onClick={() => onSelect(project.id)}>
          {selected ? "Selected" : "Use project"}
        </button>
        <button className="danger-button" onClick={() => onDelete(project.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}
