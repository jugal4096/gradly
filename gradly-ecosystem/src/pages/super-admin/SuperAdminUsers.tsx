import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, Building2, CheckCircle2, Eye, Filter, GraduationCap, Power, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../../styles/super-admin-dashboard.css";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

interface Student {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  student_identifier: string | null;
  current_semester_number: number | null;
  current_cgpa: number | null;
  institution_name: string | null;
  program_name: string | null;
  branch_name: string | null;
}
interface UsersResponse { students?: Student[]; count?: number; message?: string }
interface GuestSession { id: string; account_type: "GUEST"; first_seen_at: string | null; last_seen_at: string | null; expires_at: string | null; institution_name: string | null; active: boolean; disabled: boolean }
interface GuestsResponse { guests?: GuestSession[]; count?: number; message?: string }
interface ActivityRecord { id: string; action: string; actor_role: string | null; created_at: string; metadata?: Record<string, unknown> }

const fieldStyle: React.CSSProperties = { minHeight: 42, border: "1px solid #ddd5f4", borderRadius: 11, padding: "9px 12px", background: "var(--sa-surface, #fff)", color: "var(--sa-text, #242039)", minWidth: 145 };
const actionStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 34, border: "1px solid #ded6f5", borderRadius: 9, padding: "7px 10px", background: "#f7f3ff", color: "#5b35bb", fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" };

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [guests, setGuests] = useState<GuestSession[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(true);
  const [guestsError, setGuestsError] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [institution, setInstitution] = useState("");
  const [program, setProgram] = useState("");
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [activityUser, setActivityUser] = useState<Student | null>(null);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setNotice("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      const response = await fetch(`${API_BASE_URL}/api/super-admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal,
      });
      const result = await response.json().catch(() => null) as UsersResponse | null;
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); throw new Error("Your session expired. Please sign in again."); }
      if (response.status === 403) throw new Error("This account is not authorized to manage student records.");
      if (!response.ok) throw new Error(result?.message || `Unable to load users (HTTP ${response.status}).`);
      if (!Array.isArray(result?.students)) throw new Error("The API returned an unexpected user list.");
      setStudents(result.students); setCount(typeof result.count === "number" ? result.count : result.students.length);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setStudents([]); setCount(null); setError(caught instanceof Error ? caught.message : "Unable to load users.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [navigate, query]);

  useEffect(() => {
    const controller = new AbortController(); let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return loadUsers(controller.signal); return undefined; });
    return () => { cancelled = true; controller.abort(); };
  }, [loadUsers]);

  const loadGuests = useCallback(async () => {
    setGuestsLoading(true); setGuestsError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const response = await fetch(`${API_BASE_URL}/api/super-admin/users/guests`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      const result = await response.json().catch(() => null) as GuestsResponse | null;
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok || !Array.isArray(result?.guests)) throw new Error(result?.message || `Unable to load guest sessions (HTTP ${response.status}).`);
      setGuests(result.guests);
    } catch (cause) { setGuests([]); setGuestsError(cause instanceof Error ? cause.message : "Unable to load guest sessions."); }
    finally { setGuestsLoading(false); }
  }, [navigate]);

  useEffect(() => { void loadGuests(); }, [loadGuests]);

  const institutions = useMemo(() => unique(students.map((s) => s.institution_name)), [students]);
  const programs = useMemo(() => unique(students.filter((s) => !institution || s.institution_name === institution).map((s) => s.program_name)), [students, institution]);
  const branches = useMemo(() => unique(students.filter((s) => (!institution || s.institution_name === institution) && (!program || s.program_name === program)).map((s) => s.branch_name)), [students, institution, program]);
  const filtered = useMemo(() => students.filter((s) =>
    (!institution || s.institution_name === institution) &&
    (!program || s.program_name === program) &&
    (!branch || s.branch_name === branch) &&
    (status === "all" || (status === "active" ? s.active : !s.active))
  ), [students, institution, program, branch, status]);

  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setQuery(search); }
  function resetFilters() { setInstitution(""); setProgram(""); setBranch(""); setStatus("all"); setSearch(""); setQuery(""); }

  async function changeStatus(student: Student) {
    const nextActive = !student.active;
    const action = nextActive ? "reactivate" : "disable";
    if (!window.confirm(`Are you sure you want to ${action} ${student.display_name || student.email || "this user"}? This action will be recorded in the audit log.`)) return;
    setBusyId(student.id); setError(""); setNotice("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const response = await fetch(`${API_BASE_URL}/api/super-admin/users/${encodeURIComponent(student.id)}/status`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok) throw new Error(result?.message || `Could not ${action} user (HTTP ${response.status}).`);
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, active: nextActive } : item));
      setNotice(result?.message || `User ${nextActive ? "reactivated" : "disabled"} successfully.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : `Unable to ${action} user.`); }
    finally { setBusyId(""); }
  }

  async function showActivity(student: Student) {
    setActivityUser(student); setActivity([]); setActivityError(""); setActivityLoading(true);
    try {
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const response = await fetch(`${API_BASE_URL}/api/super-admin/users/${encodeURIComponent(student.id)}/activity`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      const result = await response.json().catch(() => null) as { activity?: ActivityRecord[]; message?: string } | null;
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok) throw new Error(result?.message || `Unable to load activity (HTTP ${response.status}).`);
      setActivity(Array.isArray(result?.activity) ? result.activity : []);
    } catch (caught) { setActivityError(caught instanceof Error ? caught.message : "Unable to load user activity."); }
    finally { setActivityLoading(false); }
  }

  return (
    <main className="super-dashboard" style={{ minHeight: "70vh" }}>
      <header className="sd-header">
        <div className="sd-header-copy">
          <div className="sd-eyebrow"><Users size={14} /> GRADLY / PLATFORM ACCOUNTS</div>
          <h1>User management</h1>
          <p>Explore users by institution, program and branch, inspect profiles and activity, and manage account access.</p>
        </div>
        <button className="sd-refresh-button" type="button" onClick={() => void loadUsers()} disabled={loading}><RefreshCw size={16} className={loading ? "sd-spin" : ""} /> {loading ? "Loading…" : "Refresh"}</button>
      </header>

      <section className="sd-section" style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 }}>
          {[
            { label: "Returned accounts", value: count ?? "—", icon: Users },
            { label: "Active accounts", value: students.filter((s) => s.active).length, icon: CheckCircle2 },
            { label: "Disabled accounts", value: students.filter((s) => !s.active).length, icon: ShieldCheck },
            { label: "Institutions", value: institutions.length, icon: Building2 },
          ].map((item) => <div key={item.label} style={{ border: "1px solid #e4dcf8", borderRadius: 15, padding: 16, background: "linear-gradient(145deg, rgba(255,255,255,.98), rgba(244,239,255,.92))", boxShadow: "0 9px 24px rgba(78,48,145,.07)" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#6f638b", fontSize: 12 }}>{item.label}<item.icon size={18} color="#7548d6" /></div><div style={{ fontSize: 27, fontWeight: 750, color: "#2f2050", marginTop: 8 }}>{item.value}</div></div>)}
        </div>

        <form onSubmit={submitSearch} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px", ...fieldStyle }}><Search size={17} aria-hidden="true" /><span className="sr-only">Search users</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or student ID" style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit" }} /></label>
          <button className="sd-refresh-button" type="submit" disabled={loading}>Search</button>
        </form>

        <div style={{ border: "1px solid #e3daf6", borderRadius: 15, padding: 15, background: "rgba(247,243,255,.72)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontWeight: 700, color: "#50328d" }}><Filter size={17} /> Filter users by academic structure</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10 }}>
            <select aria-label="Filter by institution or college" value={institution} style={fieldStyle} onChange={(e) => { setInstitution(e.target.value); setProgram(""); setBranch(""); }}><option value="">All colleges / institutions</option>{institutions.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            <select aria-label="Filter by program" value={program} style={fieldStyle} onChange={(e) => { setProgram(e.target.value); setBranch(""); }}><option value="">All programs</option>{programs.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            <select aria-label="Filter by branch" value={branch} style={fieldStyle} onChange={(e) => setBranch(e.target.value)}><option value="">All branches</option>{branches.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            <select aria-label="Filter by account status" value={status} style={fieldStyle} onChange={(e) => setStatus(e.target.value)}><option value="all">All account statuses</option><option value="active">Active only</option><option value="inactive">Disabled only</option></select>
            <button type="button" onClick={resetFilters} style={{ ...actionStyle, background: "#fff" }}><X size={15} /> Clear filters</button>
          </div>
        </div>

        {error && <div role="alert" className="sd-error"><div className="sd-error-copy"><strong>Action needs attention</strong><p>{error}</p></div><button className="sd-error-retry" type="button" onClick={() => void loadUsers()}>Retry</button></div>}
        {notice && <div role="status" style={{ border: "1px solid #a9dfc1", background: "#effcf4", color: "#17663b", borderRadius: 11, padding: "11px 14px", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={17} />{notice}</div>}

        <div style={{ overflowX: "auto", background: "var(--sa-surface, #fff)", border: "1px solid #e3e0ee", borderRadius: 15, boxShadow: "0 12px 30px rgba(40,25,72,.06)" }}>
          <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["User","College / Institution","Program / Branch","Academic summary","Status","Last login","Profile & actions"].map((heading) => <th key={heading} scope="col" style={{ padding: 14, borderBottom: "1px solid #e8e1f5", background: "#f6f2ff", color: "#5f507b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{heading}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding: 28, textAlign: "center" }}>Loading user records…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#746985" }}>{error ? "User records are unavailable until the request succeeds." : "No users match these filters."}</td></tr>
              : filtered.map((student) => <tr key={student.id}>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6" }}><strong style={{ color: "#302345" }}>{student.display_name || "Unnamed user"}</strong><div style={{ color: "#776d89", fontSize: 12, marginTop: 4 }}>{student.email || "No email"}</div><div style={{ color: "#9388a5", fontSize: 11, marginTop: 3 }}>{student.student_identifier || "No student ID"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#4b405d" }}>{student.institution_name || "Not linked"}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#4b405d" }}>{student.program_name || "—"}<div style={{ color: "#7b708c", fontSize: 12, marginTop: 4 }}>{student.branch_name || "Branch not set"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#4b405d" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><GraduationCap size={14} /> {student.current_semester_number == null ? "Sem —" : `Sem ${student.current_semester_number}`}</span><div style={{ color: "#776d89", fontSize: 12, marginTop: 4 }}>CGPA: {student.current_cgpa == null ? "—" : Number(student.current_cgpa).toFixed(2)}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: student.active ? "#eaf9f0" : "#fff0f0", color: student.active ? "#197344" : "#a33232", fontSize: 11, fontWeight: 750 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor" }} />{student.active ? "Active" : "Disabled"}</span></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#70647f", fontSize: 12 }}>{formatDate(student.last_login_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0edf6" }}><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  <button type="button" style={actionStyle} onClick={() => navigate(`/super-admin/users/${encodeURIComponent(student.id)}`)}><Eye size={14} /> Profile</button>
                  <button type="button" style={actionStyle} onClick={() => navigate(`/super-admin/users/${encodeURIComponent(student.id)}/activity`)}><Activity size={14} /> Activity</button>
                  <button type="button" disabled={busyId === student.id} style={{ ...actionStyle, background: student.active ? "#fff2f0" : "#ecfbf1", color: student.active ? "#a33131" : "#17663b", borderColor: student.active ? "#f0c8c4" : "#b9e6c9", opacity: busyId === student.id ? .6 : 1 }} onClick={() => void changeStatus(student)}><Power size={14} />{busyId === student.id ? "Saving…" : student.active ? "Disable" : "Reactivate"}</button>
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#776d89", fontSize: 12, margin: 0 }}>{loading ? "Loading results…" : `Showing ${filtered.length} of ${students.length} loaded users${count == null ? "" : ` · API count: ${count}`}.`}</p>
      </section>

      <section className="sd-section" style={{ display: "grid", gap: 16 }}>
        <div className="sd-section-heading"><div><div className="sd-section-kicker">ANONYMOUS ACCESS</div><h2>Guest sessions</h2></div><button className="sd-refresh-button" type="button" onClick={() => void loadGuests()} disabled={guestsLoading}><RefreshCw size={15} className={guestsLoading ? "sd-spin" : ""} /> {guestsLoading ? "Loading…" : "Refresh guests"}</button></div>
        <p style={{ margin: 0, color: "#776d89", fontSize: 13 }}>Guest sessions have no registered account profile. Gradly displays only their Guest ID, institution metadata when available, and recorded session timestamps.</p>
        {guestsError && <div role="alert" className="sd-error"><div className="sd-error-copy"><strong>Guest records unavailable</strong><p>{guestsError}</p></div><button className="sd-error-retry" type="button" onClick={() => void loadGuests()}>Retry</button></div>}
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e3e0ee", borderRadius: 15, boxShadow: "0 12px 30px rgba(40,25,72,.06)" }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["Guest ID","Selected institution","First seen","Last activity","Session status","Available actions"].map((heading) => <th key={heading} scope="col" style={{ padding: 14, borderBottom: "1px solid #e8e1f5", background: "#f6f2ff", color: "#5f507b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{heading}</th>)}</tr></thead>
            <tbody>{guestsLoading ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading guest sessions…</td></tr> : guests.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#746985" }}>{guestsError ? "Guest sessions could not be loaded." : "No guest sessions found."}</td></tr> : guests.map((guest) => <tr key={guest.id}>
              <td style={{ padding: 14, borderBottom: "1px solid #f0edf6" }}><strong style={{ color: "#302345" }}>Guest · {guest.id.slice(0, 12)}</strong><div style={{ color: "#9388a5", fontSize: 11, marginTop: 4 }}>No registered profile</div></td>
              <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#4b405d" }}>{guest.institution_name || "Not recorded"}</td>
              <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#70647f", fontSize: 12 }}>{formatDate(guest.first_seen_at)}</td>
              <td style={{ padding: 14, borderBottom: "1px solid #f0edf6", color: "#70647f", fontSize: 12 }}>{formatDate(guest.last_seen_at)}</td>
              <td style={{ padding: 14, borderBottom: "1px solid #f0edf6" }}><span style={{ color: guest.active ? "#197344" : "#a33232", fontWeight: 750 }}>{guest.active ? "Active session" : guest.disabled ? "Disabled" : "Expired"}</span></td>
              <td style={{ padding: 14, borderBottom: "1px solid #f0edf6" }}><button type="button" style={actionStyle} onClick={() => navigate(`/super-admin/requests?guestId=${encodeURIComponent(guest.id)}`)}><Eye size={14} /> View session</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      {activityUser && <div role="presentation" onClick={() => setActivityUser(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(21,12,39,.56)", display: "grid", placeItems: "center", padding: 18 }}>
        <section role="dialog" aria-modal="true" aria-labelledby="activity-title" onClick={(event) => event.stopPropagation()} style={{ width: "min(720px, 100%)", maxHeight: "82vh", overflow: "auto", background: "#fff", color: "#2d2141", borderRadius: 20, padding: 22, boxShadow: "0 24px 90px rgba(0,0,0,.25)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}><div><div style={{ color: "#7751c7", fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>ACCOUNT AUDIT TRAIL</div><h2 id="activity-title" style={{ margin: "7px 0 4px" }}>User activity</h2><p style={{ margin: 0, color: "#776b87", fontSize: 13 }}>{activityUser.display_name || activityUser.email || "Selected user"}</p></div><button type="button" aria-label="Close activity dialog" onClick={() => setActivityUser(null)} style={{ ...actionStyle, padding: 8 }}><X size={18} /></button></div>
          {activityLoading ? <p style={{ padding: 20 }}>Loading recorded activity…</p> : activityError ? <p role="alert" style={{ color: "#a33131", padding: 16 }}>{activityError}</p> : activity.length === 0 ? <p style={{ color: "#776b87", padding: 18 }}>No matching user activity is present in the audit log yet. This view shows recorded audit events, not every click or session event.</p> : <div style={{ marginTop: 18, display: "grid", gap: 10 }}>{activity.map((event) => <div key={event.id} style={{ border: "1px solid #eee7f8", borderRadius: 12, padding: 13, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}><div><strong>{event.action.replace(/_/g, " ")}</strong><div style={{ color: "#776b87", fontSize: 12, marginTop: 4 }}>{event.actor_role || "System"} · {event.created_at ? formatDate(event.created_at) : "Time unavailable"}</div></div><span style={{ fontSize: 11, color: "#7551be", alignSelf: "center" }}>AUDIT EVENT</span></div>)}</div>}
        </section>
      </div>}
    </main>
  );
}
