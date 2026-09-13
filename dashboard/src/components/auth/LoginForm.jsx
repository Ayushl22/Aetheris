import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LoginForm({
  initialMode = "login",
  onBack,
  onSwitchMode
}) {
  const { login, register, loading } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setMode(initialMode);
    setError("");
    setSuccess("");
    setPassword("");
  }, [initialMode]);

  const changeMode = (nextMode) => {
    if (loading) return;
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    onSwitchMode?.(nextMode);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (mode === "register") {
        if (!name.trim()) {
          setError("Name is required.");
          return;
        }

        await register(name, email, password);
        return;
      }

      await login(email, password);
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    }
  };

  const isRegister = mode === "register";

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <button
        type="button"
        className="auth-back"
        onClick={onBack}
        disabled={loading}
      >
        <span aria-hidden="true">←</span>
        Back
      </button>

      <div className="auth-panel-heading">
        <span className="auth-panel-kicker">
          {isRegister ? "GET STARTED" : "WELCOME BACK"}
        </span>
        <h1 id="auth-title">
          {isRegister ? "Create your account" : "Sign in to Aetheris"}
        </h1>
        <p>
          {isRegister
            ? "Create your control plane and start managing background work."
            : "Access your jobs, workers, projects, and system activity."}
        </p>
      </div>

      <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          className={!isRegister ? "active" : ""}
          onClick={() => changeMode("login")}
          disabled={loading}
        >
          Sign in
        </button>
        <button
          type="button"
          className={isRegister ? "active" : ""}
          onClick={() => changeMode("register")}
          disabled={loading}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate>
        {isRegister && (
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={100}
              required
              autoFocus
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            autoFocus={!isRegister}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={1}
            required
          />
        </label>

        {error && (
          <div className="form-error auth-form-message" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="form-success auth-form-message" role="status">
            {success}
          </div>
        )}

        <button
          type="submit"
          className="primary-button auth-submit"
          disabled={loading}
        >
          {loading
            ? isRegister
              ? "Creating account..."
              : "Signing in..."
            : isRegister
              ? "Create account"
              : "Sign in"}
          {!loading && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <div className="auth-security-note">
        <span aria-hidden="true">◈</span>
        Your session is protected with JWT authentication.
      </div>
    </section>
  );
}
