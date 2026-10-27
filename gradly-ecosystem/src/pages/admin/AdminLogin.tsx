import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AdminLogin.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"
).trim().replace(/\/+$/, "").replace(/\/api$/i, "");

export default function AdminLogin() {
  const navigate = useNavigate();
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminCode: adminCode.trim(),
          password,
          deviceFingerprint: `web-${navigator.userAgent.slice(0, 80)}`,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) {
        throw new Error(result.message || "Unable to sign in. Check your Admin ID and password.");
      }

      localStorage.setItem("gradly_admin_token", result.token);
      setSuccess("Sign-in successful. Opening your admin workspace…");
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login-page">
      <header className="admin-login-topbar">
        <button type="button" className="admin-login-back" onClick={() => navigate("/admin")}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="admin-login-topbar-title">GRADLY ADMINISTRATION SYSTEM</div>
        <div className="admin-login-topbar-status">
          <span className="admin-login-status-dot" /> SECURE ACCESS
        </div>
      </header>

      <main className="admin-login-main">
        <section className="admin-login-card" aria-labelledby="admin-login-title">
          <div className="admin-login-brand">
            <div className="admin-login-logo">G</div>
            <div>
              <h1 id="admin-login-title">Admin Sign In</h1>
              <p>Sign in to your authorized Gradly administrator account.</p>
            </div>
          </div>

          <div className="admin-login-security">
            <div className="admin-login-security-icon"><ShieldCheck size={20} /></div>
            <div>
              <strong>Protected administrator access</strong>
              <span>Use the Admin ID and password issued for your approved account.</span>
            </div>
          </div>

          {error && (
            <div className="admin-login-message admin-login-error" role="alert">
              <strong>Sign-in failed</strong><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="admin-login-message admin-login-success" role="status">
              <strong>Welcome back</strong><span>{success}</span>
            </div>
          )}

          <form className="admin-login-form" onSubmit={handleSubmit}>
            <label className="admin-login-field">
              <span>ADMIN ID</span>
              <div className="admin-login-input-wrapper">
                <UserRound size={18} />
                <input
                  autoComplete="username"
                  value={adminCode}
                  onChange={(event) => setAdminCode(event.target.value)}
                  placeholder="Enter your Admin ID"
                  required
                  disabled={submitting}
                />
              </div>
            </label>

            <label className="admin-login-field">
              <span>PASSWORD</span>
              <div className="admin-login-input-wrapper">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="admin-login-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={submitting}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <div className="admin-login-forgot-row">
              <span>Authorized personnel only</span>
            </div>

            <button className="admin-login-submit" type="submit" disabled={submitting}>
              <KeyRound size={17} />
              {submitting ? "Signing in…" : "Sign In to Admin"}
            </button>
          </form>

          <div className="admin-login-apply">
            <span>Need administrator access?</span>
            <button type="button" className="admin-login-status-link" onClick={() => navigate("/admin/apply")}>
              Apply for Admin Access
            </button>
          </div>
        </section>
      </main>

      <footer className="admin-login-footer">
        <span>GRADLY · ADMINISTRATION SYSTEM</span>
        <span>Authorized access only</span>
      </footer>
    </div>
  );
}
