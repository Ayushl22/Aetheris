import Icon from "../common/Icon";

export default function Topbar({
  project,
  socketConnected,
  userEmail,
  onRefresh,
  projects,
  selectedProjectId,
  onProjectChange,
  onMenu
}) {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Icon name="menu" /></button>
        <div>
          <span className="eyebrow">AETHERIS / WORKSPACE</span>
          <h1>{project ? project.name : "Select a project"}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="topbar-project">
          <span className="sr-only">Current project</span>
          <select value={selectedProjectId} onChange={(event) => onProjectChange(event.target.value)} disabled={!projects.length}>
            {!projects.length && <option value="">No projects</option>}
            {projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh workspace" title="Refresh workspace">
          <Icon name="refresh" size={16} />
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
