export default function JobStats({ jobs, dlqCount = 0 }) {
  const count = (status) =>
    jobs.filter((job) => String(job.status).toUpperCase() === status).length;

  const cards = [
    ["Total jobs", jobs.length, "neutral"],
    ["Queued", count("QUEUED") + count("WAITING") + count("DELAYED") + count("PENDING"), "queued"],
    ["Processing", count("PROCESSING"), "processing"],
    ["Retrying", count("RETRYING"), "retrying"],
    ["Completed", count("COMPLETED"), "completed"],
    ["Failed", count("FAILED"), "failed"],
    ["Dead letter", dlqCount, "dlq"]
  ];

  return (
    <div className="stats-grid">
      {cards.map(([label, value, tone]) => (
        <div className={`stat-card stat-${tone}`} key={label}>
          <div className="stat-card-top"><span>{label}</span><i /></div>
          <strong>{value.toLocaleString()}</strong>
          <small>Current project</small>
        </div>
      ))}
    </div>
  );
}
