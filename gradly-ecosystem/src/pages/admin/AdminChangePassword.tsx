import { FormEvent, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AdminChangePassword.css";

const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";

export default function AdminChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return; }
    if (newPassword.length < 12) { setError("Use at least 12 characters for your new password."); return; }
    const token = localStorage.getItem("gradly_admin_token");
    if (!token) { setError("Your Admin session is missing. Sign in again."); return; }
    setLoading(true);
    try {
      const response = await fetch(API_ROOT + "/admin/change-password", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, Accept: "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "PASSWORD_EXPIRED") { localStorage.removeItem("gradly_admin_token"); navigate("/admin/apply?tab=password", { replace: true }); return; }
        throw new Error(data.message || "Unable to change password.");
      }
      setNotice(data.message || "Password changed successfully."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to change password."); }
    finally { setLoading(false); }
  }

  return <main className="admin-change-password-page"><section className="admin-change-password-card">
    <button className="acp-back" type="button" onClick={() => navigate("/admin/dashboard")}><ArrowLeft size={16}/> Back to dashboard</button>
    <div className="acp-brand"><img src="/gradly-ecosystem-logo.png" alt="Gradly"/><span>GRADLY<small>Institution administration</small></span></div>
    <div className="acp-icon"><KeyRound size={23}/></div><p className="acp-kicker">ACCOUNT SECURITY</p><h1>Change your password</h1>
    <p className="acp-description">Your password expires monthly. Change it before expiry to keep access without waiting for Super Admin approval. Use at least 12 characters.</p>
    {error && <div className="acp-alert acp-error" role="alert"><AlertCircle size={16}/>{error}</div>}
    {notice && <div className="acp-alert acp-success" role="status"><CheckCircle2 size={16}/>{notice}</div>}
    <form onSubmit={submit}>
      <label htmlFor="acp-current">Current password</label><input id="acp-current" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required maxLength={128}/>
      <label htmlFor="acp-new">New password</label><input id="acp-new" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} maxLength={128}/>
      <label htmlFor="acp-confirm">Confirm new password</label><input id="acp-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={12} maxLength={128}/>
      <button type="submit" disabled={loading}>{loading ? "Updating password…" : "Change password"}</button>
    </form><p className="acp-footnote"><ShieldCheck size={15}/> Your new password is securely hashed and expires one month after this change.</p>
    {notice && <button className="acp-dashboard" type="button" onClick={() => navigate("/admin/dashboard")}>Continue to dashboard</button>}
  </section></main>;
}
