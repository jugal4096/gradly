import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import "./AdminLogin.css";

import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ adminCode: adminCode.trim(), password }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.token !== "string") {
        setError(response.status === 423
          ? result?.message ?? "Your account is temporarily locked. Please try again later."
          : result?.message ?? "Unable to sign in with those credentials.");
        return;
      }
      localStorage.setItem("gradly_admin_token", result.token);
      if (result.admin) localStorage.setItem("gradly_admin_profile", JSON.stringify(result.admin));
      if (result.permissions) localStorage.setItem("gradly_admin_permissions", JSON.stringify(result.permissions));
      setPassword("");
      navigate("/admin/dashboard", { replace: true });
    } catch {
      setError("Could not reach the Gradly server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login-page">
      <header className="admin-login-topbar">
        <button className="admin-login-back" type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="admin-login-topbar-title">GRADLY ECOSYSTEM</div>
        <div className="admin-login-topbar-status"><span className="admin-login-status-dot" />SECURE ADMIN ACCESS</div>
      </header>
      <main className="admin-login-main">
        <section className="admin-login-card">
          <div className="admin-login-brand">
            <div className="admin-login-logo"><ShieldCheck size={30} /></div>
            <div><h1>Admin sign in</h1><p>Authorized institution and branch administrators</p></div>
          </div>
          <div className="admin-login-security">
            <div className="admin-login-security-icon"><LockKeyhole size={20} /></div>
            <div><strong>Protected administration portal</strong><span>Sign in with the admin credentials assigned to your account.</span></div>
          </div>
          <form className="admin-login-form" onSubmit={handleSubmit}>
            <label className="admin-login-field">
              <span>Admin ID</span>
              <input className="admin-login-input-wrapper" type="text" name="adminCode" autoComplete="username" placeholder="Enter your admin ID" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} required />
            </label>
            <label className="admin-login-field">
              <span>Password</span>
              <input className="admin-login-input-wrapper" type="password" name="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error && <div className="admin-login-error" role="alert">{error}</div>}
            <button className="admin-login-submit" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in to Admin Portal"}</button>
          </form>
          <div className="admin-login-apply"><span>Need administrative access?</span><button type="button" onClick={() => navigate("/admin/apply")}>Apply for Admin Access</button></div>
        </section>
      </main>
      <footer className="admin-login-footer"><span>GRADLY ECOSYSTEM</span><span>Administrative access is monitored and permission-controlled.</span></footer>
    </div>
  );
}
