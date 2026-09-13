import { useState } from "react";

export default function RecurringJobForm({ project, onSubmit, submitting }) {
  const [type, setType] = useState("");
  const [every, setEvery] = useState(60000);
  const [data, setData] = useState("{}");
  const [error, setError] = useState("");

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
      setType("");
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
        <input value={type} onChange={(e) => setType(e.target.value)} placeholder="heartbeat" />
      </label>

      <label>
        Every (milliseconds)
        <input
          type="number"
          min="1000"
          value={every}
          onChange={(e) => setEvery(e.target.value)}
        />
      </label>

      <label>
        Data
        <textarea rows={5} value={data} onChange={(e) => setData(e.target.value)} />
      </label>

      {error && <div className="form-error">{error}</div>}

      <button className="primary-button" disabled={!project || submitting}>
        {submitting ? "Scheduling..." : "Schedule recurring"}
      </button>
    </form>
  );
}