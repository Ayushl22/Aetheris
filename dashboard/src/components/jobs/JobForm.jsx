import { useEffect, useMemo, useState } from "react";
import { PRIORITIES } from "../../utils/constants";
import { safeJson } from "../../utils/formatters";

export default function JobForm({
  onSubmit,
  project,
  submitting,
  jobTypes,
  initialMode = "immediate",
}) {
  const [type, setType] = useState("");
  const [data, setData] = useState("{}");
  const [priority, setPriority] = useState("MEDIUM");
  const [mode, setMode] = useState(initialMode);
  const [delay, setDelay] = useState(5000);
  const [error, setError] = useState("");
  const selectedType = useMemo(
    () => jobTypes.find((item) => item.type === type),
    [jobTypes, type],
  );

  useEffect(() => {
    if (!type && jobTypes[0]) setType(jobTypes[0].type);
  }, [jobTypes, type]);

  useEffect(() => {
    if (selectedType) setData(safeJson(selectedType.example));
  }, [selectedType]);

  const formatPayload = () => {
    try {
      setData(JSON.stringify(JSON.parse(data || "{}"), null, 2));
      setError("");
    } catch {
      setError("Payload must be valid JSON before it can be formatted.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    let parsed;
    try {
      parsed = JSON.parse(data || "{}");
    } catch {
      setError("Payload must be a valid JSON object.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("Payload must be a JSON object.");
      return;
    }
    if (!selectedType) {
      setError("Select a supported job type.");
      return;
    }
    const missing = selectedType.fields.filter(
      (field) =>
        field.required &&
        (parsed[field.name] === undefined || parsed[field.name] === ""),
    );
    if (missing.length) {
      setError(
        `Required payload field missing: ${missing.map((field) => field.name).join(", ")}`,
      );
      return;
    }
    const delayNumber = Number(delay);
    if (
      mode === "delayed" &&
      (!Number.isInteger(delayNumber) || delayNumber < 1)
    ) {
      setError("Delay must be a positive number of milliseconds.");
      return;
    }
    await onSubmit(
      {
        type,
        data: parsed,
        priority,
        ...(mode === "delayed" ? { delay: delayNumber } : {}),
      },
      mode,
    );
  };

  return (
    <form className="job-composer" onSubmit={submit}>
      <div className="composer-header">
        <div>
          <span className="eyebrow">CREATE JOB</span>
          <h2>Dispatch work</h2>
          <p>Choose a registered handler and provide its payload.</p>
        </div>
        <span className="project-pill">
          {project?.name || "Select a project"}
        </span>
      </div>

      <div className="segmented-control" aria-label="Job timing">
        <button
          type="button"
          className={mode === "immediate" ? "active" : ""}
          onClick={() => setMode("immediate")}
        >
          Run now
        </button>
        <button
          type="button"
          className={mode === "delayed" ? "active" : ""}
          onClick={() => setMode("delayed")}
        >
          Run later
        </button>
      </div>

      <div className="composer-grid">
        <div className="composer-main">
          <label>
            Job type
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {jobTypes.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label} · {item.type}
                </option>
              ))}
            </select>
          </label>
          {selectedType && (
            <div className="type-help">
              <strong>{selectedType.label}</strong>
              <p>{selectedType.description}</p>
              {selectedType.fields.length > 0 && (
                <ul>
                  {selectedType.fields.map((field) => (
                    <li key={field.name}>
                      <code>{field.name}</code>
                      {field.required ? " required" : " optional"}
                      {field.description ? ` — ${field.description}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <label>
            JSON payload
            <div className="editor-shell">
              <div className="editor-toolbar">
                <span>payload.json</span>
                <button type="button" onClick={formatPayload}>
                  Format JSON
                </button>
              </div>
              <textarea
                value={data}
                onChange={(event) => setData(event.target.value)}
                rows={12}
                spellCheck="false"
                aria-describedby="payload-help"
              />
            </div>
          </label>
          <small id="payload-help" className="field-help">
            Only data is submitted. Aetheris never evaluates payloads as code.
          </small>
        </div>
        <aside className="composer-aside">
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {PRIORITIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          {mode === "delayed" && (
            <label>
              Delay (ms)
              <input
                type="number"
                min="1"
                value={delay}
                onChange={(event) => setDelay(event.target.value)}
              />
            </label>
          )}
          <div className="submission-summary">
            <span>Project</span>
            <strong>{project?.name || "Not selected"}</strong>
            <span>Execution</span>
            <strong>
              {mode === "delayed" ? `After ${delay || 0} ms` : "Immediately"}
            </strong>
            <span>Retries</span>
            <strong>Up to 3 attempts</strong>
          </div>
          <button
            className="primary-button full"
            disabled={!project || submitting || !jobTypes.length}
          >
            {submitting
              ? "Dispatching…"
              : mode === "delayed"
                ? "Schedule job"
                : "Dispatch job"}
          </button>
        </aside>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
