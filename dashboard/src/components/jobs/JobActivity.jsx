export default function JobActivity({ jobs }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: jobs.filter((job) => {
        const created = new Date(job.created_at);
        return created >= date && created < next;
      }).length
    };
  });
  const max = Math.max(...days.map((day) => day.count), 1);
  return (
    <div className="activity-chart" aria-label="Jobs created in the last seven days">
      {days.map((day) => (
        <div className="activity-column" key={day.label} title={`${day.count} jobs`}>
          <span>{day.count || ""}</span>
          <div><i style={{ height: `${Math.max(5, (day.count / max) * 100)}%` }} /></div>
          <small>{day.label}</small>
        </div>
      ))}
    </div>
  );
}
