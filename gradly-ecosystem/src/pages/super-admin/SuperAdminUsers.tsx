import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, Ban, CheckCircle2, Clock3, RefreshCw, Search, ShieldCheck, UserRound, Users, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, getToken } from "../../lib/superAdminSession";
import "../../styles/super-admin-dashboard.css";

type RecordRow = Record<string, unknown>;
type Tab = "students" | "guests";
function textValue(v: unknown) { return v === null || v === undefined || v === "" ? "—" : String(v); }
function formatDate(v: unknown) { if (!v) return "—"; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d); }

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("students");
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const token = getToken();
      if (!token) throw new Error("Your Super Admin session is missing. Sign in again.");
      const endpoint = tab === "students" ? "/api/super-admin/users" : "/api/super-admin/users/guests";
      const url = new URL(API_BASE_URL + endpoint);
      if (search.trim()) url.searchParams.set("search", search.trim());
      const response = await fetch(url.toString(), { headers: { Accept: "application/json", Authorization: "Bearer " + token } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load account records.");
      const result = tab === "students" ? data.students : data.guests;
      setRows(Array.isArray(result) ? result : []);
    } catch (e) { setRows([]); setError(e instanceof Error ? e.message : "Unable to load accounts."); }
    finally { setLoading(false); }
  }, [tab, search]);

  useEffect(() => { void load(); }, [load]);

  const activeCount = useMemo(() => rows.filter(r => tab === "students" ? r.active === true : r.active === true).length, [rows, tab]);
  const suspendedCount = useMemo(() => rows.filter(r => tab === "students" && r.active === false).length, [rows, tab]);

  async function toggleAccount(row: RecordRow) {
    const id = textValue(row.id);
    const nextActive = row.active !== true;
    const confirmed = window.confirm(nextActive ? "Restore this student account?" : "Temporarily suspend this student account? The student will need to be restored by a Super Admin.");
    if (!confirmed) return;
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch(API_BASE_URL + "/api/super-admin/users/" + encodeURIComponent(id) + "/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (getToken() || "") },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update account status.");
      setNotice(data.message || "Account status updated.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Account update failed."); }
    finally { setBusy(""); }
  }



  return <main className="super-dashboard sa-user-directory">
    <header className="sa-directory-header">
      <div><div className="sd-eyebrow"><span className="sd-eyebrow-dot"/> GRADLY <span className="sd-slash">/</span> GOVERNANCE</div><h1>People &amp; access</h1><p>Inspect student accounts and guest sessions, review their activity, and manage student account access.</p></div>
      <button className="sd-refresh-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "sd-spin" : ""}/>{loading ? "Refreshing…" : "Refresh directory"}</button>
    </header>
    <section className="sa-directory-hero">
      <div className="sa-directory-hero-icon"><ShieldCheck size={24}/></div><div className="sa-directory-hero-copy"><span>SUPER ADMIN WORKSPACE</span><h2>Visibility with accountability.</h2><p>Account controls are audited. Guest activity is read-only; student access can be suspended and restored.</p></div>
      <div className="sa-directory-summary"><strong>{loading ? "—" : rows.length.toLocaleString("en-IN")}</strong><span>Records in this view</span></div>
    </section>
    <div className="sa-directory-toolbar">
      <div className="sa-directory-tabs" role="tablist" aria-label="Account type">
        <button role="tab" aria-selected={tab === "students"} className={tab === "students" ? "active" : ""} onClick={() => {setTab("students");}}> <Users size={16}/> Students </button>
        <button role="tab" aria-selected={tab === "guests"} className={tab === "guests" ? "active" : ""} onClick={() => {setTab("guests");}}> <UserRound size={16}/> Guest sessions </button>
      </div>
      <label className="sa-directory-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, ID or institution…" /><span>{rows.length}</span></label>
    </div>
    <div className="sa-directory-stats">
      <div><span>{tab === "students" ? "Active accounts" : "Active sessions"}</span><strong>{loading ? "—" : activeCount}</strong></div>
      {tab === "students" && <div><span>Suspended accounts</span><strong>{loading ? "—" : suspendedCount}</strong></div>}
      <div><span>Directory source</span><strong>Live API</strong></div>
    </div>
    {error && <div className="sd-error" role="alert"><UserX size={18}/><div className="sd-error-copy"><strong>Could not complete the action</strong><p>{error}</p></div></div>}
    {notice && <div className="sc-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
    {loading ? <div className="sc-empty"><RefreshCw className="sd-spin" size={24}/><strong>Loading directory</strong><span>Fetching live records from the protected backend.</span></div> : rows.length === 0 ? <div className="sc-empty"><Users size={27}/><strong>No {tab === "students" ? "student accounts" : "guest sessions"} found</strong><span>{search ? "Try a different search term." : "No records were returned by the backend."}</span></div> :
      <div className="sa-directory-list">{rows.map((row,index) => {
        const id = textValue(row.id);
        const name = textValue(row.display_name ?? row.name ?? row.college_name ?? row.guest_id);
        const email = textValue(row.email);
        const active = row.active === true;
        const deleted = Boolean(row.deleted_at ?? (row.metadata as Record<string,unknown> | undefined)?.deleted_at);
        return <article className="sa-person-card" key={id === "—" ? index : id}>
          <div className="sa-person-avatar">{tab === "students" ? <UserRound size={20}/> : <Users size={20}/>}</div>
          <div className="sa-person-main"><div className="sa-person-name">{name}<span className={"sa-status-pill " + (deleted ? "muted" : active ? "active" : "paused")}>{deleted ? "Deleted by guest" : active ? "Active" : "Suspended"}</span></div><div className="sa-person-email">{email}</div><div className="sa-person-meta">{tab === "students" ? [row.student_identifier, row.institution_name, row.branch_name].filter(Boolean).map(String).join(" · ") || "Student profile" : [row.institution_name, row.subject_count !== undefined ? String(row.subject_count) + " subjects" : "", row.semester_entry_count !== undefined ? String(row.semester_entry_count) + " semester entries" : ""].filter(Boolean).join(" · ") || "Guest session"} </div><div className="sa-person-last"><Clock3 size={12}/> Last active {formatDate(row.last_login_at ?? row.last_seen_at ?? row.created_at ?? row.first_seen_at)}</div></div>
          <div className="sa-person-actions">{tab === "students" && <button className="sa-secondary-action" type="button" onClick={() => navigate("/super-admin/users/" + encodeURIComponent(id))}>Academic profile <ArrowUpRight size={14}/></button>}<button className="sa-secondary-action" type="button" onClick={() => navigate("/super-admin/users/" + encodeURIComponent(id) + "/activity", { state: { account: row, accountType: tab } })}><Activity size={14}/>View activity</button>{tab === "students" && <button className={active ? "sa-danger-action" : "sa-restore-action"} type="button" disabled={busy === id} onClick={() => void toggleAccount(row)}>{active ? <><Ban size={14}/> Suspend</> : <><CheckCircle2 size={14}/> Restore</>}</button>}</div>

        </article>;
      })}</div>}
    <footer className="sc-foot"><ShieldCheck size={14}/> Protected Super Admin directory · Student suspension/restoration writes audit events · Guest records are inspected read-only</footer>
  </main>;
}
