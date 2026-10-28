import {
  ArrowDownAZ,
  ArrowUpAZ,
  Building2,
  ChevronDown,
  GraduationCap,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/super-admin-users.css";

const configuredApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api"
).trim().replace(/\/+$/, "");
const API_BASE_URL = /\/api$/i.test(configuredApiBaseUrl)
  ? configuredApiBaseUrl
  : `${configuredApiBaseUrl}/api`;

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
  scheme_name: string | null;
  branch_name: string | null;
}

interface UsersResponse {
  students: Student[];
  count: number;
}

type AcademicField = "institution_name" | "program_name" | "scheme_name" | "branch_name";
type SortField = "display_name" | "institution_name" | "program_name" | "scheme_name" | "branch_name" | "created_at";
type SortDirection = "asc" | "desc";

const ACADEMIC_FILTERS: { key: AcademicField; label: string }[] = [
  { key: "institution_name", label: "Institution" },
  { key: "program_name", label: "Program" },
  { key: "scheme_name", label: "Scheme" },
  { key: "branch_name", label: "Branch" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "display_name", label: "Name" },
  { value: "institution_name", label: "Institution" },
  { value: "program_name", label: "Program" },
  { value: "scheme_name", label: "Scheme" },
  { value: "branch_name", label: "Branch" },
  { value: "created_at", label: "Recently added" },
];

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<AcademicField, string>>({
    institution_name: "",
    program_name: "",
    scheme_name: "",
    branch_name: "",
  });
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  async function loadUsers() {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) {
      setError("Super Admin authentication token not found. Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/super-admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: UsersResponse & { message?: string } = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load user records.");
      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(err instanceof Error ? err.message : "Unable to connect to the Gradly server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const options = useMemo(() => {
    const result = {} as Record<AcademicField, string[]>;
    for (const { key } of ACADEMIC_FILTERS) {
      result[key] = [...new Set(students.map((student) => student[key]?.trim()).filter((value): value is string => Boolean(value)))]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }
    return result;
  }, [students]);

  const visibleStudents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const filtered = students.filter((student) => {
      const matchesSearch = !needle || [
        student.display_name,
        student.email,
        student.student_identifier,
        student.institution_name,
        student.program_name,
        student.scheme_name,
        student.branch_name,
      ].some((value) => value?.toLocaleLowerCase().includes(needle));
      return matchesSearch && ACADEMIC_FILTERS.every(({ key }) =>
        !filters[key] || student[key] === filters[key]
      );
    });

    const compare = (a: Student, b: Student) => {
      if (sortField === "created_at") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return (a[sortField] ?? "").localeCompare(b[sortField] ?? "", undefined, { sensitivity: "base" });
    };
    return filtered.sort((a, b) => compare(a, b) * (sortDirection === "asc" ? 1 : -1));
  }, [students, search, filters, sortField, sortDirection]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function updateFilter(key: AcademicField, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setSearch("");
    setFilters({ institution_name: "", program_name: "", scheme_name: "", branch_name: "" });
  }

  return (
    <main className="sa-users-page">
      <header className="sa-users-header">
        <div>
          <div className="sa-users-eyebrow"><span /> GRADLY / USER DIRECTORY</div>
          <h1>Users <span>Directory</span></h1>
          <p>Find and organize student accounts by institution and academic structure.</p>
        </div>
        <button className="sa-users-refresh" type="button" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "sa-users-spin" : ""} />
          Refresh
        </button>
      </header>

      <section className="sa-users-stat-row" aria-label="User summary">
        <div className="sa-users-stat-card">
          <span className="sa-users-stat-icon"><Users size={18} /></span>
          <div><small>ALL STUDENTS</small><strong>{loading ? "—" : students.length.toLocaleString()}</strong></div>
        </div>
        <div className="sa-users-stat-card">
          <span className="sa-users-stat-icon"><Building2 size={18} /></span>
          <div><small>INSTITUTIONS</small><strong>{options.institution_name.length.toLocaleString()}</strong></div>
        </div>
        <div className="sa-users-stat-card">
          <span className="sa-users-stat-icon"><GraduationCap size={18} /></span>
          <div><small>MATCHING USERS</small><strong>{loading ? "—" : visibleStudents.length.toLocaleString()}</strong></div>
        </div>
      </section>

      <section className="sa-users-panel">
        <div className="sa-users-panel-heading">
          <div>
            <div className="sa-users-kicker">ACADEMIC SEGMENTATION</div>
            <h2>Filter users</h2>
            <p>Combine institution, program, scheme, and branch filters to narrow the directory.</p>
          </div>
          {activeFilterCount > 0 && <span className="sa-users-filter-count">{activeFilterCount} active</span>}
        </div>

        <div className="sa-users-filter-grid">
          {ACADEMIC_FILTERS.map(({ key, label }) => (
            <label className="sa-users-field" key={key}>
              <span>{label}</span>
              <div className="sa-users-select-wrap">
                <select value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)}>
                  <option value="">All {label.toLowerCase()}s</option>
                  {options[key].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>
          ))}
        </div>

        <div className="sa-users-toolbar">
          <label className="sa-users-search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, enrollment no..." />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}
          </label>
          <div className="sa-users-sort">
            <SlidersHorizontal size={16} />
            <label htmlFor="sa-users-sort-field">Sort by</label>
            <select id="sa-users-sort-field" value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" className="sa-users-sort-direction" title={sortDirection === "asc" ? "Switch to descending" : "Switch to ascending"} aria-label="Change sort direction" onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}>
              {sortDirection === "asc" ? <ArrowUpAZ size={17} /> : <ArrowDownAZ size={17} />}
            </button>
          </div>
          <button type="button" className="sa-users-clear" onClick={clearFilters} disabled={!search && activeFilterCount === 0}>Clear all</button>
        </div>
      </section>

      <section className="sa-users-results">
        <div className="sa-users-results-heading">
          <div><h2>Student accounts</h2><p>{loading ? "Loading records…" : `Showing ${visibleStudents.length} of ${students.length} users`}</p></div>
          <span className="sa-users-results-badge">LIVE DIRECTORY</span>
        </div>

        {error ? (
          <div className="sa-users-state sa-users-error"><strong>Could not load users</strong><p>{error}</p><button type="button" onClick={() => void loadUsers()}>Try again</button></div>
        ) : loading ? (
          <div className="sa-users-state">Loading student records…</div>
        ) : visibleStudents.length === 0 ? (
          <div className="sa-users-state"><strong>No matching users</strong><p>Try changing your filters or search terms.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>
        ) : (
          <div className="sa-users-table-scroll">
            <table className="sa-users-table">
              <thead><tr><th>User</th><th>Institution</th><th>Program</th><th>Scheme</th><th>Branch</th><th>Status</th><th>Academic</th><th /></tr></thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td><div className="sa-users-person"><span className="sa-users-avatar">{(student.display_name || student.email || "U").trim().charAt(0).toUpperCase()}</span><div><strong>{student.display_name || "Unnamed student"}</strong><small>{student.email || "No email"}{student.student_identifier ? ` · ${student.student_identifier}` : ""}</small></div></div></td>
                    <td>{student.institution_name || <em>Not assigned</em>}</td>
                    <td>{student.program_name || <em>Not assigned</em>}</td>
                    <td>{student.scheme_name || <em>Not assigned</em>}</td>
                    <td>{student.branch_name || <em>Not assigned</em>}</td>
                    <td><span className={`sa-users-status ${student.active ? "is-active" : "is-inactive"}`}><span />{student.active ? "Active" : "Inactive"}</span></td>
                    <td><div className="sa-users-academic"><strong>{student.current_cgpa !== null ? Number(student.current_cgpa).toFixed(2) : "—"}</strong><small>{student.current_semester_number ? `Semester ${student.current_semester_number}` : "No semester"}</small></div></td>
                    <td><button className="sa-users-view" type="button" onClick={() => navigate(`/super-admin/users/${student.id}`)}>View record <span>↗</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="sa-users-footnote">Filters use the academic profile linked to each student account. Missing profile values are shown as “Not assigned”.</p>
    </main>
  );
}
