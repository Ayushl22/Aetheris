export default function Topbar({
  project,
  socketConnected,
  userEmail,
  onRefresh
}) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">CONTROL PLANE</span>
        <h1>{project ? project.name : "Dashboard"}</h1>
      </div>

      <div className="topbar-actions">
        <button className="secondary-button" onClick={onRefresh}>
          ↻ Refresh
        </button>
        <span className={`connection ${socketConnected ? "online" : ""}`}>
          <span />
          {socketConnected ? "Realtime" : "Offline"}
        </span>
        <div className="user-chip">
          <span>{userEmail?.charAt(0)?.toUpperCase() || "U"}</span>
          {userEmail}
        </div>
      </div>
    </header>
  );
}