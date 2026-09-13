import LoginForm from "../components/auth/LoginForm";

function AetherisMark() {
  return (
    <div className="auth-mark" aria-hidden="true">
      A
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`auth-brand ${compact ? "auth-brand-compact" : ""}`}>
      <AetherisMark />
      <div>
        <div className="auth-brand-name">Aetheris</div>
        <div className="auth-brand-subtitle">Distributed Job Scheduler</div>
      </div>
    </div>
  );
}

function Landing({ onViewChange }) {
  return (
    <main className="auth-page">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

      <div className="auth-shell">
        <header className="auth-header">
          <Brand />
          <div className="auth-header-status">
            <span className="auth-status-dot" />
            Control plane ready
          </div>
        </header>

        <section className="auth-hero" aria-labelledby="aetheris-title">
          <div className="auth-hero-copy">
            <div className="auth-kicker">
              <span />
              CONTROL PLANE
            </div>

            <h1 id="aetheris-title">
              Run work without
              <span> losing control.</span>
            </h1>

            <p>
              Aetheris gives your background work a reliable home — queue,
              schedule, retry, and observe jobs from one focused control plane.
            </p>

            <div className="auth-actions">
              <button
                type="button"
                className="auth-button auth-button-primary"
                onClick={() => onViewChange("login")}
              >
                Sign in
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="auth-button auth-button-secondary"
                onClick={() => onViewChange("register")}
              >
                Create account
              </button>
            </div>

            <div className="auth-trust">
              <span className="auth-trust-line" />
              <span>Built for developers who ship background work.</span>
            </div>
          </div>

          <div className="auth-visual" aria-hidden="true">
            <div className="auth-console">
              <div className="auth-console-top">
                <div className="auth-console-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="auth-console-label">AETHERIS / CONTROL</span>
                <span className="auth-console-live">LIVE</span>
              </div>

              <div className="auth-console-body">
                <div className="auth-console-heading">
                  <div>
                    <small>QUEUE HEALTH</small>
                    <strong>99.98%</strong>
                  </div>
                  <div className="auth-console-pulse">
                    <i />
                    Healthy
                  </div>
                </div>

                <div className="auth-mini-chart">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="auth-job-list">
                  <div>
                    <span className="auth-job-icon auth-job-icon-indigo">↗</span>
                    <div>
                      <strong>process-webhook</strong>
                      <small>Worker 03 · 128ms</small>
                    </div>
                    <em className="auth-job-success">completed</em>
                  </div>
                  <div>
                    <span className="auth-job-icon auth-job-icon-amber">◷</span>
                    <div>
                      <strong>generate-report</strong>
                      <small>Worker 01 · queued</small>
                    </div>
                    <em className="auth-job-warning">queued</em>
                  </div>
                  <div>
                    <span className="auth-job-icon auth-job-icon-green">✓</span>
                    <div>
                      <strong>sync-customers</strong>
                      <small>Worker 02 · 241ms</small>
                    </div>
                    <em className="auth-job-success">completed</em>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-floating-card auth-floating-card-top">
              <span className="auth-floating-icon">↻</span>
              <div>
                <small>RETRY POLICY</small>
                <strong>Exponential backoff</strong>
              </div>
            </div>

            <div className="auth-floating-card auth-floating-card-bottom">
              <span className="auth-floating-icon auth-floating-icon-green">●</span>
              <div>
                <small>WORKERS</small>
                <strong>3 online · 0 stalled</strong>
              </div>
            </div>
          </div>
        </section>

        <footer className="auth-footer">
          <span>QUEUE</span>
          <i />
          <span>RETRY</span>
          <i />
          <span>SCHEDULE</span>
          <i />
          <span>OBSERVE</span>
        </footer>
      </div>
    </main>
  );
}

export default function LoginPage({ view = "landing", onViewChange }) {
  if (view === "landing") {
    return <Landing onViewChange={onViewChange} />;
  }

  return (
    <main className="auth-page auth-form-page">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

      <div className="auth-form-shell">
        <div className="auth-form-brand-row">
          <Brand compact />
        </div>

        <LoginForm
          initialMode={view}
          onBack={() => onViewChange("landing")}
          onSwitchMode={onViewChange}
        />

        <div className="auth-form-footer">
          Aetheris · Distributed Job Scheduler
        </div>
      </div>
    </main>
  );
}
