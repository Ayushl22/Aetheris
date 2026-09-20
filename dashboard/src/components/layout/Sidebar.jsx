import { NAV_ITEMS } from "../../utils/constants";
import Icon from "../common/Icon";
import AetherisLogo from "../common/AetherisLogo";

export default function Sidebar({
  active,
  onChange,
  onLogout,
  open,
  onClose,
  systemStatus,
}) {
  const groups = [...new Set(NAV_ITEMS.map((item) => item.group))];
  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? "mobile-open" : ""}`}>
        <div className="brand">
          <AetherisLogo size={36} wordmark tagline className="sidebar-logo" />
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-label">{group}</span>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${active === item.id ? "active" : ""}`}
                  onClick={() => onChange(item.id)}
                  aria-current={active === item.id ? "page" : undefined}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="architecture-mini">
            <span
              className={`live-dot ${systemStatus === false ? "offline" : systemStatus === null ? "checking" : ""}`}
            />
            <div>
              <strong>
                {systemStatus === null
                  ? "Checking systems"
                  : systemStatus
                    ? "All systems operational"
                    : "System status unavailable"}
              </strong>
              <small>
                {systemStatus
                  ? "API · Redis · PostgreSQL"
                  : "Open Settings for details"}
              </small>
            </div>
          </div>

          <button className="logout-button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
