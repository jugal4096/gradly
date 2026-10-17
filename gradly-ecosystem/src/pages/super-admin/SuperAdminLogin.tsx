import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  API_BASE_URL,
  setToken,
  verifySession,
} from "../../lib/superAdminSession";

import "./SuperAdminLogin.css";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? "/super-admin";

  const [checking, setChecking] = useState(true);
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    verifySession()
      .then((status) => {
        if (cancelled) return;
        if (status === "valid") navigate(from, { replace: true });
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, from]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/super-admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: adminCode.trim(), password }),
      });

      const result = await response.json().catch(() => null);
      const token: unknown = result?.token ?? result?.accessToken;

      if (!response.ok || typeof token !== "string") {
        setError(
          response.status === 429
            ? "Too many attempts. Please wait a moment before trying again."
            : result?.message ?? "We couldn't verify those credentials. Please try again."
        );
        return;
      }

      setToken(token);
      setPassword("");
      navigate(from, { replace: true });
    } catch {
      setError("Couldn't connect to Gradly. Check the server connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="super-login-page super-login-page--checking">
        <div className="super-login-checking-card" role="status" aria-live="polite">
          <span className="super-login-spinner" aria-hidden="true" />
          <strong>Verifying secure session</strong>
          <span>Please wait while Gradly checks your access.</span>
        </div>
      </main>
    );
  }

  return (
    <main className="super-login-page">
      <header className="super-login-topbar">
        <button
          type="button"
          className="super-login-back"
          onClick={() => navigate("/")}
          aria-label="Back to Gradly home"
        >
          <ArrowLeft size={16} />
          <span>Back to Gradly</span>
        </button>

        <div className="super-login-topbar-status">
          <span className="super-login-status-dot" />
          <span>SECURE ACCESS PORTAL</span>
        </div>
      </header>

      <section className="super-login-workspace" aria-labelledby="super-login-title">
        <div className="super-login-glow super-login-glow--one" aria-hidden="true" />
        <div className="super-login-glow super-login-glow--two" aria-hidden="true" />

        <div className="super-login-layout">
          <aside className="super-login-intro">
            <div className="super-login-brand">
              <span className="super-login-brand-mark" aria-hidden="true">G</span>
              <span className="super-login-brand-copy">
                <strong>GRADLY</strong>
                <small>ECOSYSTEM</small>
              </span>
            </div>

            <div className="super-login-intro-copy">
              <span className="super-login-eyebrow">
                <Sparkles size={14} />
                THE CONTROL CENTER
              </span>
              <h1>One platform.<br /><span>Every possibility.</span></h1>
              <p>
                Manage the Gradly ecosystem from one secure place. Your
                administrative tools and platform insights are just a sign-in away.
              </p>
            </div>

            <div className="super-login-trust-card">
              <span className="super-login-trust-icon"><ShieldCheck size={20} /></span>
              <span>
                <strong>Protected by design</strong>
                <small>Restricted access for authorized administrators only.</small>
              </span>
              <span className="super-login-trust-indicator" aria-hidden="true" />
            </div>

            <div className="super-login-intro-footer">
              <span>GRADLY / SYSTEMS</span>
              <span>BUILT FOR BETTER LEARNING</span>
            </div>
          </aside>

          <section className="super-login-panel" aria-label="Super Admin sign in">
            <div className="super-login-panel-heading">
              <div className="super-login-panel-icon"><LockKeyhole size={21} /></div>
              <span className="super-login-kicker">ADMINISTRATOR AUTHENTICATION</span>
              <h2 id="super-login-title">Welcome back</h2>
              <p>Sign in with your Super Admin credentials to continue.</p>
            </div>

            <form className="super-login-form" onSubmit={handleSubmit}>
              <div className="super-login-field">
                <label htmlFor="super-admin-code">ADMIN CODE</label>
                <div className="super-login-input-wrapper">
                  <input
                    id="super-admin-code"
                    name="adminCode"
                    type="text"
                    placeholder="Enter your admin code"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={adminCode}
                    onChange={(event) => setAdminCode(event.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="super-login-field">
                <div className="super-login-label-row">
                  <label htmlFor="super-admin-password">PASSWORD</label>
                  <span>Keep your credentials private</span>
                </div>
                <div className="super-login-input-wrapper">
                  <input
                    id="super-admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    disabled={submitting}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="super-login-error" role="alert">
                  <strong>Sign-in unsuccessful</strong>
                  <span>{error}</span>
                </div>
              )}

              <button className="super-login-submit" type="submit" disabled={submitting}>
                <span>{submitting ? "VERIFYING ACCESS…" : "SIGN IN SECURELY"}</span>
                {submitting && <span className="super-login-button-spinner" aria-hidden="true" />}
              </button>
            </form>

            <div className="super-login-panel-footer">
              <ShieldCheck size={14} />
              <span>Your session is verified before access is granted.</span>
            </div>
          </section>
        </div>
      </section>

      <footer className="super-login-footer">
        <span>© {new Date().getFullYear()} GRADLY ECOSYSTEM</span>
        <span>SUPER ADMIN ACCESS <i aria-hidden="true">•</i> PRIVATE &amp; SECURE</span>
      </footer>
    </main>
  );
}
