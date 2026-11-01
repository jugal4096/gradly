import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, KeyRound, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import "./SuperAdminPasswordRequests.css";

type PasswordRequest = {
  id: string;
  admin_code: string;
  admin_email: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  full_name?: string | null;
  institution_name?: string | null;
  branch_name?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  review_note?: string | null;
};

const apiRoot = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function SuperAdminPasswordRequests() {
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { setError("Super Admin session is missing. Sign in again."); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(apiRoot + "/admin-password-requests/review", { headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.message || "Unable to load password requests.");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load password requests."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(request: PasswordRequest, decision: "APPROVED" | "REJECTED") {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { setError("Super Admin session is missing. Sign in again."); return; }
    const reviewNote = (notes[request.id] || "").trim();
    if (decision === "REJECTED" && !reviewNote) { setError("Add a short reason before rejecting this request."); return; }
    if (!window.confirm(decision === "APPROVED" ? "Approve this password-change request? The admin will then be allowed to set a new password." : "Reject this password-change request?")) return;
    setBusyId(request.id); setError(""); setNotice("");
    try {
      const response = await fetch(apiRoot + "/admin-password-requests/" + encodeURIComponent(request.id) + "/review", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ decision, review_note: reviewNote }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.message || "Unable to review request.");
      setNotice(data.message || "Request reviewed.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to review request."); }
    finally { setBusyId(""); }
  }

  return <section className="super-password-requests">
    <header className="spr-header">
      <div className="spr-icon"><KeyRound size={22}/></div>
      <div><p className="spr-eyebrow">SECURITY CONTROL / REVIEW QUEUE</p><h1>Password-change requests</h1><p>Approve a verified administrator's request before they can set a new password.</p></div>
      <button className="spr-refresh" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "spr-spin" : ""}/> Refresh</button>
    </header>
    <div className="spr-summary">
      <div><span>Total requests</span><strong>{requests.length}</strong></div>
      <div><span>Awaiting review</span><strong>{requests.filter(r => r.status === "PENDING").length}</strong></div>
      <div><span>Approved</span><strong>{requests.filter(r => r.status === "APPROVED").length}</strong></div>
      <div><span>Completed</span><strong>{requests.filter(r => r.status === "COMPLETED").length}</strong></div>
    </div>
    {error && <div className="spr-alert spr-error" role="alert">{error}</div>}
    {notice && <div className="spr-alert spr-success" role="status">{notice}</div>}
    {loading ? <div className="spr-empty">Loading review queue…</div> : requests.length === 0 ? <div className="spr-empty"><ShieldCheck size={28}/><strong>No password requests</strong><span>New requests from administrators will appear here.</span></div> :
      <div className="spr-list">{requests.map(request => <article className="spr-card" key={request.id}>
        <div className="spr-card-top"><span className={"spr-status spr-" + request.status.toLowerCase()}>{request.status === "PENDING" ? <Clock3 size={14}/> : request.status === "REJECTED" ? <XCircle size={14}/> : <CheckCircle2 size={14}/>} {request.status.replaceAll("_", " ")}</span><time>{dateLabel(request.created_at)}</time></div>
        <h2>{request.full_name || request.admin_code}</h2>
        <p className="spr-email">{request.admin_email}</p>
        <div className="spr-meta"><span><small>Admin ID</small><strong>{request.admin_code}</strong></span><span><small>Institution</small><strong>{request.institution_name || "Not available"}</strong></span><span><small>Branch</small><strong>{request.branch_name || "Not available"}</strong></span></div>
        {request.review_note && <p className="spr-note"><strong>Review note:</strong> {request.review_note}</p>}
        {request.status === "PENDING" && <div className="spr-actions"><label htmlFor={"spr-note-" + request.id}>Review note {request.status === "PENDING" ? "(required to reject)" : ""}</label><textarea id={"spr-note-" + request.id} value={notes[request.id] || ""} onChange={e => setNotes(prev => ({...prev, [request.id]: e.target.value}))} maxLength={1000} placeholder="Optional note for approval, reason if rejecting…"/><div><button type="button" className="spr-reject" disabled={busyId === request.id} onClick={() => void review(request, "REJECTED")}>{busyId === request.id ? "Saving…" : "Reject request"}</button><button type="button" className="spr-approve" disabled={busyId === request.id} onClick={() => void review(request, "APPROVED")}>{busyId === request.id ? "Saving…" : "Approve password change"}</button></div></div>}
      </article>)}</div>}
  </section>;
}
