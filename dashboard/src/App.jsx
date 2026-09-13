import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import "./styles/app.css";

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const [section, setSection] = useState("dashboard");
  const [authView, setAuthView] = useState("landing");

  useEffect(() => {
    if (!isAuthenticated) {
      setSection("dashboard");
      setAuthView("landing");
    }
  }, [isAuthenticated]);

  if (loading) {
    return <div className="app-loading">Loading Aetheris...</div>;
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        view={authView}
        onViewChange={setAuthView}
      />
    );
  }

  return (
    <DashboardPage
      section={section}
      onSectionChange={setSection}
    />
  );
}
