export default function ProjectSelector({
  projects,
  selectedId,
  onChange,
  loading
}) {
  return (
    <label className="project-selector">
      <span>Active project</span>
      <select
        value={selectedId || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading || projects.length === 0}
      >
        {projects.length === 0 ? (
          <option value="">No projects</option>
        ) : (
          projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}