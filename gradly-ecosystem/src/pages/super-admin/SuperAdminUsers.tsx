import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
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
  institution_name: string | null;
  program_name: string | null;
  branch_name: string | null;
}

interface UsersResponse {
  students: Student[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  message?: string;
}

const PAGE_SIZE = 25;

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchDraft, setSearchDraft] = useState("");
  const [institutionDraft, setInstitutionDraft] = useState("");
  const [programDraft, setProgramDraft] = useState("");
  const [branchDraft, setBranchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [institution, setInstitution] = useState("");
  const [program, setProgram] = useState("");
  const [branch, setBranch] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!isApiConfigured) {
        throw new Error(API_CONFIGURATION_ERROR);
      }

      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) {
        navigate("/super-admin/login", { replace: true });
        return;
      }

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (institution) params.set("institution", institution);
      if (program) params.set("program", program);
      if (branch) params.set("branch", branch);

      const response = await fetch(
        API_BASE_URL + "/api/super-admin/users?" + params.toString(),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + token,
          },
        }
      );

      const data = await response.json().catch(() => ({})) as Partial<UsersResponse>;

      if (response.status === 401) {
        localStorage.removeItem("gradly_super_admin_token");
        navigate("/super-admin/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to load student records.");
      }

      setStudents(Array.isArray(data.students) ? data.students : []);
      setCount(Number.isFinite(data.count) ? Number(data.count) : 0);
      setTotalPages(Number.isFinite(data.totalPages) ? Number(data.totalPages) : 0);
    } catch (requestError) {
      setStudents([]);
      setCount(0);
      setTotalPages(0);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load student records."
      );
    } finally {
      setLoading(false);
    }
  }, [branch, institution, navigate, page, program, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
    setInstitution(institutionDraft.trim());
    setProgram(programDraft.trim());
    setBranch(branchDraft.trim());
  }

  function clearFilters() {
    setSearchDraft("");
    setInstitutionDraft("");
    setProgramDraft("");
    setBranchDraft("");
    setSearch("");
    setInstitution("");
    setProgram("");
    setBranch("");
    setPage(1);
  }

  return (
    <main className="super-users-page">
      <header className="super-users-header">
        <div>
          <div className="super-users-kicker">GRADLY / SYSTEM CONTROL</div>
          <h1>Student accounts</h1>
          <p>Search and inspect student profiles and academic summaries.</p>
        </div>
        <button
          type="button"
          className="super-users-refresh"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "refresh-spinning" : ""} />
          Refresh
        </button>
      </header>

      <form className="super-users-filter-form" onSubmit={applyFilters}>
        <div className="super-users-toolbar">
          <label className="super-users-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search name, email, student ID or branch"
              aria-label="Search student accounts"
            />
          </label>
          <button className="super-users-apply" type="submit">
            Apply filters
          </button>
          <button
            className="super-users-clear"
            type="button"
            onClick={clearFilters}
            aria-label="Clear all filters"
          >
            <X size={14} />
            Clear
          </button>
          <div className="super-users-count" aria-live="polite">
            {count.toLocaleString()} students
          </div>
        </div>

        <div className="super-users-filter-grid">
          <label>
            <span>Institute</span>
            <input
              value={institutionDraft}
              onChange={(event) => setInstitutionDraft(event.target.value)}
              placeholder="Filter by institute"
            />
          </label>
          <label>
            <span>Program</span>
            <input
              value={programDraft}
              onChange={(event) => setProgramDraft(event.target.value)}
              placeholder="Filter by program"
            />
          </label>
          <label>
            <span>Branch</span>
            <input
              value={branchDraft}
              onChange={(event) => setBranchDraft(event.target.value)}
              placeholder="Filter by branch"
            />
          </label>
        </div>
      </form>

      {error && (
        <div className="super-users-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="super-users-table" aria-label="Student accounts">
        <div className="super-users-table-head">
          <span>STUDENT</span>
          <span>INSTITUTE</span>
          <span>PROGRAM</span>
          <span>BRANCH</span>
          <span>CGPA</span>
          <span>STATUS</span>
          <span aria-hidden="true" />
        </div>

        {loading ? (
          <div className="super-users-empty" role="status">
            <RefreshCw size={20} className="refresh-spinning" />
            <strong>Loading student records</strong>
            <span>Please wait while Gradly retrieves this page.</span>
          </div>
        ) : error ? (
          <div className="super-users-empty">
            <AlertCircle size={20} />
            <strong>Student records unavailable</strong>
            <span>Check the API configuration and your session, then retry.</span>
          </div>
        ) : students.length === 0 ? (
          <div className="super-users-empty">
            <UserRound size={20} />
            <strong>No students found</strong>
            <span>Try changing or clearing your filters.</span>
          </div>
        ) : (
          students.map((student) => (
            <button
              type="button"
              className="super-user-row"
              key={student.id}
              onClick={() => navigate("/super-admin/users/" + encodeURIComponent(student.id))}
              aria-label={"View student " + (student.display_name || student.email || student.id)}
            >
              <span className="super-user-main">
                <span className="super-user-avatar">
                  <UserRound size={16} />
                </span>
                <span className="super-user-identity">
                  <strong>{student.display_name || "Unnamed student"}</strong>
                  <span>{student.email || student.student_identifier || "No email or student ID"}</span>
                </span>
              </span>
              <span className="super-user-cell">{student.institution_name || "—"}</span>
              <span className="super-user-cell">{student.program_name || "—"}</span>
              <span className="super-user-cell">{student.branch_name || "—"}</span>
              <span className="super-user-cgpa">
                {student.current_cgpa !== null && Number.isFinite(Number(student.current_cgpa))
                  ? Number(student.current_cgpa).toFixed(2)
                  : "—"}
              </span>
              <span className={"user-status " + (student.active ? "active" : "inactive")}>
                {student.active ? "ACTIVE" : "INACTIVE"}
              </span>
              <span className="super-user-row-arrow" aria-hidden="true">
                <ChevronRight size={16} />
              </span>
            </button>
          ))
        )}
      </section>

      <nav className="super-users-pagination" aria-label="Student list pagination">
        <span>
          {count === 0
            ? "No results"
            : "Page " + page + " of " + Math.max(totalPages, 1)}
        </span>
        <div>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
          >
            <ChevronLeft size={15} />
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || totalPages === 0 || page >= totalPages}
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      </nav>
    </main>
  );
}
