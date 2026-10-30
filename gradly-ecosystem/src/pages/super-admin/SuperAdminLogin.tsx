import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Fingerprint, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  setToken,
  verifySession,
} from "../../lib/superAdminSession";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import "./SuperAdminLogin.css";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; authorizationRequired?: boolean } | null;
  const from = locationState?.from ?? "/super-admin";
  const authorizationRequired = locationState?.authorizationRequired === true;

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
        // A temporary session-verification failure should not leave the login screen stuck.
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, from]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }
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
            ? "Too many attempts. Please wait and try again."
            : result?.message ?? "Login failed. Check your credentials and try again."
        );
        return;
      }

      setToken(token);
      setPassword("");
      navigate(from, { replace: true });
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="super-login-checking">
        <span className="super-login-loader" />
        <p>Securing your session…</p>
      </div>
    );
  }

  return (
    <main className="super-login-page">
      <div className="super-login-glow super-login-glow-one" />
      <div className="super-login-glow super-login-glow-two" />
      <header className="super-login-topbar">
        <button className="super-login-back" type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={16} /> <span>Back to ecosystem</span>
        </button>
        <div className="super-login-top-brand">
          <span className="super-login-top-mark">G</span>
          <span>GRADLY <small>ECOSYSTEM</small></span>
        </div>
        <div className="super-login-secure"><span /> SECURE ACCESS</div>
      </header>

      <section className="super-login-layout">
        <div className="super-login-story">
          <div className="super-login-kicker"><Sparkles size={14} /> CENTRAL ADMINISTRATION</div>
          <h1>One ecosystem.<br /><span>Complete control.</span></h1>
          <p className="super-login-story-copy">
            Manage institutions, administrators, academic data and platform activity from one secure command centre.
          </p>
          <div className="super-login-feature-list">
            <div className="super-login-feature">
              <span className="super-login-feature-icon"><ShieldCheck size={19} /></span>
              <div><strong>Protected by design</strong><p>Secure access for authorised super administrators.</p></div>
            </div>
            <div className="super-login-feature">
              <span className="super-login-feature-icon"><Fingerprint size={19} /></span>
              <div><strong>System-wide oversight</strong><p>One place to oversee your Gradly ecosystem.</p></div>
            </div>
          </div>
          <div className="super-login-decoration" aria-hidden="true">
            <div className="super-login-orbit super-login-orbit-a" />
            <div className="super-login-orbit super-login-orbit-b" />
            <div className="super-login-orbit-core"><ShieldCheck size={34} /></div>
            <span className="super-login-orbit-node node-a" />
            <span className="super-login-orbit-node node-b" />
            <span className="super-login-orbit-node node-c" />
          </div>
        </div>

        <div className="super-login-card-wrap">
          <form className="super-login-card" onSubmit={handleSubmit}>
            <div className="super-login-card-symbol"><LockKeyhole size={22} /></div>
            <div className="super-login-card-eyebrow">ADMINISTRATOR PORTAL</div>
            <h2>Welcome back</h2>
            <p className="super-login-card-subtitle">Sign in to continue to your control centre.</p>

            <label className="super-login-field">
              <span>Super Admin code</span>
              <input
                type="text"
                placeholder="Enter your admin code"
                autoComplete="username"
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
                required
              />
            </label>

            <label className="super-login-field">
              <span>Password</span>
              <div className="super-login-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="super-login-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {authorizationRequired && <p className="super-login-error" role="alert">The previous session was not authorized for Super Admin access. Sign in with an authorized account.</p>}
            {error && <p className="super-login-error" role="alert">{error}</p>}

            <button className="super-login-submit" type="submit" disabled={submitting}>
              {submitting ? <><span className="super-login-button-spinner" /> Verifying access…</> : <>Sign in securely <ArrowLeft className="super-login-submit-arrow" size={17} /></>}
            </button>

            <div className="super-login-card-note"><ShieldCheck size={15} /> Your session is verified before access is granted.</div>
          </form>
          <p className="super-login-legal">Authorised personnel only. All access is subject to system security controls.</p>
        </div>
      </section>

      <footer className="super-login-footer">
        <span>© Gradly Ecosystem</span>
        <span><span className="super-login-footer-dot" /> SYSTEM ACCESS GATEWAY</span>
      </footer>
    </main>
  );
}
