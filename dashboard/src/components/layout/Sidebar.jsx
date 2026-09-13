import { NAV_ITEMS } from "../../utils/constants";

export default function Sidebar({ active, onChange, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <strong>Aetheris</strong>
          <span>Distributed Scheduler</span>
        </div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? "active" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="architecture-mini">
          <span className="live-dot" />
          <div>
            <strong>System online</strong>
            <small>Redis · BullMQ · PostgreSQL</small>
          </div>
        </div>

        <button className="logout-button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}