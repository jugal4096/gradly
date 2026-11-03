import { useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, UserCheck, UserX, Trash2, ShieldCheck, LockKeyhole, AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import "./SuperAdminAdmins.css";

type Admin = {
  id: string; full_name?: string | null; admin_username?: string | null; admin_code?: string | null;
  status?: string | null; adminship_expires_at?: string | null; application_id?: string | null;
};
type Permission = { code: string; label: string; description: string };
const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
const PERMISSIONS: Permission[] = [
  { code: "FEEDBACK_VIEW", label: "View feedback", description: "Review student and platform feedback." },
  { code: "FEEDBACK_MANAGE", label: "Manage feedback", description: "Process and update feedback records." },
  { code: "CURRICULUM_VIEW", label: "View curriculum", description: "View curriculum and subject information." },
  { code: "CURRICULUM_CHANGE_REQUEST", label: "Request curriculum changes", description: "Submit curriculum change requests." },
  { code: "STUDENT_VIEW", label: "View students", description: "Access student directory records." },
  { code: "STUDENT_ACADEMIC_VIEW", label: "View student academics", description: "Access student academic information." },
  { code: "RESULT_VIEW", label: "View results", description: "View academic results." },
  { code: "BUG_REPORT_VIEW", label: "View bug reports", description: "Review submitted bug reports." },
  { code: "BUG_REPORT_MANAGE", label: "Manage bug reports", description: "Process and update bug reports." },
  { code: "ADMIN_VIEW", label: "View administrators", description: "View administrator directory information." },
  { code: "ADMIN_CREATE", label: "Create administrators", description: "Create administrator accounts." },
  { code: "ADMIN_UPDATE", label: "Update administrators", description: "Update administrator records." },
  { code: "ADMIN_SUSPEND", label: "Suspend administrators", description: "Manage administrator access status." },
  { code: "AUDIT_VIEW", label: "View audit logs", description: "Access administrator audit history." },
];
export default function SuperAdminAdminActions() {
  const { adminId = "" } = useParams();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [expiry, setExpiry] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [permissionsExpanded, setPermissionsExpanded] = useState(false);

  const request = async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) throw new Error("Super Admin session missing. Sign in again.");
    const response = await fetch(API_ROOT + path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, Accept: "application/json", ...(init.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("/super-admin/administrators/" + encodeURIComponent(adminId));
      const row = data.administrator || null;
      setAdmin(row);
      setExpiry(row?.adminship_expires_at ? new Date(row.adminship_expires_at).toISOString().slice(0, 10) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load administrator.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [adminId]);

  const changeStatus = async (status: "ACTIVE" | "SUSPENDED" | "DISABLED") => {
    if (!admin) return;
    const verb = status === "ACTIVE" ? "reactivate" : status === "SUSPENDED" ? "suspend" : "disable";
    if (!window.confirm("Are you sure you want to " + verb + " " + (admin.full_name || "this administrator") + "?")) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await request("/super-admin/administrators/" + encodeURIComponent(admin.id) + "/status", {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      setMessage("Administrator status updated successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveExpiry = async () => {
    if (!admin || !expiry) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await request("/super-admin/administrators/" + encodeURIComponent(admin.id) + "/adminship", {
        method: "PATCH", body: JSON.stringify({ expiresAt: new Date(expiry + "T23:59:59").toISOString() }),
      });
      setMessage("Adminship expiry date extended successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update adminship expiry.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAdmin = async () => {
    if (!admin) return;
    const name = admin.full_name || admin.admin_username || "this administrator";
    if (!window.confirm("Permanently delete " + name + "? Their admin account and admin-only records will be removed. This cannot be undone.")) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await request("/super-admin/administrators/" + encodeURIComponent(admin.id), { method: "DELETE" });
      setMessage(result.message || "Administrator deleted.");
      navigate("/super-admin/admins", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Administrator deletion failed.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="sa-admins">
    <header className="sa-admins-header">
      <div><span className="sa-admins-kicker">ADMINISTRATOR / ACCESS CONTROL</span><h1>Take action</h1><p>Manage permissions, account access and adminship for {admin?.full_name || admin?.admin_username || "this administrator"}.</p></div>
      <button className="sa-admins-refresh" onClick={() => navigate("/super-admin/admins")}><ArrowLeft size={15}/> Back to administrators</button>
    </header>
    {loading ? <div className="sa-admins-empty">Loading account controls…</div> : error && !admin ? <div className="sa-admins-error">{error}</div> : admin ? <>
      <div className="sa-admins-profilegrid">
        <article><span>Administrator</span><strong>{admin.full_name || admin.admin_username || admin.admin_code || admin.id}</strong></article>
        <article><span>Current status</span><strong>{admin.status || "Unknown"}</strong></article>
        <article><span>Current expiry</span><strong>{admin.adminship_expires_at ? new Date(admin.adminship_expires_at).toLocaleDateString("en-IN") : "Not set"}</strong></article>
        <article><span>Administrator ID</span><strong>{admin.admin_code || admin.id}</strong></article>
      </div>
      {message && <div className="sa-admins-notice">{message}</div>}
      {error && <div className="sa-admins-error">{error}</div>}

      <div className="sa-admin-action-panel">
        <div className="sa-admin-action-panel-heading"><div><span className="sa-admins-kicker">ACCESS GOVERNANCE</span><h2>Manage permissions</h2><p>Review the permission set available to administrator accounts.</p></div><button className="sa-admins-view" type="button" onClick={() => setPermissionsExpanded(value => !value)}><ShieldCheck size={15}/>{permissionsExpanded ? "Hide permissions" : "View permissions"}</button></div>
        {permissionsExpanded && <><div className="sa-admins-error"><LockKeyhole size={15}/> Permission changes are not yet supported by the current administrator API. These are the permission codes configured in Gradly; no changes will be submitted or saved from this panel.</div><div className="sa-admin-permission-grid">{PERMISSIONS.map(permission => <article key={permission.code}><strong>{permission.label}</strong><small>{permission.description}</small><code>{permission.code}</code></article>)}</div></>}
      </div>

      <div className="sa-admin-action-panel">
        <div className="sa-admin-action-panel-heading"><div><span className="sa-admins-kicker">ACCOUNT STATUS</span><h2>Account access</h2><p>Reactivate a disabled account or pause access when required.</p></div></div>
        <div className="sa-admins-actions">
          <button disabled={busy || admin.status === "ACTIVE"} onClick={() => void changeStatus("ACTIVE")}><UserCheck size={15}/> Reactivate account</button>
          <button disabled={busy || admin.status === "SUSPENDED"} onClick={() => void changeStatus("SUSPENDED")}><UserX size={15}/> Suspend access</button>
          <button disabled={busy || admin.status === "DISABLED"} onClick={() => void changeStatus("DISABLED")}><LockKeyhole size={15}/> Disable account</button>
        </div>
      </div>

      <div className="sa-admin-action-panel">
        <div className="sa-admin-action-panel-heading"><div><span className="sa-admins-kicker">ADMINSHIP</span><h2>Extend expiry date</h2><p>Choose a new date until which this administrator may access the admin workspace.</p></div></div>
        <div className="sa-admins-expiry"><input aria-label="New adminship expiry date" type="date" min={new Date().toLocaleDateString("en-CA")} value={expiry} onChange={event => setExpiry(event.target.value)}/><button disabled={busy || !expiry} onClick={() => void saveExpiry()}><CalendarClock size={15}/> Extend expiry</button></div>
      </div>

      <div className="sa-admin-action-panel sa-admin-danger-panel">
        <div className="sa-admin-action-panel-heading"><div><span className="sa-admins-kicker">DANGER ZONE</span><h2>Delete administrator</h2><p>Permanent deletion removes the administrator account and its admin-only records. This cannot be undone.</p></div></div>
        <button className="sa-admin-delete-button" disabled={busy} onClick={() => void deleteAdmin()}><Trash2 size={15}/> Delete administrator</button>
      </div>
    </> : <div className="sa-admins-empty">Administrator not found.</div>}
  </section>;
}
