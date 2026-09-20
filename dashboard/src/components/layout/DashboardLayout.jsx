import { useState } from "react";
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
  projects,
  selectedProjectId,
  onProjectChange,
  systemStatus,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="shell">
      <Sidebar
        active={active}
        onChange={(value) => {
          onChange(value);
          setMobileOpen(false);
        }}
        onLogout={onLogout}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        systemStatus={systemStatus}
      />
      <main className="main">
        <Topbar
          project={project}
          socketConnected={socketConnected}
          userEmail={userEmail}
          onRefresh={onRefresh}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={onProjectChange}
          onMenu={() => setMobileOpen(true)}
        />
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
