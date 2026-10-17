import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SuperAdminUsers.css";

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
  branch_name: string | null;
  institution_name?: string | null;
  program_name?: string | null;
}

interface BranchOption { id: string; name: string; }

interface ActivityEvent {
  id: string | number;
  actor_type?: string;
  actor_role?: string;
  action: string;
  entity_table?: string;
  entity_id?: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface GuestSession {
  id: string;
  first_seen_at: string;
  last_seen_at: string | null;
  expires_at: string | null;
  active: boolean;
  metadata: Record<string, unknown> | null;
}

type DirectoryType = "registered" | "guest";
type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE = 10;

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "U";
  return source.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [columns.map(escape).join(","), ...rows.map((row) => columns.map((key) => escape(row[key])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [directoryType, setDirectoryType] = useState<DirectoryType>("registered");
  const [students, setStudents] = useState<Student[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [guests, setGuests] = useState<GuestSession[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [selectedGuest, setSelectedGuest] = useState<GuestSession | null>(null);\n  const [guestActivityTarget, setGuestActivityTarget] = useState<GuestSession | null>(null);
  const [branchFilter, setBranchFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [activityStudent, setActivityStudent] = useState<Student | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadDirectory = useCallback(async (quiet = false) => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) {
      setError("Your Super Admin session is missing. Please sign in again.");
      setStudents([]);
      setGuests([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      const endpoint = directoryType === "registered" ? "users" : "users/guests";
      const response = await fetch(`${getApiBaseUrl()}/api/super-admin/${endpoint}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Access denied. Your Super Admin session may have expired.");
      }
      if (!response.ok) throw new Error("Could not load directory records. Please retry.");

      const data = await response.json() as { students?: Student[]; guests?: GuestSession[] };
      if (directoryType === "registered") {
        setStudents(Array.isArray(data.students) ? data.students : []);
        // Load the branch catalogue independently of whether any students are assigned to a branch.
        const branchResponse = await fetch(`${getApiBaseUrl()}/api/super-admin/users/branches`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (branchResponse.ok) {
          const branchData = await branchResponse.json() as { branches?: BranchOption[] };
          setBranchOptions(Array.isArray(branchData.branches) ? branchData.branches : []);
        }
      } else setGuests(Array.isArray(data.guests) ? data.guests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load directory records.");
      if (directoryType === "registered") setStudents([]);
      else setGuests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [directoryType, search]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    setPage(1);
    setSelectedGuest(null);
  }, [directoryType, statusFilter]);

  const branches = useMemo(() => [...new Set([...branchOptions.map((branch) => branch.name), ...students.map((student) => student.branch_name).filter((value): value is string => Boolean(value))])].sort(), [branchOptions, students]);
  const courses = useMemo(() => [...new Set(students.map((student) => student.program_name).filter((value): value is string => Boolean(value)))].sort(), [students]);

  const filteredStudents = useMemo(() => students.filter((student) => {
    if (statusFilter === "active" && !student.active) return false;
    if (statusFilter === "inactive" && student.active) return false;
    if (branchFilter !== "all" && student.branch_name !== branchFilter) return false;
    if (courseFilter !== "all" && student.program_name !== courseFilter) return false;
    return true;
  }), [students, statusFilter, branchFilter, courseFilter]);

  const filteredGuests = useMemo(() => {
    if (statusFilter === "active") return guests.filter((guest) => guest.active);
    if (statusFilter === "inactive") return guests.filter((guest) => !guest.active);
    return guests;
  }, [guests, statusFilter]);

  const filteredCount = directoryType === "registered" ? filteredStudents.length : filteredGuests.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleStudents = filteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const visibleGuests = filteredGuests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeStudents = students.filter((student) => student.active).length;
  const activeGuests = guests.filter((guest) => guest.active).length;

  async function openGuestActivity(guest: GuestSession) {\n    setGuestActivityTarget(guest);\n    setActivityEvents([]);\n    setActivityError("");\n    setActivityLoading(true);\n    try {\n      const token = localStorage.getItem("gradly_super_admin_token");\n      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");\n      const response = await fetch(`${getApiBaseUrl()}/api/super-admin/users/guests/${encodeURIComponent(guest.id)}/activity`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });\n      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Access denied. Please sign in again." : "Could not load guest activity timeline.");\n      const data = await response.json() as { events?: ActivityEvent[] };\n      setActivityEvents(Array.isArray(data.events) ? data.events : []);\n    } catch (err) { setActivityError(err instanceof Error ? err.message : "Could not load guest activity timeline."); }\n    finally { setActivityLoading(false); }\n  }\n\n  async function openStudentActivity(student: Student) {
    setActivityStudent(student);
    setActivityEvents([]);
    setActivityError("");
    setActivityLoading(true);
    try {
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const response = await fetch(`${getApiBaseUrl()}/api/super-admin/users/${encodeURIComponent(student.id)}/activity`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Access denied. Please sign in again." : "Could not load activity timeline.");
      const data = await response.json() as { events?: ActivityEvent[] };
      setActivityEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) { setActivityError(err instanceof Error ? err.message : "Could not load activity timeline."); }
    finally { setActivityLoading(false); }
  }

  function exportCurrentDirectory() {
    if (directoryType === "registered") {
      downloadCsv("gradly-registered-users.csv", filteredStudents.map((student) => ({
        id: student.id,
        name: student.display_name,
        role: student.role,
        active: student.active,
        branch: student.branch_name,
        program: student.program_name,
        semester: student.current_semester_number,
        cgpa: student.current_cgpa,
        last_login: student.last_login_at,
        created_at: student.created_at,
      })));
    } else {
      downloadCsv("gradly-guest-sessions.csv", filteredGuests.map((guest) => ({
        session_id: guest.id,
        status: guest.active ? "Active" : "Expired",
        first_seen_at: guest.first_seen_at,
        last_seen_at: guest.last_seen_at,
        expires_at: guest.expires_at,
        source: guest.metadata?.source ?? "",\n        branch: guest.metadata?.branch_name ?? "",
      })));
    }
  }

  return (
    <main className="super-users-page">
      <header className="super-users-header">
        <div>
          <div className="super-users-kicker">GRADLY / USER MANAGEMENT</div>
          <h1>Users &amp; Guest Sessions</h1>
          <p>Review registered student accounts and anonymous guest sessions separately.</p>
        </div>
        <div className="super-users-header-actions">
          <button type="button" className="super-users-secondary-action" onClick={exportCurrentDirectory} disabled={loading || filteredCount === 0}>
            <Download size={15} /> Export CSV
          </button>
          <button type="button" className="super-users-refresh" onClick={() => void loadDirectory(true)} disabled={loading || refreshing}>
            <RefreshCw size={15} className={refreshing ? "super-users-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {directoryType === "registered" && <section className="super-users-branch-overview" aria-label="Branch-wise student overview">
        <div className="super-users-branch-heading"><h2>Browse by branch</h2><span>{branches.length} branches</span></div>
        <div className="super-users-branch-cards">
          <button type="button" className={`super-users-branch-card ${branchFilter === "all" ? "is-selected" : ""}`} onClick={() => { setBranchFilter("all"); setPage(1); }}>
            <span>All branches</span><strong>{students.length}</strong><small>Students</small>
          </button>
          {branches.map((branch) => <button type="button" key={branch} className={`super-users-branch-card ${branchFilter === branch ? "is-selected" : ""}`} onClick={() => { setBranchFilter(branch); setPage(1); }}>
            <span>{branch}</span><strong>{students.filter((student) => student.branch_name === branch).length}</strong><small>Students</small>
          </button>)}
        </div>
      </section>}

      <section className="super-users-stats" aria-label="Directory overview">
        <button type="button" className={`super-users-stat-card ${directoryType === "registered" ? "is-selected" : ""}`} onClick={() => setDirectoryType("registered")}>
          <span className="super-users-stat-icon"><UserRoundCheck size={19} /></span>
          <div><span className="super-users-stat-label">REGISTERED STUDENTS</span><strong>{students.length}</strong><small>{activeStudents} active accounts in loaded results</small></div>
        </button>
        <button type="button" className={`super-users-stat-card ${directoryType === "guest" ? "is-selected" : ""}`} onClick={() => setDirectoryType("guest")}>
          <span className="super-users-stat-icon guest"><Activity size={19} /></span>
          <div><span className="super-users-stat-label">GUEST SESSIONS</span><strong>{guests.length}</strong><small>{activeGuests} unexpired sessions in loaded results</small></div>
        </button>
      </section>

      <section className="super-users-directory">
        <div className="super-users-directory-heading">
          <div>
            <h2>{directoryType === "registered" ? "Registered student directory" : "Guest session directory"}</h2>
            <p>{directoryType === "registered" ? "Account and academic profile data. Guest sessions are not mixed into this list." : "Anonymous session activity. No guest password, token, or private credential is exposed."}</p>
          </div>
          <span className="super-users-secure-badge"><ShieldCheck size={14} /> SUPER ADMIN ACCESS</span>
        </div>

        <div className="super-users-tabs" role="tablist" aria-label="User type">
          <button type="button" role="tab" aria-selected={directoryType === "registered"} className={directoryType === "registered" ? "is-active" : ""} onClick={() => setDirectoryType("registered")}><UserRound size={16} /> Login users <span>{students.length}</span></button>
          <button type="button" role="tab" aria-selected={directoryType === "guest"} className={directoryType === "guest" ? "is-active" : ""} onClick={() => setDirectoryType("guest")}><Activity size={16} /> Guest users <span>{guests.length}</span></button>
        </div>

        <div className="super-users-toolbar">
          <label className="super-users-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={directoryType === "registered" ? "Search student name, email, enrollment no. or branch…" : "Search guest session ID…"} aria-label="Search directory" />
            {searchInput && <button type="button" className="super-users-clear" onClick={() => setSearchInput("")} aria-label="Clear search"><X size={15} /></button>}
          </label>
          {directoryType === "registered" && <label className="super-users-filter">
            <Filter size={15} />
            <select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1); }} aria-label="Filter by branch">
              <option value="all">All branches</option>
              {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
          </label>}
          {directoryType === "registered" && <label className="super-users-filter">
            <Filter size={15} />
            <select value={courseFilter} onChange={(event) => { setCourseFilter(event.target.value); setPage(1); }} aria-label="Filter by course or program">
              <option value="all">All courses / programs</option>
              {courses.map((course) => <option key={course} value={course}>{course}</option>)}
            </select>
          </label>}
          <label className="super-users-filter">
            <Filter size={15} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">{directoryType === "guest" ? "Expired" : "Inactive"}</option>
            </select>
          </label>
        </div>

        {error && <div className="super-users-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => void loadDirectory()}>Retry</button></div>}

        <div className="super-users-table-wrap" key={directoryType}>
          {directoryType === "registered" ? (
            <table className="super-users-table">
              <thead><tr><th>STUDENT</th><th>BRANCH / PROGRAM</th><th>SEMESTER</th><th>CGPA</th><th>STATUS</th><th>LAST LOGIN</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7}><div className="super-users-state"><span className="super-users-loader" />Loading registered users…</div></td></tr>
                  : error ? <tr><td colSpan={8}><div className="super-users-state">Directory could not be loaded.</div></td></tr>
                  : visibleStudents.length === 0 ? <tr><td colSpan={8}><div className="super-users-state"><Users size={25} /><strong>No registered users found</strong><span>Try changing your search or status filter.</span></div></td></tr>
                  : visibleStudents.map((student) => <tr key={student.id}>
                    <td><div className="super-users-person"><span className="super-users-avatar">{initials(student.display_name, null)}</span><span className="super-users-person-copy"><strong>{student.display_name || "Unnamed student"}</strong><small>Student account</small></span></div></td>
                    <td><span className="super-users-branch">{student.branch_name || "Not provided"}</span><small className="super-users-subtext">{student.program_name || ""}</small></td>
                    <td>{student.current_semester_number ? `Semester ${student.current_semester_number}` : "—"}</td>
                    <td><strong className="super-users-cgpa">{student.current_cgpa == null ? "—" : Number(student.current_cgpa).toFixed(2)}</strong></td>
                    <td><span className={`super-users-status ${student.active ? "is-active" : "is-inactive"}`}><span />{student.active ? "Active" : "Inactive"}</span></td>
                    <td><span className="super-users-date">{formatDate(student.last_login_at)}</span></td>
                    <td><div className="super-users-row-actions"><button type="button" className="super-users-view" onClick={() => navigate(`/super-admin/users/${encodeURIComponent(student.id)}`)} aria-label={`View ${student.display_name || student.email || "student"} academic record`} title="Academic record"><Eye size={16} /></button><button type="button" className="super-users-view activity-view" onClick={() => void openStudentActivity(student)} aria-label={`View activity for ${student.display_name || student.email || "student"}`} title="Activity timeline"><Activity size={16} /></button></div></td>
                  </tr>)}
              </tbody>
            </table>
          ) : (
            <table className="super-users-table super-users-guest-table">
              <thead><tr><th>GUEST SESSION ID</th><th>BRANCH</th><th>FIRST SEEN</th><th>LAST ACTIVITY</th><th>EXPIRES</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7}><div className="super-users-state"><span className="super-users-loader" />Loading guest sessions…</div></td></tr>
                  : error ? <tr><td colSpan={7}><div className="super-users-state">Guest sessions could not be loaded.</div></td></tr>
                  : visibleGuests.length === 0 ? <tr><td colSpan={7}><div className="super-users-state"><Activity size={25} /><strong>No guest sessions found</strong><span>Guest sessions will appear here when the guest-session API has recorded them.</span></div></td></tr>
                  : visibleGuests.map((guest) => <tr key={guest.id}>
                    <td><div className="super-users-person"><span className="super-users-avatar guest-avatar"><Activity size={16} /></span><span className="super-users-person-copy"><strong>Guest visitor</strong><small title={guest.id}>{guest.id}</small></span></div></td>
                    <td><span className="super-users-date">{formatDate(guest.first_seen_at)}</span></td>
                    <td><span className="super-users-date">{formatDate(guest.last_seen_at)}</span></td>
                    <td><span className="super-users-date">{guest.expires_at ? formatDate(guest.expires_at) : "No expiry set"}</span></td>
                    <td><span className={`super-users-status ${guest.active ? "is-active" : "is-inactive"}`}><span />{guest.active ? "Active" : "Expired"}</span></td>
                    <td>{String(guest.metadata?.source || "Web")}</td>
                    <td><button type="button" className="super-users-view" onClick={() => setSelectedGuest(guest)} aria-label="Inspect guest session" title="Inspect session"><Eye size={16} /></button></td>
                  </tr>)}
              </tbody>
            </table>
          )}
        </div>

        <footer className="super-users-pagination">
          <span>Showing {filteredCount ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredCount)} of {filteredCount} {directoryType === "registered" ? "users" : "guest sessions"}</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1} aria-label="Previous page"><ChevronLeft size={16} /> Previous</button>
            <span>Page {safePage} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages} aria-label="Next page">Next <ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      <p className="super-users-privacy-note"><ShieldCheck size={13} /> Admin tools: search, filter, refresh, inspect guest-session metadata, view registered academic records, and export the current filtered list. Guest sessions are anonymous and their session tokens are never displayed or exported.</p>

      {activityStudent && <div className="super-users-modal-backdrop" role="presentation" onClick={() => setActivityStudent(null)}>
        <section className="super-users-modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="student-activity-title" onClick={(event) => event.stopPropagation()}>
          <div className="super-users-modal-heading"><div><span className="super-users-kicker">STUDENT ACTIVITY</span><h2 id="student-activity-title">{activityStudent.display_name || activityStudent.email || "Student"} timeline</h2><p>{activityStudent.email || "No email"} · {activityStudent.branch_name || "Branch not provided"}</p></div><button type="button" onClick={() => setActivityStudent(null)} aria-label="Close activity timeline"><X size={18} /></button></div>
          {activityLoading ? <div className="super-users-state"><span className="super-users-loader" />Loading recorded activity…</div> : activityError ? <div className="super-users-error" role="alert">{activityError}</div> : activityEvents.length ? <ol className="super-users-activity-list">{activityEvents.map((event) => <li key={String(event.id)}><span className="activity-dot" /><div><strong>{event.action.replace(/_/g, " ").toLowerCase()}</strong><time>{formatDate(event.created_at)}</time><small>{event.entity_table ? `Area: ${event.entity_table}` : "Recorded application event"}</small></div></li>)}</ol> : <div className="super-users-state"><Activity size={24} /><strong>No recorded activity yet</strong><span>Only events already written to the audit log can be shown here. This is not a full clickstream.</span></div>}
          <p className="super-users-activity-disclaimer">For privacy and accuracy, this timeline shows recorded audit events only. Actions not instrumented by the app will not appear.</p>
          <button type="button" className="super-users-modal-close" onClick={() => setActivityStudent(null)}>Close timeline</button>
        </section>
      </div>}


      {guestActivityTarget && <div className="super-users-modal-backdrop" role="presentation" onClick={() => setGuestActivityTarget(null)}>
        <section className="super-users-modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="guest-activity-title" onClick={(event) => event.stopPropagation()}>
          <div className="super-users-modal-heading"><div><span className="super-users-kicker">GUEST ACTIVITY</span><h2 id="guest-activity-title">Guest session timeline</h2><p>{guestActivityTarget.id}</p><p>{String(guestActivityTarget.metadata?.branch_name || "Branch not selected")}</p></div><button type="button" onClick={() => setGuestActivityTarget(null)} aria-label="Close guest activity"><X size={18} /></button></div>
          {activityLoading ? <div className="super-users-state"><span className="super-users-loader" />Loading recorded activity…</div> : activityError ? <div className="super-users-error" role="alert">{activityError}</div> : activityEvents.length ? <ol className="super-users-activity-list">{activityEvents.map((event) => <li key={String(event.id)}><span className="activity-dot" /><div><strong>{event.action.replace(/_/g, " ").toLowerCase()}</strong><time>{formatDate(event.created_at)}</time><small>{event.metadata ? JSON.stringify(event.metadata) : (event.entity_table ? `Area: ${event.entity_table}` : "Recorded guest event")}</small></div></li>)}</ol> : <div className="super-users-state"><Activity size={24} /><strong>No recorded activity yet</strong><span>New guest branch selections and academic actions will appear here after the updated backend is running. Historical actions that were not logged cannot be reconstructed.</span></div>}
          <p className="super-users-activity-disclaimer">This timeline contains recorded events only. It does not expose guest session tokens.</p>
          <button type="button" className="super-users-modal-close" onClick={() => setGuestActivityTarget(null)}>Close timeline</button>
        </section>
      </div>}
\n      {selectedGuest && <div className="super-users-modal-backdrop" role="presentation" onClick={() => setSelectedGuest(null)}>
        <section className="super-users-modal" role="dialog" aria-modal="true" aria-labelledby="guest-modal-title" onClick={(event) => event.stopPropagation()}>
          <div className="super-users-modal-heading"><div><span className="super-users-kicker">SESSION INSPECTOR</span><h2 id="guest-modal-title">Guest session details</h2></div><button type="button" onClick={() => setSelectedGuest(null)} aria-label="Close session details"><X size={18} /></button></div>
          <dl>
            <div><dt>Session ID</dt><dd>{selectedGuest.id}</dd></div>
            <div><dt>Status</dt><dd>{selectedGuest.active ? "Active / unexpired" : "Expired"}</dd></div>
            <div><dt>First seen</dt><dd>{formatDate(selectedGuest.first_seen_at)}</dd></div>
            <div><dt>Last activity</dt><dd>{formatDate(selectedGuest.last_seen_at)}</dd></div>
            <div><dt>Expires</dt><dd>{selectedGuest.expires_at ? formatDate(selectedGuest.expires_at) : "No expiry set"}</dd></div>
            <div><dt>Branch</dt><dd>{String(selectedGuest.metadata?.branch_name || "Not selected")}</dd></div>\n            <div><dt>Program</dt><dd>{String(selectedGuest.metadata?.program_name || "Not selected")}</dd></div>\n            <div><dt>Institution</dt><dd>{String(selectedGuest.metadata?.institution_name || "Not selected")}</dd></div>\n            <div><dt>Metadata</dt><dd><code>{JSON.stringify(selectedGuest.metadata || {}, null, 2)}</code></dd></div>
          </dl>
          <p>Session credentials are intentionally hidden. This view is read-only.</p>
          <button type="button" className="super-users-modal-close" onClick={() => setSelectedGuest(null)}>Close details</button>
        </section>
      </div>}
    </main>
  );
}
