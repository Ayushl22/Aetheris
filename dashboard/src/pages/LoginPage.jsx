import LoginForm from "../components/auth/LoginForm";
import AetherisLogo from "../components/common/AetherisLogo";

function Brand({ compact = false }) {
  return (
    <div className={`auth-brand ${compact ? "auth-brand-compact" : ""}`}>
      <AetherisLogo size={compact ? 34 : 42} wordmark tagline />
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
            Durable by design
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
                <span className="auth-console-live">ARCHITECTURE</span>
              </div>

              <div className="auth-console-body">
                <div className="auth-console-heading">
                  <div>
                    <small>DELIVERY MODEL</small>
                    <strong>Database first</strong>
                  </div>
                  <div className="auth-console-pulse">
                    <i />
                    Explicit handlers
                  </div>
                </div>

                <div className="auth-job-list">
                  <div>
                    <span className="auth-job-icon auth-job-icon-indigo">01</span>
                    <div>
                      <strong>Persist</strong>
                      <small>PostgreSQL system of record</small>
                    </div>
                    <em>accepted</em>
                  </div>
                  <div>
                    <span className="auth-job-icon auth-job-icon-amber">02</span>
                    <div>
                      <strong>Dispatch</strong>
                      <small>BullMQ delivery and scheduling</small>
                    </div>
                    <em>queued</em>
                  </div>
                  <div>
                    <span className="auth-job-icon auth-job-icon-green">03</span>
                    <div>
                      <strong>Execute</strong>
                      <small>Registered worker handlers</small>
                    </div>
                    <em>observed</em>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-floating-card auth-floating-card-top">
              <span className="auth-floating-icon">↻</span>
              <div>
                <small>RETRIES</small>
                <strong>Exponential backoff</strong>
              </div>
            </div>

            <div className="auth-floating-card auth-floating-card-bottom">
              <span className="auth-floating-icon auth-floating-icon-green">●</span>
              <div>
                <small>SAFETY</small>
                <strong>Data, never executable code</strong>
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
          Aetheris · Reliable background infrastructure.
        </div>
      </div>
    </main>
  );
}
