import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminWorkspaceMenu from "./AdminWorkspaceMenu";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, Download, FileText,
  Filter, LoaderCircle, MessageSquareText, RefreshCw, Search, ShieldCheck,
  UserRound, XCircle
} from "lucide-react";
import "./AdminGrievanceCenter.css";

const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";
type Evidence = { id: string; fileName: string; mimeType: string; fileSize: number; uploadedAt: string };
type TimelineEvent = { id: string | number; actorType: string; eventType: string; fromStatus?: string | null; toStatus?: string | null; note?: string | null; createdAt: string };
type Grievance = {
  id: string; enrollmentNumber?: string | null; category: string; description: string;
  proposedCorrection: string; status: string; adminNote?: string | null;
  createdAt: string; updatedAt: string; reviewedAt?: string | null;
  institution: string; studentName?: string | null; studentEmail?: string | null;
  studentIdentifier?: string | null; programme?: string | null; branch?: string | null;
  scheme?: string | null; evidence: Evidence[]; timeline: TimelineEvent[];
};
type StatusFilter = "ALL" | "PENDING" | "IN_REVIEW" | "NEEDS_INFO" | "RESOLVED" | "REJECTED";

const statusLabel = (status: string) => status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, value => value.toUpperCase());
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function AdminGrievanceCenter() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Grievance[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("IN_REVIEW");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("gradly_admin_token");
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    const token = localStorage.getItem("gradly_admin_token");
    if (!token) { logout(); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(API_ROOT + "/admin/enrollment-grievances?status=" + encodeURIComponent(filter), {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (response.status === 401) { logout(); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load department grievances.");
      const rows = Array.isArray(data.grievances) ? data.grievances as Grievance[] : [];
      setItems(rows);
      setSelectedId(current => rows.some(item => item.id === current) ? current : rows[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load grievances.");
    } finally { setLoading(false); }
  }, [filter, logout]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(item => [
      item.studentName, item.studentEmail, item.enrollmentNumber, item.studentIdentifier,
      item.category, item.proposedCorrection, item.programme, item.branch
    ].some(value => String(value || "").toLowerCase().includes(query)));
  }, [items, search]);

  const selected = visible.find(item => item.id === selectedId) || visible[0] || null;
  const counts = useMemo(() => ({
    open: items.filter(item => ["PENDING", "IN_REVIEW", "NEEDS_INFO"].includes(item.status)).length,
    pending: items.filter(item => item.status === "PENDING").length,
    needsInfo: items.filter(item => item.status === "NEEDS_INFO").length,
    closed: items.filter(item => ["RESOLVED", "REJECTED"].includes(item.status)).length
  }), [items]);

  async function downloadEvidence(grievance: Grievance, evidence: Evidence) {
    const token = localStorage.getItem("gradly_admin_token");
    if (!token) { logout(); return; }
    setDownloading(evidence.id); setError("");
    try {
      const response = await fetch(API_ROOT + `/admin/enrollment-grievances/${encodeURIComponent(grievance.id)}/evidence/${encodeURIComponent(evidence.id)}`, {
        headers: { Authorization: "Bearer " + token }
      });
      if (response.status === 401) { logout(); return; }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Unable to download evidence.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = evidence.fileName; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download evidence.");
    } finally { setDownloading(""); }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const token = localStorage.getItem("gradly_admin_token");
    if (!token) { logout(); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(API_ROOT + `/admin/enrollment-grievances/${encodeURIComponent(selected.id)}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: decision, adminNote: note.trim() })
      });
      if (response.status === 401) { logout(); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to save review.");
      setNotice("Review saved. The student has been notified.");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save review.");
    } finally { setSaving(false); }
  }

  const isOpen = selected && ["PENDING", "IN_REVIEW", "NEEDS_INFO"].includes(selected.status);

  return <><AdminWorkspaceMenu /><main className="agc-page" data-theme={localStorage.getItem("gradly_admin_theme") === "dark" ? "dark" : "light"}>
    <aside className="agc-sidebar">
      <Link to="/admin/dashboard" className="agc-brand"><span>G</span><div><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></div></Link>
      <div className="agc-side-label">WORKSPACE</div>
      <Link className="agc-side-link" to="/admin/dashboard"><ArrowLeft size={16}/> Dashboard</Link>
      <Link className="agc-side-link active" to="/admin/grievances"><ShieldCheck size={16}/> Grievance centre</Link>
      <div className="agc-side-note"><ShieldCheck size={17}/><span><b>Restricted access</b><small>Only your assigned academic scope is visible.</small></span></div>
    </aside>
    <section className="agc-main">
      <header className="agc-topbar">
        <div><span>ADMIN WORKSPACE</span><b>/</b><strong>Grievance centre</strong></div>
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
      </header>
      <div className="agc-content">
        <section className="agc-heading">
          <div><span className="agc-kicker"><ShieldCheck size={14}/> STUDENT SUPPORT & ACADEMIC INTEGRITY</span><h1>Grievance centre</h1><p>Review enrollment and academic identity concerns submitted by students in your assigned department.</p></div>
          <div className="agc-heading-mark"><MessageSquareText size={25}/><span>REVIEW DESK</span></div>
        </section>

        <section className="agc-stats">
          <article><span>Open cases</span><strong>{loading ? "—" : counts.open}</strong><small>Awaiting a decision or more information</small></article>
          <article><span>New submissions</span><strong>{loading ? "—" : counts.pending}</strong><small>Not yet picked up for review</small></article>
          <article><span>Need information</span><strong>{loading ? "—" : counts.needsInfo}</strong><small>Waiting for student response</small></article>
          <article><span>Closed cases</span><strong>{loading ? "—" : counts.closed}</strong><small>Resolved or rejected</small></article>
        </section>

        {error && <div className="agc-alert error" role="alert">{error}</div>}
        {notice && <div className="agc-alert success" role="status">{notice}</div>}

        <section className="agc-workspace">
          <div className="agc-inbox">
            <div className="agc-inbox-head"><div><span className="agc-kicker">CASE INBOX</span><h2>Student submissions</h2></div><span className="agc-count">{visible.length}</span></div>
            <label className="agc-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, enrollment, branch…"/></label>
            <label className="agc-filter"><Filter size={14}/><select value={filter} onChange={event => setFilter(event.target.value as StatusFilter)}><option value="ALL">All cases</option><option value="PENDING">Pending</option><option value="IN_REVIEW">In review</option><option value="NEEDS_INFO">Needs information</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option></select></label>
            <div className="agc-case-list">
              {loading && <div className="agc-empty"><LoaderCircle className="agc-spin" size={20}/> Loading grievances…</div>}
              {!loading && visible.length === 0 && <div className="agc-empty"><FileText size={22}/><b>No grievances found</b><span>New submissions in your assigned scope will appear here.</span></div>}
              {visible.map(item => <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); setNote(""); setDecision(["PENDING", "IN_REVIEW", "NEEDS_INFO"].includes(item.status) ? "IN_REVIEW" : item.status); setNotice(""); }} className={"agc-case"+(selected?.id === item.id ? " selected" : "")}>
                <div className="agc-case-top"><span className={"agc-status "+item.status.toLowerCase()}>{statusLabel(item.status)}</span><time>{dateLabel(item.createdAt)}</time></div>
                <strong>{item.studentName || "Student"}</strong><span className="agc-case-sub">{item.enrollmentNumber || item.studentIdentifier || "Enrollment not provided"} · {item.category.replace(/_/g, " ")}</span>
                <p>{item.proposedCorrection}</p>
                <div className="agc-case-foot"><span>{item.branch || item.programme || "Academic profile unavailable"}</span><ArrowUpRight size={14}/></div>
              </button>)}
            </div>
          </div>

          <div className="agc-detail">
            {!selected && !loading && <div className="agc-empty agc-detail-empty"><FileText size={28}/><b>Select a grievance</b><span>Choose a case from the inbox to review its details.</span></div>}
            {selected && <>
              <div className="agc-detail-head"><div><span className="agc-kicker">GRIEVANCE DETAILS</span><h2>{selected.studentName || "Student submission"}</h2><p>{selected.studentEmail || "Email unavailable"} · Submitted {dateLabel(selected.createdAt)}</p></div><span className={"agc-status "+selected.status.toLowerCase()}>{statusLabel(selected.status)}</span></div>
              <div className="agc-profile-grid">
                <div><small>Institution</small><b>{selected.institution || "—"}</b></div>
                <div><small>Programme</small><b>{selected.programme || "—"}</b></div>
                <div><small>Department / branch</small><b>{selected.branch || "—"}</b></div>
                <div><small>Scheme</small><b>{selected.scheme || "—"}</b></div>
                <div><small>Enrollment number</small><b>{selected.enrollmentNumber || "—"}</b></div>
                <div><small>Student identifier</small><b>{selected.studentIdentifier || "—"}</b></div>
              </div>
              <div className="agc-detail-block"><span>ISSUE CATEGORY</span><strong>{selected.category.replace(/_/g, " ")}</strong></div>
              <div className="agc-detail-block"><span>STUDENT'S REQUESTED CORRECTION</span><strong>{selected.proposedCorrection}</strong></div>
              <div className="agc-detail-block"><span>STUDENT'S EXPLANATION</span><p>{selected.description}</p></div>

              <section className="agc-evidence"><div className="agc-block-heading"><div><span className="agc-kicker">SUPPORTING DOCUMENTS</span><h3>Evidence submitted</h3></div><span>{selected.evidence?.length || 0} files</span></div>
                {(selected.evidence || []).length === 0 ? <p className="agc-muted">No evidence has been attached yet.</p> : <div className="agc-evidence-list">{selected.evidence.map(file => <div className="agc-evidence-item" key={file.id}><span className="agc-file-icon"><FileText size={18}/></span><div><b>{file.fileName}</b><small>{file.mimeType} · {fileSize(file.fileSize)} · {dateLabel(file.uploadedAt)}</small></div><button type="button" onClick={() => void downloadEvidence(selected, file)} disabled={downloading === file.id} aria-label={"Download "+file.fileName}>{downloading === file.id ? <LoaderCircle className="agc-spin" size={16}/> : <Download size={16}/>}</button></div>)}</div>}
              </section>

              <section className="agc-timeline"><div className="agc-block-heading"><div><span className="agc-kicker">CASE HISTORY</span><h3>Activity timeline</h3></div></div>
                {(selected.timeline || []).length === 0 ? <p className="agc-muted">No timeline events available.</p> : <div className="agc-timeline-list">{selected.timeline.map(event => <div className="agc-event" key={event.id}><span className="agc-event-dot"/><div><b>{event.eventType.replace(/_/g, " ")}</b><small>{event.actorType} · {dateLabel(event.createdAt)}</small>{event.fromStatus && event.toStatus && <p>{statusLabel(event.fromStatus)} → {statusLabel(event.toStatus)}</p>}{event.note && <p>{event.note}</p>}</div></div>)}</div>}
              </section>

              {isOpen ? <form className="agc-review" onSubmit={submitReview}><div className="agc-block-heading"><div><span className="agc-kicker">REVIEW ACTION</span><h3>Record your decision</h3></div></div>
                <label>Update case status<select value={decision} onChange={event => setDecision(event.target.value)}><option value="IN_REVIEW">In review</option><option value="NEEDS_INFO">Request more information</option><option value="RESOLVED">Resolve grievance</option><option value="REJECTED">Reject grievance</option></select></label>
                <label>Reviewer note <span>Required</span><textarea value={note} onChange={event => setNote(event.target.value)} minLength={3} maxLength={2000} required rows={4} placeholder="Explain what was checked, what the student should do next, or why the request was accepted/rejected…"/></label>
                <div className="agc-review-warning"><ShieldCheck size={16}/><span>This records the grievance decision only. It does not directly edit the student's locked academic identity or global enrollment mappings.</span></div>
                <button className="agc-submit" type="submit" disabled={saving || note.trim().length < 3}>{saving ? <><LoaderCircle className="agc-spin" size={16}/> Saving review…</> : <><CheckCircle2 size={16}/> Save review & notify student</>}</button>
              </form> : <div className="agc-closed-note"><CheckCircle2 size={17}/><span>This case is closed. A further decision must be handled through the authorised Super Admin process.</span></div>}
            </>}
          </div>
        </section>
        <footer className="agc-footer"><span><ShieldCheck size={14}/> Department-scoped access · Private evidence downloads</span><Link to="/admin/dashboard">Back to dashboard <ArrowUpRight size={13}/></Link></footer>
      </div>
    </section>
  </main></>;
}
