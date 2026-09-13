import { useState } from "react";
import { PRIORITIES } from "../../utils/constants";

export default function JobForm({ onSubmit, project, submitting }) {
  const [type, setType] = useState("");
  const [data, setData] = useState('{\n  "message": "Hello Aetheris"\n}');
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    let parsed;
    try {
      parsed = data.trim() ? JSON.parse(data) : {};
    } catch {
      setError("Job data must be valid JSON.");
      return;
    }

    if (!type.trim()) {
      setError("Job type is required.");
      return;
    }

    const ok = await onSubmit({
      type: type.trim(),
      data: parsed,
      priority
    });

    if (ok) {
      setType("");
      setData('{\n  "message": "Hello Aetheris"\n}');
      setPriority("MEDIUM");
    }
  };

  return (
    <form className="job-form" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">QUEUE</span>
          <h2>Submit a job</h2>
        </div>
        <span className="project-pill">
          {project ? project.name : "Select a project"}
        </span>
      </div>

      <div className="form-grid">
        <label>
          Job type
          <input
            value={type}
            onChange={(event) => setType(event.target.value)}
            placeholder="email"
            required
          />
        </label>

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
      </div>

      <label>
        Job data
        <textarea
          value={data}
          onChange={(event) => setData(event.target.value)}
          rows={8}
          spellCheck="false"
        />
      </label>

      {error && <div className="form-error">{error}</div>}

      <button className="primary-button" disabled={!project || submitting}>
        {submitting ? "Submitting..." : "Submit job"}
      </button>
    </form>
  );
}