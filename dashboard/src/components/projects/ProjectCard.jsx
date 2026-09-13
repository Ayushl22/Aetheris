import { useState } from "react";
import { formatDate } from "../../utils/formatters";

export default function ProjectCard({ project, selected, onSelect, onDelete }) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(project.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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

      <div className="api-key-row">
        <code>{project.api_key}</code>
        <button className="small-button" onClick={copyKey}>
          {copied ? "Copied" : "Copy"}
        </button>
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