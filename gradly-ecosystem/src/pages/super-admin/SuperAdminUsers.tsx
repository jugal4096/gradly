import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
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
  branch_name: string | null;
}

interface UsersResponse {
  students?: Student[];
  count?: number;
  message?: string;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      const encodedQuery = params.toString();
      const suffix = encodedQuery ? `?${encodedQuery}` : "";
      const response = await fetch(`${API_BASE_URL}/api/super-admin/users${suffix}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal,
      });
      const result = await response.json().catch(() => null) as UsersResponse | null;
      if (response.status === 401) {
        localStorage.removeItem("gradly_super_admin_token");
        navigate("/super-admin/login", { replace: true });
        throw new Error("Your session expired. Please sign in again.");
      }
      if (response.status === 403) {
        throw new Error("This account is not authorized to view student records.");
      }
      if (!response.ok) throw new Error(result?.message || `Unable to load users (HTTP ${response.status}).`);
      if (!Array.isArray(result?.students)) throw new Error("The API returned an unexpected user list.");
      setStudents(result.students);
      setCount(typeof result.count === "number" && Number.isFinite(result.count) ? result.count : result.students.length);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setStudents([]);
      setCount(null);
      setError(caught instanceof Error ? caught.message : "Unable to load users.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [navigate, query]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(search);
  }

  return (
    <main className="super-dashboard" style={{ minHeight: "70vh" }}>
      <header className="sd-header">
        <div className="sd-header-copy">
          <div className="sd-eyebrow"><Users size={14} /> GRADLY / PLATFORM ACCOUNTS</div>
          <h1>User management</h1>
          <p>Search platform accounts and inspect academic profile details.</p>
        </div>
        <button className="sd-refresh-button" type="button" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "sd-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <section className="sd-section">
        <form onSubmit={submitSearch} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px" }}>
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search users</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or student identifier" style={{ width: "100%", minHeight: 42, border: "1px solid #e0e3ef", borderRadius: 10, padding: "8px 12px", background: "#fff" }} />
          </label>
          <button className="sd-refresh-button" type="submit" disabled={loading}>Search users</button>
        </form>

        {error && <div role="alert" className="sd-error"><div className="sd-error-copy"><strong>Users could not be loaded</strong><p>{error}</p></div><button className="sd-error-retry" type="button" onClick={() => void loadUsers()}>Retry</button></div>}

        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e8eaf3", borderRadius: 14 }}>
          <table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["User","Student ID","Branch","Semester / CGPA","Status","Last login","Details"].map((heading) => <th key={heading} scope="col" style={{ padding: 14, borderBottom: "1px solid #e8eaf3", color: "#69738a", fontSize: 12 }}>{heading}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center" }}>Loading user records…</td></tr>
              : students.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center" }}>{error ? "User records are unavailable until the request succeeds." : "No users match this search."}</td></tr>
              : students.map((student) => <tr key={student.id}>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><strong>{student.display_name || "Unnamed user"}</strong><div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{student.email || "No email"} · {student.role || "Role unavailable"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{student.student_identifier || "—"}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{student.branch_name || "—"}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{student.current_semester_number == null ? "—" : student.current_semester_number}<div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>CGPA: {student.current_cgpa == null ? "—" : student.current_cgpa}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{student.active ? "Active" : "Inactive"}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{formatDate(student.last_login_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><button type="button" className="sd-error-retry" onClick={() => navigate(`/super-admin/users/${encodeURIComponent(student.id)}`)}>View details</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#737d91", fontSize: 12, marginTop: 12 }}>{loading ? "Loading results…" : error ? "Count unavailable because the request failed." : `Showing ${students.length} returned records${count == null ? "" : ` (API count: ${count})`}.`}</p>
      </section>
    </main>
  );
}
