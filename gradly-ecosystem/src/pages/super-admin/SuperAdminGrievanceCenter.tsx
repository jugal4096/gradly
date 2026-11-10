import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search, ShieldCheck, CheckCircle2, Clock3, AlertCircle, X } from "lucide-react";
import "./SuperAdminGrievanceCenter.css";

const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";
type Option = { id: string; label: string };
type Evidence = { id: string; fileName: string; mimeType: string; fileSize: number; uploadedAt: string };
type Timeline = { id: number; actorType: string; eventType: string; fromStatus?: string | null; toStatus?: string | null; note?: string | null; createdAt: string };
type Grievance = {
  id: string; studentUserId: string; institutionId: string; enrollmentNumber?: string | null;
  category: string; description: string; proposedCorrection?: string | null; status: string;
  adminNote?: string | null; createdAt: string; updatedAt: string; reviewedAt?: string | null;
  institution: string; studentName?: string | null; studentEmail?: string | null;
  studentProfileId?: string | null; studentIdentifier?: string | null; admissionYear?: number | null;
  currentSemester?: number | null; academicStatus?: string | null; profileConfirmed?: boolean;
  admissionModeId?: string | null; admissionMode?: string | null; curriculumId?: string | null;
  curriculumVersion?: number | null; curriculumStatus?: string | null; programme?: string | null;
  branch?: string | null; scheme?: string | null; specialization?: string | null;
  evidence: Evidence[]; timeline: Timeline[]; curriculumOptions: Option[]; admissionModeOptions: Option[];
};
type CorrectionField = "" | "CURRICULUM" | "ADMISSION_MODE" | "STUDENT_IDENTIFIER" | "ADMISSION_YEAR";
const label = (value: string) => String(value || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const size = (bytes: number) => bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / (1024 * 1024)).toFixed(1) + " MB";
const openStatuses = ["PENDING", "IN_REVIEW", "NEEDS_INFO"];

