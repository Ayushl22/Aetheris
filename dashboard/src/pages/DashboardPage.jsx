import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import ProjectSelector from "../components/projects/ProjectSelector";
import ProjectList from "../components/projects/ProjectList";
import CreateProjectForm from "../components/projects/CreateProjectForm";
import JobStats from "../components/jobs/JobStats";
import JobTable from "../components/jobs/JobTable";
import JobForm from "../components/jobs/JobForm";
import JobDetailsModal from "../components/jobs/JobDetailsModal";
import RecurringJobForm from "../components/jobs/RecurringJobForm";
import EmptyState from "../components/common/EmptyState";
import { useAuth } from "../context/AuthContext";
import { useProjects } from "../hooks/useProjects";
import { useJobs } from "../hooks/useJobs";
import { useSocket } from "../hooks/useSocket";
import { useUnauthorized } from "../hooks/useUnauthorized";
import { projectService } from "../services/project.service";
import { jobService } from "../services/job.service";

export default function DashboardPage({ section, onSectionChange }) {
  const { user, logout } = useAuth();
  useUnauthorized();

  const {
    projects,
    setProjects,
    loading: projectsLoading,
    error: projectsError,
    reload: reloadProjects
  } = useProjects(true);

  const {
    jobs,
    setJobs,
    loading: jobsLoading,
    error: jobsError,
    reload: reloadJobs,
    applyEvent
  } = useJobs(true);

  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem("aetheris_project_id") || ""
  );
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [recurringSubmitting, setRecurringSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => String(project.id) === String(selectedProjectId)
      ) || null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(String(projects[0].id));
    } else if (
      selectedProjectId &&
      projects.length &&
      !projects.some((p) => String(p.id) === String(selectedProjectId))
    ) {
      setSelectedProjectId(String(projects[0].id));
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("aetheris_project_id", selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleSocketEvent = useCallback(
    (event) => {
      if (!event?.jobId) return;

      // Socket.IO gives the table an immediate lifecycle update.
      // PostgreSQL polling below supplies the authoritative timestamps,
      // attempts and final state without creating overlapping requests.
      applyEvent(event);

      setNotice(
        `${event.type || "Job"} ${String(event.status || "").toLowerCase()}`
      );
    },
    [applyEvent]
  );

  const socketConnected = useSocket(handleSocketEvent);

  // Keep an open Job Details modal synchronized with PostgreSQL too.
  // This matters when the worker changes PROCESSING -> COMPLETED while the
  // modal is already open.
  const selectedJobId = selectedJob?.job?.id;
  const selectedJobStatus = String(
    selectedJob?.job?.status || ""
  ).toUpperCase();

  useEffect(() => {
    if (!selectedJobId) return;

    const finalStatus = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
    if (finalStatus.has(selectedJobStatus)) return;

    let cancelled = false;

    const refreshDetails = async () => {
      try {
        const details = await jobService.get(selectedJobId);
        if (!cancelled) {
          setSelectedJob(details);
        }
      } catch {
        // Keep the current modal visible if a background refresh fails.
      }
    };

    const timer = setInterval(refreshDetails, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedJobId, selectedJobStatus]);

  const refresh = async () => {
    await Promise.all([reloadProjects(), reloadJobs()]);
  };

  const selectProject = (id) => setSelectedProjectId(String(id));

  const createProject = async (name) => {
    setCreatingProject(true);
    setNotice("");
    try {
      const result = await projectService.create(name);
      const project = result.project || result;
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(String(project.id));
      setNotice("Project created successfully.");
      return true;
    } catch (err) {
      setNotice(err.message);
      return false;
    } finally {
      setCreatingProject(false);
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project and its jobs?")) return;

    try {
      await projectService.remove(id);
      setProjects((current) => current.filter((p) => String(p.id) !== String(id)));
      if (String(selectedProjectId) === String(id)) {
        setSelectedProjectId("");
      }
      setNotice("Project deleted.");
      await reloadJobs();
    } catch (err) {
      setNotice(err.message);
    }
  };

  const submitJob = async (payload) => {
    if (!selectedProject) {
      setNotice("Select a project first.");
      return false;
    }

    setSubmitting(true);
    setNotice("");
    try {
      const result = await jobService.create({
        ...payload,
        projectId: selectedProject.id
      });
      setNotice(result.message || "Job submitted successfully.");
      await reloadJobs();
      return true;
    } catch (err) {
      setNotice(err.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleRecurring = async (payload) => {
    setRecurringSubmitting(true);
    setNotice("");
    try {
      const result = await jobService.createRecurring(payload);
      setNotice(result.message || "Recurring job scheduled.");
      await reloadJobs();
      return true;
    } catch (err) {
      setNotice(err.message);
      return false;
    } finally {
      setRecurringSubmitting(false);
    }
  };

  const openJob = async (id) => {
    if (!id) return;
    setSelectedJob(null);
    setDetailsLoading(true);
    try {
      setSelectedJob(await jobService.get(id));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const retryJob = async (id) => {
    setActionLoading(true);
    try {
      const result = await jobService.retry(id);
      setNotice(result.message || "Job retry requested.");
      setSelectedJob(null);
      await reloadJobs();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelJob = async (id) => {
    if (!window.confirm("Cancel this job?")) return;
    setActionLoading(true);
    try {
      const result = await jobService.cancel(id);
      setNotice(result.message || "Job cancelled.");
      setSelectedJob(null);
      await reloadJobs();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const pauseQueue = async () => {
    setQueueLoading(true);
    try {
      const result = await jobService.pauseQueue();
      setNotice(result.message || "Queue paused.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setQueueLoading(false);
    }
  };

  const resumeQueue = async () => {
    setQueueLoading(true);
    try {
      const result = await jobService.resumeQueue();
      setNotice(result.message || "Queue resumed.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setQueueLoading(false);
    }
  };

  return (
    <DashboardLayout
      active={section}
      onChange={onSectionChange}
      onLogout={logout}
      project={selectedProject}
      socketConnected={socketConnected}
      userEmail={user?.email}
      onRefresh={refresh}
    >
      {notice && <div className="notice">{notice}</div>}

      {section === "dashboard" && (
        <DashboardHome
          projects={projects}
          selectedProject={selectedProject}
          selectedProjectId={selectedProjectId}
          onProjectChange={selectProject}
          projectsLoading={projectsLoading}
          jobs={jobs}
          jobsLoading={jobsLoading}
          onJobSelect={openJob}
          onSubmit={submitJob}
          submitting={submitting}
          onCreateProject={createProject}
          creatingProject={creatingProject}
          onScheduleRecurring={scheduleRecurring}
          recurringSubmitting={recurringSubmitting}
        />
      )}

      {section === "jobs" && (
        <JobsPageContent
          jobs={jobs}
          loading={jobsLoading}
          error={jobsError}
          onSelect={openJob}
          onRefresh={reloadJobs}
        />
      )}

      {section === "projects" && (
        <ProjectsPageContent
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={selectProject}
          onDelete={deleteProject}
          onCreate={createProject}
          creating={creatingProject}
          error={projectsError}
        />
      )}

      {section === "settings" && (
        <SettingsPageContent
          socketConnected={socketConnected}
          project={selectedProject}
          onRefresh={refresh}
          onPauseQueue={pauseQueue}
          onResumeQueue={resumeQueue}
          queueLoading={queueLoading}
        />
      )}

      <JobDetailsModal
        details={selectedJob}
        loading={detailsLoading}
        onClose={() => setSelectedJob(null)}
        onRetry={retryJob}
        onCancel={cancelJob}
        actionLoading={actionLoading}
      />
    </DashboardLayout>
  );
}

function DashboardHome(props) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h2>Scheduler overview</h2>
          <p>Monitor your background workload in real time.</p>
        </div>
        <ProjectSelector
          projects={props.projects}
          selectedId={props.selectedProjectId}
          onChange={props.onProjectChange}
          loading={props.projectsLoading}
        />
      </div>

      <JobStats jobs={props.jobs} />

      <div className="dashboard-grid">
        <JobForm
          project={props.selectedProject}
          onSubmit={props.onSubmit}
          submitting={props.submitting}
        />
        <RecurringJobForm
          project={props.selectedProject}
          onSubmit={props.onScheduleRecurring}
          submitting={props.recurringSubmitting}
        />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ACTIVITY</span>
            <h2>Recent jobs</h2>
          </div>
        </div>
        <JobTable
          jobs={props.jobs.slice(0, 10)}
          loading={props.jobsLoading}
          onSelect={props.onJobSelect}
        />
      </section>
    </>
  );
}

function JobsPageContent({ jobs, loading, error, onSelect, onRefresh }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">QUEUE</span>
          <h2>Jobs</h2>
          <p>Inspect every persisted job and its execution state.</p>
        </div>
        <button className="secondary-button" onClick={onRefresh}>↻ Refresh</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <section className="panel">
        <JobTable jobs={jobs} loading={loading} onSelect={onSelect} />
      </section>
    </>
  );
}

function ProjectsPageContent({
  projects,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
  creating,
  error
}) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">ACCESS</span>
          <h2>Projects</h2>
          <p>Projects isolate API keys and job ownership.</p>
        </div>
        <CreateProjectForm onCreate={onCreate} loading={creating} />
      </div>
      {error && <div className="form-error">{error}</div>}
      <ProjectList
        projects={projects}
        selectedId={selectedId}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    </>
  );
}

function SettingsPageContent({
  socketConnected,
  project,
  onRefresh,
  onPauseQueue,
  onResumeQueue,
  queueLoading
}) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">SYSTEM</span>
          <h2>Settings</h2>
          <p>Current frontend connection and project information.</p>
        </div>
      </div>

      <section className="settings-grid">
        <div className="panel setting-card">
          <span className="eyebrow">REALTIME</span>
          <h3>{socketConnected ? "Socket connected" : "Socket disconnected"}</h3>
          <p>
            Aetheris listens for job lifecycle events over Socket.IO. Refresh
            remains available as a fallback.
          </p>
        </div>

        <div className="panel setting-card">
          <span className="eyebrow">ACTIVE PROJECT</span>
          <h3>{project?.name || "No project selected"}</h3>
          <p>Project ID: {project?.id ?? "—"}</p>
        </div>

        <div className="panel setting-card">
          <span className="eyebrow">BACKEND</span>
          <h3>http://localhost:3000</h3>
          <p>Frontend expects the existing Aetheris backend contracts.</p>
          <div className="stack-actions">
            <button className="secondary-button" onClick={onRefresh}>Refresh data</button>
            <button
              className="secondary-button"
              onClick={onPauseQueue}
              disabled={queueLoading}
            >
              {queueLoading ? "Updating..." : "Pause queue"}
            </button>
            <button
              className="secondary-button"
              onClick={onResumeQueue}
              disabled={queueLoading}
            >
              {queueLoading ? "Updating..." : "Resume queue"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}