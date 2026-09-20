import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import ProjectList from "../components/projects/ProjectList";
import CreateProjectForm from "../components/projects/CreateProjectForm";
import JobStats from "../components/jobs/JobStats";
import JobTable from "../components/jobs/JobTable";
import JobForm from "../components/jobs/JobForm";
import JobDetailsModal from "../components/jobs/JobDetailsModal";
import RecurringJobForm from "../components/jobs/RecurringJobForm";
import ScheduleList from "../components/jobs/ScheduleList";
import FailedJobTable from "../components/jobs/FailedJobTable";
import JobActivity from "../components/jobs/JobActivity";
import Modal from "../components/common/Modal";
import ToastRegion from "../components/common/ToastRegion";
import Icon from "../components/common/Icon";
import { useAuth } from "../context/AuthContext";
import { useProjects } from "../hooks/useProjects";
import { useJobs } from "../hooks/useJobs";
import { useSocket } from "../hooks/useSocket";
import { useUnauthorized } from "../hooks/useUnauthorized";
import { projectService } from "../services/project.service";
import { jobService } from "../services/job.service";
import { API_URL } from "../config";
import { formatDate } from "../utils/formatters";

export default function DashboardPage({ section, onSectionChange }) {
  const { user, logout } = useAuth();
  useUnauthorized();
  const {
    projects,
    setProjects,
    loading: projectsLoading,
    error: projectsError,
    reload: reloadProjects,
  } = useProjects(true);
  const {
    jobs,
    loading: jobsLoading,
    error: jobsError,
    reload: reloadJobs,
    applyEvent,
  } = useJobs(true);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem("aetheris_project_id") || "",
  );
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [recurringSubmitting, setRecurringSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [failedJobs, setFailedJobs] = useState([]);
  const [failedLoading, setFailedLoading] = useState(false);
  const [jobTypes, setJobTypes] = useState([]);
  const [jobTypesError, setJobTypesError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [revealedKey, setRevealedKey] = useState(null);
  const [systemStatus, setSystemStatus] = useState({
    loading: true,
    health: null,
    ready: null,
  });

  const notify = useCallback((title, message = "", kind = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [
      ...current.slice(-3),
      { id, title, message, kind },
    ]);
    setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      4500,
    );
  }, []);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => String(project.id) === String(selectedProjectId),
      ) || null,
    [projects, selectedProjectId],
  );
  const visibleJobs = useMemo(
    () =>
      selectedProjectId
        ? jobs.filter(
            (job) => String(job.project_id) === String(selectedProjectId),
          )
        : [],
    [jobs, selectedProjectId],
  );
  const visibleFailedJobs = useMemo(
    () =>
      selectedProjectId
        ? failedJobs.filter(
            (entry) => String(entry.project_id) === String(selectedProjectId),
          )
        : [],
    [failedJobs, selectedProjectId],
  );

  const loadSchedules = useCallback(async () => {
    if (!selectedProjectId) {
      setSchedules([]);
      return;
    }
    setSchedulesLoading(true);
    try {
      setSchedules(await jobService.listRecurring(selectedProjectId));
    } catch (error) {
      notify("Unable to load schedules", error.message, "error");
    } finally {
      setSchedulesLoading(false);
    }
  }, [selectedProjectId, notify]);

  const loadFailedJobs = useCallback(async () => {
    setFailedLoading(true);
    try {
      setFailedJobs(await jobService.failed());
    } catch (error) {
      notify("Unable to load dead-letter entries", error.message, "error");
    } finally {
      setFailedLoading(false);
    }
  }, [notify]);

  const loadSystemStatus = useCallback(async () => {
    setSystemStatus((current) => ({ ...current, loading: true }));
    const read = async (path) => {
      try {
        const response = await fetch(`${API_URL.replace(/\/$/, "")}${path}`);
        return { ok: response.ok, body: await response.json() };
      } catch {
        return { ok: false, body: null };
      }
    };
    const [health, ready] = await Promise.all([
      read("/health"),
      read("/ready"),
    ]);
    setSystemStatus({ loading: false, health, ready });
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);
  useEffect(() => {
    loadFailedJobs();
  }, [loadFailedJobs]);
  useEffect(() => {
    loadSystemStatus();
  }, [loadSystemStatus]);
  useEffect(() => {
    jobService
      .types()
      .then(setJobTypes)
      .catch((error) => setJobTypesError(error.message));
  }, []);
  useEffect(() => {
    if (!selectedProjectId && projects[0])
      setSelectedProjectId(String(projects[0].id));
    else if (
      selectedProjectId &&
      projects.length &&
      !projects.some(
        (project) => String(project.id) === String(selectedProjectId),
      )
    )
      setSelectedProjectId(String(projects[0].id));
  }, [projects, selectedProjectId]);
  useEffect(() => {
    if (selectedProjectId)
      localStorage.setItem("aetheris_project_id", selectedProjectId);
  }, [selectedProjectId]);

  const handleSocketEvent = useCallback(
    (event) => {
      if (!event?.jobId) return;
      applyEvent(event);
      if (
        ["COMPLETED", "FAILED"].includes(String(event.status).toUpperCase())
      ) {
        notify(
          `Job ${String(event.status).toLowerCase()}`,
          `${event.type} · ${event.jobId}`,
          event.status === "FAILED" ? "error" : "success",
        );
      }
      if (String(event.status).toUpperCase() === "FAILED") loadFailedJobs();
    },
    [applyEvent, loadFailedJobs, notify],
  );
  const socketConnected = useSocket(handleSocketEvent);

  const selectedJobId = selectedJob?.job?.id;
  const selectedJobStatus = String(
    selectedJob?.job?.status || "",
  ).toUpperCase();
  useEffect(() => {
    if (
      !selectedJobId ||
      ["COMPLETED", "FAILED", "CANCELLED"].includes(selectedJobStatus)
    )
      return undefined;
    const timer = setInterval(async () => {
      try {
        setSelectedJob(await jobService.get(selectedJobId));
      } catch {
        /* keep current details */
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [selectedJobId, selectedJobStatus]);

  const refresh = async () => {
    await Promise.all([
      reloadProjects(),
      reloadJobs(),
      loadSchedules(),
      loadFailedJobs(),
      loadSystemStatus(),
    ]);
    notify("Workspace refreshed", "Latest persisted state loaded.", "success");
  };

  const createProject = async (name) => {
    setCreatingProject(true);
    try {
      const result = await projectService.create(name);
      const project = result.project || result;
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(String(project.id));
      setRevealedKey({
        projectId: project.id,
        projectName: project.name,
        value: project.api_key,
      });
      notify("Project created", `${project.name} is ready.`, "success");
      return true;
    } catch (error) {
      notify("Unable to create project", error.message, "error");
      return false;
    } finally {
      setCreatingProject(false);
    }
  };

  const closeRevealedKey = () => {
    if (
      revealedKey &&
      !window.confirm("Close this key? The full value cannot be shown again.")
    )
      return;
    setProjects((current) =>
      current.map((project) =>
        project.id === revealedKey?.projectId
          ? { ...project, api_key: undefined }
          : project,
      ),
    );
    setRevealedKey(null);
  };

  const deleteProject = async (id) => {
    const project = projects.find((item) => String(item.id) === String(id));
    const confirmation = window.prompt(
      `This deletes ${project?.name || "the project"}, its schedules, and job history. Type the project name to continue.`,
    );
    if (confirmation !== project?.name) {
      if (confirmation !== null)
        notify(
          "Project not deleted",
          "The confirmation name did not match.",
          "error",
        );
      return;
    }
    try {
      await projectService.remove(id);
      setProjects((current) =>
        current.filter((item) => String(item.id) !== String(id)),
      );
      if (String(selectedProjectId) === String(id)) setSelectedProjectId("");
      notify(
        "Project deleted",
        `${project.name} and its persisted work were removed.`,
        "success",
      );
      await reloadJobs();
    } catch (error) {
      notify("Unable to delete project", error.message, "error");
    }
  };

  const submitJob = async (payload, mode = "immediate") => {
    if (!selectedProject) {
      notify("Select a project", "Jobs require an owning project.", "error");
      return false;
    }
    setSubmitting(true);
    try {
      const result =
        mode === "delayed"
          ? await jobService.createDelayed({
              ...payload,
              projectId: selectedProject.id,
            })
          : await jobService.create({
              ...payload,
              projectId: selectedProject.id,
            });
      notify(
        mode === "delayed" ? "Job scheduled" : "Job dispatched",
        `Database job #${result.databaseJobId} · ${result.status}`,
        "success",
      );
      await reloadJobs();
      return true;
    } catch (error) {
      notify("Unable to create job", error.message, "error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleRecurring = async (payload) => {
    setRecurringSubmitting(true);
    try {
      const result = await jobService.createRecurring(payload);
      notify("Schedule created", result.message, "success");
      await loadSchedules();
      return true;
    } catch (error) {
      notify("Unable to create schedule", error.message, "error");
      return false;
    } finally {
      setRecurringSubmitting(false);
    }
  };

  const updateSchedule = async (scheduleId, changes) => {
    try {
      const result = await jobService.updateRecurring(scheduleId, changes);
      notify("Schedule updated", result.message, "success");
      await loadSchedules();
    } catch (error) {
      notify("Unable to update schedule", error.message, "error");
    }
  };

  const deleteSchedule = async (schedule) => {
    if (
      !window.confirm(
        `Delete the ${schedule.type} schedule? No future jobs will be generated.`,
      )
    )
      return;
    try {
      const result = await jobService.deleteRecurring(schedule.schedule_id);
      notify("Schedule deleted", result.message, "success");
      await loadSchedules();
    } catch (error) {
      notify("Unable to delete schedule", error.message, "error");
    }
  };

  const openJob = async (id) => {
    if (!id) return;
    setSelectedJob(null);
    setDetailsLoading(true);
    try {
      setSelectedJob(await jobService.get(id));
    } catch (error) {
      notify("Unable to load job", error.message, "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  const retryJob = async (entryOrId) => {
    const entry =
      typeof entryOrId === "object"
        ? entryOrId
        : failedJobs.find((item) => item.dlq_id === entryOrId);
    const dlqId = entry?.dlq_id || entryOrId;
    if (
      entry &&
      !window.confirm(
        `Retry job #${entry.job_id}? A new BullMQ execution will be created and prior attempt history will remain.`,
      )
    )
      return;
    setActionLoading(true);
    try {
      const result = await jobService.retry(dlqId);
      notify("Retry accepted", result.message, "success");
      setSelectedJob(null);
      await Promise.all([reloadJobs(), loadFailedJobs()]);
    } catch (error) {
      notify("Unable to retry job", error.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelJob = async (id) => {
    if (
      !window.confirm(
        "Cancel this queued job? Active jobs cannot be interrupted.",
      )
    )
      return;
    setActionLoading(true);
    try {
      const result = await jobService.cancel(id);
      notify("Job cancelled", result.message, "success");
      setSelectedJob(null);
      await reloadJobs();
    } catch (error) {
      notify("Unable to cancel job", error.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const pageProps = {
    projects,
    selectedProject,
    selectedProjectId,
    jobs: visibleJobs,
    failedJobs: visibleFailedJobs,
    schedules,
    jobTypes,
    jobsLoading,
    failedLoading,
    schedulesLoading,
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
      projects={projects}
      selectedProjectId={selectedProjectId}
      onProjectChange={(id) => setSelectedProjectId(String(id))}
      systemStatus={
        systemStatus.loading ? null : Boolean(systemStatus.ready?.ok)
      }
    >
      {section === "dashboard" && (
        <OverviewPage
          {...pageProps}
          onOpenJob={openJob}
          onNavigate={onSectionChange}
        />
      )}
      {section === "jobs" && (
        <JobsPage
          {...pageProps}
          error={jobsError || jobTypesError}
          onOpenJob={openJob}
          onSubmit={submitJob}
          submitting={submitting}
        />
      )}
      {section === "schedules" && (
        <SchedulesPage
          {...pageProps}
          onCreate={scheduleRecurring}
          submitting={recurringSubmitting}
          onUpdate={updateSchedule}
          onDelete={deleteSchedule}
        />
      )}
      {section === "dlq" && (
        <DlqPage {...pageProps} onRetry={retryJob} onInspect={openJob} />
      )}
      {section === "projects" && (
        <ProjectsPage
          projects={projects}
          selectedId={selectedProjectId}
          loading={projectsLoading}
          error={projectsError}
          onSelect={(id) => setSelectedProjectId(String(id))}
          onDelete={deleteProject}
          onCreate={createProject}
          creating={creatingProject}
        />
      )}
      {section === "api-keys" && (
        <ApiKeysPage projects={projects} onNavigate={onSectionChange} />
      )}
      {section === "settings" && (
        <SettingsPage
          systemStatus={systemStatus}
          socketConnected={socketConnected}
          project={selectedProject}
          jobTypes={jobTypes}
          onRefresh={loadSystemStatus}
        />
      )}

      <JobDetailsModal
        details={selectedJob}
        loading={detailsLoading}
        onClose={() => setSelectedJob(null)}
        onRetry={retryJob}
        onCancel={cancelJob}
        dlqEntry={
          visibleFailedJobs.find(
            (entry) => String(entry.job_id) === String(selectedJob?.job?.id),
          ) || null
        }
        actionLoading={actionLoading}
      />
      {revealedKey && (
        <ApiKeyReveal secret={revealedKey} onClose={closeRevealedKey} />
      )}
      <ToastRegion
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }
      />
    </DashboardLayout>
  );
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function OverviewPage({
  jobs,
  failedJobs,
  jobsLoading,
  projects,
  onOpenJob,
  onNavigate,
}) {
  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS"
        title="System overview"
        description="A live view of persisted work for the current project."
        action={
          <button className="primary-button" onClick={() => onNavigate("jobs")}>
            <Icon name="plus" size={15} /> Create job
          </button>
        }
      />
      <JobStats jobs={jobs} dlqCount={failedJobs.length} />
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THROUGHPUT</span>
              <h3>Job activity</h3>
              <p>Jobs created over the last seven days.</p>
            </div>
            <span className="count-pill">{jobs.length} loaded</span>
          </div>
          <JobActivity jobs={jobs} />
        </section>
        <section className="panel operations-card">
          <span className="eyebrow">QUICK ACTIONS</span>
          <h3>Operate your workload</h3>
          <button onClick={() => onNavigate("jobs")}>
            <span>
              Dispatch a job<small>Immediate or delayed execution</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button onClick={() => onNavigate("schedules")}>
            <span>
              Create a schedule<small>Recurring background work</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button onClick={() => onNavigate("dlq")}>
            <span>
              Review failures
              <small>{failedJobs.length} open dead-letter entries</small>
            </span>
            <Icon name="chevron" />
          </button>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECENT ACTIVITY</span>
            <h3>Recent jobs</h3>
          </div>
          <button className="text-button" onClick={() => onNavigate("jobs")}>
            View all <Icon name="chevron" size={14} />
          </button>
        </div>
        <JobTable
          jobs={jobs.slice(0, 8)}
          projects={projects}
          loading={jobsLoading}
          onSelect={onOpenJob}
        />
      </section>
    </>
  );
}

function JobsPage({
  jobs,
  jobTypes,
  projects,
  selectedProject,
  jobsLoading,
  error,
  onOpenJob,
  onSubmit,
  submitting,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = useMemo(
    () =>
      jobs
        .filter((job) => {
          const query = search.toLowerCase();
          return (
            (!query ||
              `${job.id} ${job.bullmq_job_id} ${job.type}`
                .toLowerCase()
                .includes(query)) &&
            (status === "ALL" || job.status === status) &&
            (priority === "ALL" || String(job.priority) === priority) &&
            (type === "ALL" || job.type === type)
          );
        })
        .sort((a, b) =>
          sort === "oldest"
            ? new Date(a.created_at) - new Date(b.created_at)
            : new Date(b.created_at) - new Date(a.created_at),
        ),
    [jobs, search, status, priority, type, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const displayed = filtered.slice(
    (Math.min(page, pages) - 1) * pageSize,
    Math.min(page, pages) * pageSize,
  );
  return (
    <>
      <PageHeader
        eyebrow="JOB EXPLORER"
        title="Jobs"
        description="Create, search, and inspect every persisted execution."
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <JobForm
        project={selectedProject}
        onSubmit={onSubmit}
        submitting={submitting}
        jobTypes={jobTypes}
      />
      <section className="panel">
        <div className="filter-bar">
          <label className="search-field">
            <Icon name="search" size={15} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search job ID, queue ID, or type"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            {[...new Set(jobs.map((job) => job.status))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="ALL">All priorities</option>
            <option value="1">High</option>
            <option value="5">Medium</option>
            <option value="10">Low</option>
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="ALL">All types</option>
            {jobTypes.map((item) => (
              <option value={item.type} key={item.type}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <JobTable
          jobs={displayed}
          projects={projects}
          loading={jobsLoading}
          onSelect={onOpenJob}
        />
        <div className="pagination">
          <span>{filtered.length} matching jobs</span>
          <div>
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span>
              Page {Math.min(page, pages)} of {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function SchedulesPage({
  schedules,
  projects,
  selectedProject,
  jobTypes,
  schedulesLoading,
  onCreate,
  submitting,
  onUpdate,
  onDelete,
}) {
  return (
    <>
      <PageHeader
        eyebrow="AUTOMATION"
        title="Schedules"
        description="Run registered handlers repeatedly at understandable fixed intervals."
      />
      <div className="two-column">
        <RecurringJobForm
          project={selectedProject}
          jobTypes={jobTypes}
          onSubmit={onCreate}
          submitting={submitting}
        />
        <section className="panel schedule-guide">
          <span className="eyebrow">HOW IT WORKS</span>
          <h3>Database-first scheduling</h3>
          <p>
            Schedules are persisted before BullMQ synchronization. If Redis is
            unavailable, Aetheris retries synchronization without losing the
            schedule.
          </p>
          <div className="flow-line">
            <span>PostgreSQL</span>
            <i>→</i>
            <span>BullMQ</span>
            <i>→</i>
            <span>Worker</span>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ACTIVE CONFIGURATION</span>
            <h3>Recurring schedules</h3>
          </div>
          <span className="count-pill">{schedules.length}</span>
        </div>
        <ScheduleList
          schedules={schedules}
          projects={projects}
          loading={schedulesLoading}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </section>
    </>
  );
}

function DlqPage({ failedJobs, failedLoading, projects, onRetry, onInspect }) {
  return (
    <>
      <PageHeader
        eyebrow="RECOVERY"
        title="Dead-letter queue"
        description="Inspect jobs that exhausted automatic retries and deliberately return them to execution."
      />
      <div className="callout">
        <Icon name="dlq" />
        <div>
          <strong>Retries preserve history</strong>
          <p>
            Manual retry creates a new BullMQ execution ID while retaining the
            original job and all attempt records.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">OPEN FAILURES</span>
            <h3>Awaiting action</h3>
          </div>
          <span className="count-pill">{failedJobs.length}</span>
        </div>
        <FailedJobTable
          entries={failedJobs}
          projects={projects}
          loading={failedLoading}
          onRetry={onRetry}
          onInspect={onInspect}
        />
      </section>
    </>
  );
}

function ProjectsPage({
  projects,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
  creating,
  error,
}) {
  return (
    <>
      <PageHeader
        eyebrow="TENANCY"
        title="Projects"
        description="Isolate workloads, ownership, schedules, and API credentials."
        action={<CreateProjectForm onCreate={onCreate} loading={creating} />}
      />
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

function ApiKeysPage({ projects, onNavigate }) {
  return (
    <>
      <PageHeader
        eyebrow="DEVELOPER ACCESS"
        title="API keys"
        description="Each project owns one credential for idempotent external job submission."
      />
      <div className="callout">
        <Icon name="keys" />
        <div>
          <strong>Keys are shown once</strong>
          <p>
            Aetheris stores only an HMAC hash. Create a new project to issue a
            key and save the full value before closing the reveal dialog.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table className="job-table">
            <thead>
              <tr>
                <th>Key owner</th>
                <th>Masked credential</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <strong>{project.name}</strong>
                    <small>Project #{project.id}</small>
                  </td>
                  <td>
                    <code>
                      {project.api_key_prefix || "aetheris"}••••
                      {project.api_key_last_four || "••••"}
                    </code>
                  </td>
                  <td>{formatDate(project.created_at)}</td>
                  <td>
                    <span className="status status-completed">ACTIVE</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!projects.length && (
          <button
            className="primary-button"
            onClick={() => onNavigate("projects")}
          >
            Create a project
          </button>
        )}
      </section>
    </>
  );
}

function SettingsPage({
  systemStatus,
  socketConnected,
  project,
  jobTypes,
  onRefresh,
}) {
  const checks = systemStatus.ready?.body?.checks || {};
  const status = (value) =>
    value === "healthy"
      ? "Healthy"
      : value === "unavailable"
        ? "Unavailable"
        : "Unknown";
  return (
    <>
      <PageHeader
        eyebrow="CONFIGURATION"
        title="Settings & infrastructure"
        description="Runtime information reported by the configured Aetheris environment."
        action={
          <button className="secondary-button" onClick={onRefresh}>
            <Icon name="refresh" size={15} /> Check status
          </button>
        }
      />
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SYSTEM STATUS</span>
            <h3>Infrastructure</h3>
          </div>
          <span className={`connection ${socketConnected ? "online" : ""}`}>
            <span />
            {socketConnected ? "Realtime connected" : "Realtime disconnected"}
          </span>
        </div>
        <div className="health-grid">
          <Health
            name="API"
            value={systemStatus.health?.ok ? "Healthy" : "Unavailable"}
          />
          <Health name="PostgreSQL" value={status(checks.database)} />
          <Health name="Redis" value={status(checks.redis)} />
          <Health name="Queue" value={status(checks.queue)} />
          <Health name="Worker" value="Not reported" muted />
        </div>
        <p className="field-help">
          Worker presence is not inferred: the current backend does not publish
          a heartbeat, so the UI reports only verifiable health data.
        </p>
      </section>
      <div className="settings-grid">
        <section className="panel setting-card">
          <span className="eyebrow">GENERAL</span>
          <h3>{project?.name || "No active project"}</h3>
          <p>
            Project ID {project?.id ?? "—"}. Workspace selection is stored only
            in this browser.
          </p>
        </section>
        <section className="panel setting-card">
          <span className="eyebrow">API</span>
          <h3>{API_URL}</h3>
          <p>
            Configured at dashboard build time through <code>VITE_API_URL</code>
            .
          </p>
        </section>
        <section className="panel setting-card">
          <span className="eyebrow">HANDLERS</span>
          <h3>{jobTypes.length} registered types</h3>
          <p>
            {jobTypes.map((item) => item.type).join(" · ") ||
              "Unable to read handler catalog"}
          </p>
        </section>
        <section className="panel setting-card">
          <span className="eyebrow">SECURITY</span>
          <h3>Tenant-scoped access</h3>
          <p>
            JWTs protect dashboard routes. Project API keys are hashed at rest
            and never returned after creation.
          </p>
        </section>
      </div>
    </>
  );
}

function Health({ name, value, muted }) {
  return (
    <div className={`health-item ${muted ? "muted" : ""}`}>
      <span
        className={`health-dot ${value === "Healthy" ? "healthy" : value === "Unavailable" ? "unavailable" : "unknown"}`}
      />
      <div>
        <strong>{name}</strong>
        <small>{value}</small>
      </div>
    </div>
  );
}

function ApiKeyReveal({ secret, onClose }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
    } catch {
      setError("Clipboard access failed. Select and copy the key manually.");
    }
  };
  return (
    <Modal title="Save your API key" onClose={onClose}>
      <div className="secret-warning">
        <Icon name="keys" />
        <div>
          <strong>This key is shown only once</strong>
          <p>Store it in a password manager or secrets vault before closing.</p>
        </div>
      </div>
      <label className="secret-field">
        {secret.projectName}
        <div>
          <code>{secret.value}</code>
          <button className="small-button" onClick={copy}>
            <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </label>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="primary-button" onClick={onClose}>
          I have saved this key
        </button>
      </div>
    </Modal>
  );
}
