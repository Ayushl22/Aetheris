import ProjectCard from "./ProjectCard";
import EmptyState from "../common/EmptyState";

export default function ProjectList({
  projects,
  selectedId,
  onSelect,
  onDelete
}) {
  if (!projects.length) {
    return (
      <EmptyState
        title="No projects yet"
        description="Create a project to obtain an API key and start submitting jobs."
      />
    );
  }

  return (
    <div className="project-grid">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          selected={String(project.id) === String(selectedId)}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}