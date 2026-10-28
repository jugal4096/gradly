import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithGoogle, auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import "./AdminLogin.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");

type PasswordRequest = {
  id: string;
  admin_code: string;
  status: string;
  review_note?: string | null;
  created_at?: string;
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [googleReady, setGoogleReady] = useState(false);
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [requestBusy, setRequestBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => setGoogleReady(Boolean(user))), []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: adminCode.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.token !== "string") throw new Error(data.message || "Unable to sign in.");
      localStorage.setItem("gradly_admin_token", data.token);
      setPassword("");
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the Gradly server.");
    } finally { setBusy(false); }
  }

  async function withGoogle() {
    setRequestBusy(true); setError(""); setNotice("");
    try {
      await signInWithGoogle();
      setGoogleReady(true);
      const user = auth.currentUser;
      if (!user) throw new Error("Google sign-in did not return a user.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/admin-password-requests/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load password requests.");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setNotice("Google account verified. You can submit a request or continue an approved request below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally { setRequestBusy(false); }
  }

  async function completeApprovedPasswordReset() {
    setRequestBusy(true); setError(""); setNotice("");
    try {
      if (newPassword.length < 12 || newPassword.length > 128) throw new Error("Choose a password between 12 and 128 characters.");
      if (newPassword !== confirmNewPassword) throw new Error("The new passwords do not match.");
      const user = auth.currentUser;
      if (!user) throw new Error("Verify the Google account first.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/admin-password-requests/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_code: adminCode.trim(), new_password: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not complete the approved reset.");
      setNewPassword(""); setConfirmNewPassword("");
      setNotice(data.message || "Password reset completed. Sign in with the new password.");
      const mine = await fetch(`${API_BASE}/admin-password-requests/mine`, { headers: { Authorization: `Bearer ${token}` } });
      const mineData = await mine.json().catch(() => ({}));
      setRequests(Array.isArray(mineData.requests) ? mineData.requests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the password reset.");
    } finally { setRequestBusy(false); }
  }

  async function submitPasswordRequest() {
    setRequestBusy(true); setError(""); setNotice("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in with Google first.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/admin-password-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ admin_code: adminCode.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not submit the request.");
      setNotice(data.message || "Password request submitted for Super Admin review.");
      const mine = await fetch(`${API_BASE}/admin-password-requests/mine`, { headers: { Authorization: `Bearer ${token}` } });
      const mineData = await mine.json().catch(() => ({}));
      setRequests(Array.isArray(mineData.requests) ? mineData.requests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the request.");
    } finally { setRequestBusy(false); }
  }



  return (
    <main className="admin-login-page">
      <header className="admin-login-topbar">
        <Link className="admin-login-back" to="/admin"><ArrowLeft size={16} /> Back</Link>
        <span className="admin-login-topbar-title">GRADLY ECOSYSTEM</span>
        <span className="admin-login-topbar-status"><i className="admin-login-status-dot" /> ADMIN ACCESS</span>
      </header>
      <div className="admin-login-layout">
        <section className="admin-login-story">
          <div className="admin-login-story-mark"><ShieldCheck size={25} /></div>
          <p className="admin-login-eyebrow">ACADEMIC OPERATIONS</p>
          <h1>Your work.<br /><span>Your institution.</span></h1>
          <p className="admin-login-story-copy">A dedicated workspace for approved administrators to manage academic workflows, curriculum requests, and student support.</p>
          <div className="admin-login-trust"><LockKeyhole size={17} /><span>Protected by role-based access and server-side authorization.</span></div>
        </section>
        <section className="admin-login-card">
          <div className="admin-login-brand">
            <div className="admin-login-logo">G</div>
            <div><h2>Admin sign in</h2><p>Use the credentials issued after approval.</p></div>
          </div>
          <div className="admin-login-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Sign in</button>
            <button type="button" className={mode === "forgot" ? "active" : ""} onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>Forgot password?</button>
          </div>
          {error && <div className="admin-login-alert error" role="alert">{error}</div>}
          {notice && <div className="admin-login-alert success" role="status">{notice}</div>}
          {mode === "login" ? (
            <form className="admin-login-form" onSubmit={submitLogin}>
              <label htmlFor="admin-code">Admin ID</label>
              <input id="admin-code" value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="Enter your Admin ID" autoComplete="username" required />
              <label htmlFor="admin-password">Password</label>
              <div className="admin-login-password">
                <input id="admin-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <button className="admin-login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to Admin"}</button>
            </form>
          ) : (
            <div className="admin-login-form">
              <p className="admin-login-help">Password recovery is reviewed by Super Admin. Verify the Google account linked to your active Admin account, then submit a request. Super Admin must approve the request first. After approval, verify your Google account here to set a new password.</p>
              <label htmlFor="recovery-admin-code">Admin ID</label>
              <input id="recovery-admin-code" value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="Enter your Admin ID" autoComplete="username" required />
              <button className="admin-login-google" type="button" onClick={withGoogle} disabled={requestBusy}><KeyRound size={17} /> {requestBusy ? "Please wait…" : googleReady ? "Verify / refresh Google session" : "Continue with Google"}</button>
              {googleReady && <button className="admin-login-submit" type="button" onClick={submitPasswordRequest} disabled={requestBusy || !adminCode.trim()}>{requestBusy ? "Submitting…" : "Submit password request"}</button>}
              {requests.some(request => request.status === "APPROVED") && <form className="admin-login-form admin-login-reset-form" onSubmit={event => { event.preventDefault(); void completeApprovedPasswordReset(); }}><div className="admin-login-request"><div><strong>Approved password reset</strong><span className="request-status approved">APPROVED</span></div><p>Set a new password for the Admin ID shown above. This form is available only after Super Admin approval.</p></div><label htmlFor="new-admin-password">New password</label><input id="new-admin-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 12 characters" required/><label htmlFor="confirm-admin-password">Confirm new password</label><input id="confirm-admin-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Re-enter new password" required/><button className="admin-login-submit" type="submit" disabled={requestBusy || !adminCode.trim()}>{requestBusy ? "Resetting…" : "Complete password reset"}</button></form>}
              {requests.map(request => <div className="admin-login-request" key={request.id}>
                <div><strong>{request.admin_code}</strong><span className={`request-status ${request.status.toLowerCase()}`}>{request.status.replaceAll("_", " ")}</span></div>
                {request.review_note && <p>{request.review_note}</p>}
                {request.status === "APPROVED" && <p>Approved. You can now set a new password below using this verified Google account.</p>}
              </div>)}
            </div>
          )}
          <div className="admin-login-divider"><span>NEW TO GRADLY ADMIN?</span></div>
          <Link className="admin-login-apply-link" to="/admin/apply">Apply for administrator access <span>→</span></Link>
          <p className="admin-login-footnote">Authorized personnel only · Your role is verified by Gradly's backend.</p>
        </section>
      </div>
      <footer className="admin-login-footer">GRADLY · DEVELOPMENT & ADMINISTRATION SYSTEM</footer>
    </main>
  );
}
