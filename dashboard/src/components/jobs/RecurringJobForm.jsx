import { useEffect, useState } from "react";

export default function RecurringJobForm({ project, onSubmit, submitting, jobTypes = [] }) {
  const [type, setType] = useState("");
  const [every, setEvery] = useState(60000);
  const [data, setData] = useState("{}");
  const [error, setError] = useState("");

  const selectedType = jobTypes.find((item) => item.type === type);
  useEffect(() => {
    if (!type && jobTypes[0]) setType(jobTypes[0].type);
  }, [jobTypes, type]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    let parsed;
    try {
      parsed = JSON.parse(data || "{}");
    } catch {
      setError("Recurring job data must be valid JSON.");
      return;
    }

    if (!type.trim() || !every || every < 1000) {
      setError("Enter a job type and an interval of at least 1000 ms.");
      return;
    }

    const ok = await onSubmit({
      projectId: project?.id,
      type: type.trim(),
      data: parsed,
      every: Number(every)
    });

    if (ok) {
      setType(jobTypes[0]?.type || "");
      setData("{}");
    }
  };

  return (
    <form className="compact-form" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">SCHEDULER</span>
          <h2>Recurring job</h2>
        </div>
      </div>

      <label>
        Job type
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {jobTypes.map((item) => <option value={item.type} key={item.type}>{item.label} · {item.type}</option>)}
        </select>
      </label>

      {selectedType && <p className="field-help">{selectedType.description}</p>}

      <label>
        Every (milliseconds)
        <input
          type="number"
          min="1000"
          value={every}
          onChange={(event) => setEvery(event.target.value)}
        />
      </label>

      <label>
        Data
        <textarea rows={5} value={data} onChange={(event) => setData(event.target.value)} />
      </label>

      {error && <div className="form-error">{error}</div>}

      <button className="primary-button" disabled={!project || submitting}>
        {submitting ? "Scheduling..." : "Schedule recurring"}
      </button>
    </form>
  );
}
