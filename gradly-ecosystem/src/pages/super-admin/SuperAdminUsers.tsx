import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Users,
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

interface UsersResponse {
  students: Student[];
  count: number;
}

const PAGE_SIZE = 10;

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

function formatDate(value: string | null) {
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

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadUsers = useCallback(async (quiet = false) => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) {
      setError("Your Super Admin session is missing. Please sign in again.");
      setStudents([]);
      setTotalCount(0);
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
      const response = await fetch(
        `${getApiBaseUrl()}/api/super-admin/users?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (response.status === 401 || response.status === 403) {
        throw new Error("Access denied. Your Super Admin session may have expired.");
      }
      if (!response.ok) throw new Error("Could not load user records. Please retry.");

      const data = (await response.json()) as UsersResponse;
      const rows = Array.isArray(data.students) ? data.students : [];
      setStudents(rows);
      setTotalCount(typeof data.count === "number" ? data.count : rows.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load user records.");
      setStudents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredStudents = useMemo(() => {
    if (statusFilter === "active") return students.filter((student) => student.active);
    if (statusFilter === "inactive") return students.filter((student) => !student.active);
    return students;
  }, [students, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleStudents = filteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCount = students.filter((student) => student.active).length;

  return (
    <main className="super-users-page">
      <header className="super-users-header">
        <div>
          <div className="super-users-kicker">GRADLY / USER MANAGEMENT</div>
          <h1>Users</h1>
          <p>Search and review registered student accounts across the Gradly ecosystem.</p>
        </div>
        <button type="button" className="super-users-refresh" onClick={() => void loadUsers(true)} disabled={loading || refreshing}>
          <RefreshCw size={15} className={refreshing ? "super-users-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh users"}
        </button>
      </header>

      <section className="super-users-stats" aria-label="User summary">
        <div className="super-users-stat-card">
          <span className="super-users-stat-icon"><Users size={18} /></span>
          <div><span className="super-users-stat-label">MATCHING ACCOUNTS</span><strong>{loading ? "—" : totalCount}</strong><small>Results from the connected user API</small></div>
        </div>
        <div className="super-users-stat-card">
          <span className="super-users-stat-icon active"><Users size={18} /></span>
          <div><span className="super-users-stat-label">ACTIVE IN RESULTS</span><strong>{loading ? "—" : activeCount}</strong><small>Accounts marked active in this result set</small></div>
        </div>
      </section>

      <section className="super-users-directory">
        <div className="super-users-directory-heading">
          <div><h2>Student directory</h2><p>Search by name, email, enrollment number, or branch.</p></div>
          <span className="super-users-live-badge"><span /> API CONNECTED WHEN AVAILABLE</span>
        </div>

        <div className="super-users-toolbar">
          <label className="super-users-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email, enrollment no. or branch…"
              aria-label="Search users"
            />
            {searchInput && <button type="button" className="super-users-clear" onClick={() => setSearchInput("")} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <label className="super-users-filter">
            <Filter size={15} />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1); }} aria-label="Filter by account status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        {error && <div className="super-users-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => void loadUsers()}>Retry</button></div>}

        <div className="super-users-table-wrap">
          <table className="super-users-table">
            <thead><tr>
              <th>STUDENT</th><th>ENROLLMENT NO.</th><th>BRANCH / PROGRAM</th><th>SEMESTER</th><th>CGPA</th><th>STATUS</th><th>LAST LOGIN</th><th><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="super-users-state"><span className="super-users-loader" />Loading user records…</div></td></tr>
              ) : error ? (
                <tr><td colSpan={8}><div className="super-users-state">User records could not be loaded.</div></td></tr>
              ) : visibleStudents.length === 0 ? (
                <tr><td colSpan={8}><div className="super-users-state"><Users size={25} /><strong>No users found</strong><span>{search ? "Try another name, email, enrollment number, or branch." : "Registered student accounts will appear here when available."}</span></div></td></tr>
              ) : visibleStudents.map((student) => (
                <tr key={student.id}>
                  <td><div className="super-users-person"><span className="super-users-avatar">{initials(student.display_name, student.email)}</span><span className="super-users-person-copy"><strong>{student.display_name || "Unnamed student"}</strong><small>{student.email || "No email provided"}</small></span></div></td>
                  <td>{student.student_identifier || "—"}</td>
                  <td><span className="super-users-branch">{student.branch_name || "Not provided"}</span><small className="super-users-subtext">{student.program_name || ""}</small></td>
                  <td>{student.current_semester_number ? `Semester ${student.current_semester_number}` : "—"}</td>
                  <td><strong className="super-users-cgpa">{student.current_cgpa == null ? "—" : Number(student.current_cgpa).toFixed(2)}</strong></td>
                  <td><span className={`super-users-status ${student.active ? "is-active" : "is-inactive"}`}><span />{student.active ? "Active" : "Inactive"}</span></td>
                  <td><span className="super-users-date">{formatDate(student.last_login_at)}</span></td>
                  <td><button type="button" className="super-users-view" onClick={() => navigate(`/super-admin/users/${encodeURIComponent(student.id)}`)} aria-label={`View ${student.display_name || student.email || "student"} details`} title="View user details"><Eye size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="super-users-pagination">
          <span>Showing {filteredStudents.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} filtered results</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1} aria-label="Previous page"><ChevronLeft size={16} /> Previous</button>
            <span>Page {safePage} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages} aria-label="Next page">Next <ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>
      <p className="super-users-privacy-note">User records are shown for authorized administrative review. Sensitive credentials are never displayed.</p>
    </main>
  );
}
