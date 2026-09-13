export default function JobStats({ jobs }) {
  const count = (status) =>
    jobs.filter((job) => String(job.status).toUpperCase() === status).length;

  const cards = [
    ["Total", jobs.length],
    ["Queued", count("QUEUED") + count("WAITING")],
    ["Processing", count("PROCESSING")],
    ["Completed", count("COMPLETED")],
    ["Failed", count("FAILED")]
  ];

  return (
    <div className="stats-grid">
      {cards.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}