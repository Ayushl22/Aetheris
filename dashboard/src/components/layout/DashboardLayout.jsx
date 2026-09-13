import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout({
  active,
  onChange,
  onLogout,
  project,
  socketConnected,
  userEmail,
  onRefresh,
  children
}) {
  return (
    <div className="shell">
      <Sidebar active={active} onChange={onChange} onLogout={onLogout} />
      <main className="main">
        <Topbar
          project={project}
          socketConnected={socketConnected}
          userEmail={userEmail}
          onRefresh={onRefresh}
        />
        <div className="content">{children}</div>
      </main>
    </div>
  );
}