export default function SuperAdminGrievanceCenter() {
  const [rows, setRows] = useState<Grievance[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("IN_REVIEW");
  const [correctionField, setCorrectionField] = useState<CorrectionField>("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = () => localStorage.getItem("gradly_super_admin_token") || "";
  const load = useCallback(async () => {
    const auth = token();
    if (!auth) { setError("Your Super Admin session is missing. Please sign in again."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(API_ROOT + "/super-admin/enrollment-grievance-center?status=" + encodeURIComponent(filter), { headers: { Authorization: "Bearer " + auth, Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error("Your Super Admin session has expired. Please sign in again.");
      if (!response.ok) throw new Error(data.message || "Unable to load grievance records.");
      const items = Array.isArray(data.grievances) ? data.grievances as Grievance[] : [];
      setRows(items);
      setSelectedId(current => items.some(item => item.id === current) ? current : items[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load grievances."); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(item => [item.studentName, item.studentEmail, item.enrollmentNumber, item.studentIdentifier, item.institution, item.programme, item.branch, item.category, item.proposedCorrection].some(value => String(value || "").toLowerCase().includes(q)));
  }, [rows, search]);
  const selected = visible.find(item => item.id === selectedId) || visible[0] || null;
  const counts = useMemo(() => ({
    open: rows.filter(item => openStatuses.includes(item.status)).length,
    pending: rows.filter(item => item.status === "PENDING").length,
    needsInfo: rows.filter(item => item.status === "NEEDS_INFO").length,
    closed: rows.filter(item => ["RESOLVED", "REJECTED"].includes(item.status)).length,
  }), [rows]);

  function choose(item: Grievance) {
    setSelectedId(item.id); setNote(""); setSuccess(""); setError(""); setCorrectionField(""); setCorrectionValue("");
    setDecision(openStatuses.includes(item.status) ? "IN_REVIEW" : item.status);
  }

  async function downloadEvidence(item: Grievance, file: Evidence) {
    setDownloading(file.id); setError("");
    try {
      const response = await fetch(API_ROOT + `/super-admin/enrollment-grievance-center/${encodeURIComponent(item.id)}/evidence/${encodeURIComponent(file.id)}`, { headers: { Authorization: "Bearer " + token() } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Unable to download evidence."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to download evidence."); }
    finally { setDownloading(""); }
  }

  async function submitReview() {
    if (!selected) return;
    if (note.trim().length < 3) { setError("Add a reviewer note of at least three characters."); return; }
    if (correctionField && !correctionValue.trim()) { setError("Choose or enter the verified correction value."); return; }
    if (correctionField && decision !== "RESOLVED") { setError("An individual profile correction can only be applied with the Resolve decision."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(API_ROOT + `/super-admin/enrollment-grievance-center/${encodeURIComponent(selected.id)}/review`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, adminNote: note.trim(), profileCorrection: correctionField ? { field: correctionField, value: correctionValue.trim() } : null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.message || "Unable to save grievance decision.");
      setSuccess(data.profileCorrectionApplied ? "Decision saved. The individual student profile was corrected and the student was notified." : "Decision saved and the student was notified.");
      setNote(""); setCorrectionField(""); setCorrectionValue("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save review."); }
    finally { setSaving(false); }
  }

  const isOpen = Boolean(selected && openStatuses.includes(selected.status));
  return <main className="sagc-page">
    <header className="sagc-header">
      <div><span className="sagc-eyebrow"><ShieldCheck size={14}/> SUPER ADMIN / ACADEMIC INTEGRITY</span><h1>Grievance &amp; correction centre</h1><p>Review student appeals, inspect submitted evidence and apply verified individual academic profile corrections.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </header>
    <section className="sagc-stats">
      <article><span>Open cases</span><strong>{loading ? "—" : counts.open}</strong><small>Awaiting final decision</small></article>
      <article><span>New submissions</span><strong>{loading ? "—" : counts.pending}</strong><small>Not yet reviewed</small></article>
      <article><span>Need information</span><strong>{loading ? "—" : counts.needsInfo}</strong><small>Waiting for student response</small></article>
      <article><span>Closed cases</span><strong>{loading ? "—" : counts.closed}</strong><small>Resolved or rejected</small></article>
    </section>
    {error && <div className="sagc-alert error" role="alert"><AlertCircle size={16}/>{error}</div>}
    {success && <div className="sagc-alert success" role="status"><CheckCircle2 size={16}/>{success}</div>}
    <section className="sagc-workspace">
      <aside className="sagc-inbox">
        <div className="sagc-inbox-title"><div><span>CASE QUEUE</span><h2>Student grievances</h2></div><b>{visible.length}</b></div>
        <label className="sagc-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, enrollment, branch…"/></label>
        <select className="sagc-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All cases</option><option value="PENDING">Pending</option><option value="IN_REVIEW">In review</option><option value="NEEDS_INFO">Needs information</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option></select>
        <div className="sagc-list">
          {loading && <div className="sagc-empty"><RefreshCw className="sagc-spin" size={18}/> Loading cases…</div>}
          {!loading && visible.length === 0 && <div className="sagc-empty"><FileText size={23}/><strong>No matching grievances</strong><small>New student submissions will appear here.</small></div>}
          {visible.map(item => <button key={item.id} type="button" onClick={() => choose(item)} className={"sagc-case" + (selected?.id === item.id ? " selected" : "")}>
            <span className="sagc-case-meta"><i className={"sagc-status " + item.status.toLowerCase()}>{label(item.status)}</i><time>{date(item.createdAt)}</time></span>
            <strong>{item.studentName || "Student"}</strong><small>{item.enrollmentNumber || item.studentIdentifier || "Enrollment not provided"}</small>
            <p>{label(item.category)} · {item.institution}</p>
          </button>)}
        </div>
      </aside>
      <section className="sagc-detail">
        {!selected && !loading && <div className="sagc-empty sagc-no-selection"><FileText size={28}/><strong>Select a grievance</strong><small>Choose a student case from the queue.</small></div>}
        {selected && <>
          <div className="sagc-detail-heading"><div><span>CASE DETAILS</span><h2>{selected.studentName || "Student submission"}</h2><p>{selected.studentEmail || "Email unavailable"} · {date(selected.createdAt)}</p></div><i className={"sagc-status " + selected.status.toLowerCase()}>{label(selected.status)}</i></div>
          <section className="sagc-profile">
            <div><small>Institution</small><strong>{selected.institution || "—"}</strong></div>
            <div><small>Programme</small><strong>{selected.programme || "—"}</strong></div>
            <div><small>Branch</small><strong>{selected.branch || "—"}</strong></div>
            <div><small>Specialization</small><strong>{selected.specialization || "—"}</strong></div>
            <div><small>Scheme / curriculum</small><strong>{selected.scheme || "—"}{selected.curriculumVersion ? " · v" + selected.curriculumVersion : ""}</strong></div>
            <div><small>Admission mode</small><strong>{selected.admissionMode || "—"}</strong></div>
            <div><small>Student identifier</small><strong>{selected.studentIdentifier || "—"}</strong></div>
            <div><small>Admission year</small><strong>{selected.admissionYear || "—"}</strong></div>
            <div><small>Current semester</small><strong>{selected.currentSemester || "—"}</strong></div>
          </section>
          <div className="sagc-copy-block"><span>STUDENT REQUESTED CORRECTION</span><strong>{selected.proposedCorrection || "Not specified"}</strong></div>
          <div className="sagc-copy-block"><span>STUDENT EXPLANATION</span><p>{selected.description}</p></div>
          <section className="sagc-evidence"><div className="sagc-section-heading"><div><span>SUPPORTING DOCUMENTS</span><h3>Evidence submitted</h3></div><b>{selected.evidence?.length || 0} files</b></div>
            {!selected.evidence?.length ? <p className="sagc-muted">No supporting documents attached.</p> : selected.evidence.map(file => <div className="sagc-file" key={file.id}><FileText size={18}/><div><strong>{file.fileName}</strong><small>{file.mimeType} · {size(file.fileSize)} · {date(file.uploadedAt)}</small></div><button type="button" disabled={downloading === file.id} onClick={() => void downloadEvidence(selected, file)} aria-label={"Download " + file.fileName}>{downloading === file.id ? <RefreshCw className="sagc-spin" size={16}/> : <Download size={16}/>}</button></div>)}
          </section>
          <section className="sagc-timeline"><div className="sagc-section-heading"><div><span>AUDIT HISTORY</span><h3>Case timeline</h3></div></div>
            {!selected.timeline?.length ? <p className="sagc-muted">No activity recorded.</p> : selected.timeline.map(event => <article key={event.id}><i/><div><strong>{label(event.eventType)} · {label(event.actorType)}</strong><small>{date(event.createdAt)}</small>{event.fromStatus && event.toStatus && <p>{label(event.fromStatus)} → {label(event.toStatus)}</p>}{event.note && <p>{event.note}</p>}</div></article>)}
          </section>
          {isOpen ? <section className="sagc-review">
            <div className="sagc-section-heading"><div><span>SUPER ADMIN DECISION</span><h3>Review and resolve</h3></div></div>
            <label>Decision<select value={decision} onChange={e => setDecision(e.target.value)}><option value="IN_REVIEW">In review</option><option value="NEEDS_INFO">Request more information</option><option value="RESOLVED">Resolve grievance</option><option value="REJECTED">Reject grievance</option></select></label>
            <div className="sagc-correction">
              <strong>Individual student profile correction <em>Optional</em></strong>
              <p>Only apply this after verifying official documents. This changes this student's profile only; it does not modify global enrollment parsing rules or other students.</p>
              <label>Academic field to correct<select value={correctionField} onChange={e => { setCorrectionField(e.target.value as CorrectionField); setCorrectionValue(""); if (e.target.value) setDecision("RESOLVED"); }}><option value="">No profile change — decision only</option><option value="CURRICULUM" disabled={!selected.studentProfileId}>Programme / branch / specialization / scheme (curriculum)</option><option value="ADMISSION_MODE" disabled={!selected.studentProfileId}>Admission mode</option><option value="STUDENT_IDENTIFIER" disabled={!selected.studentProfileId}>Student identifier</option><option value="ADMISSION_YEAR" disabled={!selected.studentProfileId}>Admission year</option></select></label>
              {correctionField === "CURRICULUM" && <label>Verified institution curriculum<select value={correctionValue} onChange={e => setCorrectionValue(e.target.value)}><option value="">Select verified curriculum</option>{(selected.curriculumOptions || []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
              {correctionField === "ADMISSION_MODE" && <label>Verified admission mode<select value={correctionValue} onChange={e => setCorrectionValue(e.target.value)}><option value="">Select admission mode</option>{(selected.admissionModeOptions || []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
              {correctionField === "STUDENT_IDENTIFIER" && <label>Correct student identifier<input value={correctionValue} onChange={e => setCorrectionValue(e.target.value)} maxLength={80} placeholder="Enter verified identifier"/></label>}
              {correctionField === "ADMISSION_YEAR" && <label>Correct admission year<input type="number" min="1980" max={new Date().getFullYear()} value={correctionValue} onChange={e => setCorrectionValue(e.target.value)} placeholder="YYYY"/></label>}
            </div>
            <label>Reviewer note <span>Required</span><textarea rows={4} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Record the verification performed, decision and next steps…"/></label>
            <div className="sagc-warning"><ShieldCheck size={16}/><span>All decisions are recorded in the grievance timeline. An individual correction is applied atomically with the decision and student notification.</span></div>
            <button className="sagc-submit" type="button" onClick={() => void submitReview()} disabled={saving || note.trim().length < 3 || (Boolean(correctionField) && !correctionValue.trim())}>{saving ? "Saving decision…" : "Save decision & notify student"}</button>
          </section> : <div className="sagc-closed"><CheckCircle2 size={17}/> This grievance is closed. Its evidence and audit history remain available for review.</div>}
        </>}
      </section>
    </section>
    <footer className="sagc-footer"><span><ShieldCheck size={14}/> Super Admin authority · Private evidence access · Individual profile audit trail</span><span><Clock3 size={14}/> Changes are recorded atomically</span></footer>
  </main>;
}
