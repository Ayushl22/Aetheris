import { useCallback, useEffect, useState } from "react";
import { projectService } from "../services/project.service";

export function useProjects(enabled) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      setProjects(await projectService.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return { projects, setProjects, loading, error, reload: loadProjects };
}