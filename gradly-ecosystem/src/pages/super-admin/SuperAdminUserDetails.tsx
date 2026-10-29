import {
    ArrowLeft,
    BookOpen,
    GraduationCap,
    Mail,
    UserRound,
    ShieldCheck,
    Bell,
    Power,
  } from "lucide-react";
  
import { useEffect, useState } from "react";
  
import { useNavigate, useParams } from "react-router-dom";
  
import "./SuperAdminUserDetails.css";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
  
  
  interface Student {
    id: string;
    email: string | null;
    display_name: string | null;
    active: boolean;
  
    student_identifier: string | null;
    admission_year: number | null;
    current_semester_number: number | null;
    graduation_year: number | null;
  
    target_cgpa: number | null;
    current_cgpa: number | null;
    current_earned_credits: number | null;
  
    institution_name: string | null;
    program_name: string | null;
    branch_name: string | null;
    scheme_name: string | null;
  }
  
  
  interface Course {
    id: string;
    course_code_snapshot: string | null;
    course_name_snapshot: string | null;
    credits: number | null;
    registration_status: string | null;
    grade_symbol: string | null;
    grade_point: number | null;
    marks: number | null;
    maximum_marks: number | null;
    result_status: string | null;
    result_source: string | null;
    verified: boolean;
  }
  
  
  interface Semester {
    id: string;
    semester_number: number;
    semester_name: string | null;
    attempt_number: number;
    status: string;
    result_publication_status: string;
    result_source: string;
    verified: boolean;
    credits_registered: number | null;
    credits_earned: number | null;
    sgpa: number | null;
    result_declared_at: string | null;
    courses: Course[];
  }
  
  
  export default function SuperAdminUserDetails() {
  
    const navigate = useNavigate();
  
    const { userId } =
      useParams();
  
    const [student, setStudent] =
      useState<Student | null>(null);
  
    const [semesters, setSemesters] =
      useState<Semester[]>([]);
  
    const [loading, setLoading] =
      useState(true);
  
    const [error, setError] =
      useState("");
    const [activeTab, setActiveTab] = useState<"profile" | "activity" | "actions">("profile");
    const [actionBusy, setActionBusy] = useState(false);
    const [actionMessage, setActionMessage] = useState("");
    const [actionError, setActionError] = useState("");
    const [noticeTitle, setNoticeTitle] = useState("");
    const [noticeBody, setNoticeBody] = useState("");
  
  
    useEffect(() => {
  
      async function loadStudent() {
  
        if (!userId) {
          setError(
            "User ID is missing."
          );
  
          setLoading(false);
  
          return;
        }
  
        try {
          if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
          const token =
            localStorage.getItem(
              "gradly_super_admin_token"
            );
  
          if (!token) {
            setError(
              "Super Admin authentication token not found."
            );
  
            return;
          }
  
          const response = await fetch(
            `${API_BASE_URL}/api/super-admin/users/${encodeURIComponent(userId)}`,
            { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
          );
          const data = await response.json().catch(() => null);
          if (response.status === 401) {
            localStorage.removeItem("gradly_super_admin_token");
            navigate("/super-admin/login", { replace: true });
            setError("Your session expired. Please sign in again.");
            return;
          }
          if (response.status === 403) {
            setError("This account is not authorized to view student records.");
            return;
          }
          if (!response.ok) {
            setError(data?.message || `Failed to load student (HTTP ${response.status}).`);
            return;
          }
  
          setStudent(data.student);
  
          setSemesters(
            data.semesters || []
          );
  
        } catch (error) {
  
          console.error(
            "Failed to load student details:",
            error
          );
  
          setError(
            "Unable to connect to the Gradly server."
          );
  
        } finally {
  
          setLoading(false);
  
        }
      }
  
      loadStudent();
  
    }, [userId, navigate]);
  
  
    if (loading) {
      return (
        <div className="super-user-details-loading">
          Loading user profile and academic records...
        </div>
      );
    }
  
  
    if (error) {
      return (
        <div className="super-user-details-error">
          <strong>
            USER RECORD ERROR
          </strong>
  
          <span>
            {error}
          </span>
  
          <button
            onClick={() =>
              navigate(
                "/super-admin/users"
              )
            }
          >
            Back to Users
          </button>
        </div>
      );
    }
  
  
    if (!student) {
      return null;
    }
  
  
    return (
      <div className="super-user-details-page">
  
        {/* HEADER */}
  
        <div className="super-user-details-top">
  
          <button
            className="super-user-back"
            onClick={() =>
              navigate(
                "/super-admin/users"
              )
            }
          >
            <ArrowLeft size={15} />
  
            Back to Users
          </button>
  
          <div className="super-user-details-code">
            USER / PROFILE & ACADEMICS
          </div>
  
        </div>
  
  
        <nav className="super-user-detail-tabs" aria-label="User management sections">
          <button type="button" className={activeTab === "profile" ? "is-active" : ""} aria-current={activeTab === "profile" ? "page" : undefined} onClick={() => setActiveTab("profile")}><UserRound size={15} /> Profile</button>
          <button type="button" className={activeTab === "activity" ? "is-active" : ""} onClick={() => { if (userId) navigate(`/super-admin/users/${encodeURIComponent(userId)}/activity`); }}><BookOpen size={15} /> Activity</button>
          <button type="button" className={activeTab === "actions" ? "is-active" : ""} onClick={() => setActiveTab("actions")}><ShieldCheck size={15} /> Actions</button>
        </nav>

        {activeTab === "actions" ? (
          <section className="student-information" aria-labelledby="user-actions-title">
            <div className="student-section-heading"><div><div className="student-section-kicker">ACCOUNT CONTROL</div><h2 id="user-actions-title">Actions for {student.display_name || student.email || "this user"}</h2><p>Changes apply only to this registered account.</p></div></div>
            {actionError && <p role="alert" style={{ color: "#a33232", background: "#fff0f0", borderRadius: 10, padding: 12 }}>{actionError}</p>}
            {actionMessage && <p role="status" style={{ color: "#17663b", background: "#effcf4", borderRadius: 10, padding: 12 }}>{actionMessage}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "16px 0 24px" }}>
              <button type="button" disabled={actionBusy} onClick={async () => {
                const nextActive = !student.active;
                if (!window.confirm(`Are you sure you want to ${nextActive ? "reactivate" : "disable"} this account?`)) return;
                setActionBusy(true); setActionError(""); setActionMessage("");
                try {
                  const token = localStorage.getItem("gradly_super_admin_token");
                  if (!token) throw new Error("Super Admin session is missing. Sign in again.");
                  const response = await fetch(`${API_BASE_URL}/api/super-admin/users/${encodeURIComponent(student.id)}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ active: nextActive }) });
                  const result = await response.json().catch(() => null);
                  if (response.status === 401) throw new Error("Super Admin session expired. Please sign in again.");
                  if (!response.ok) throw new Error(result?.message || `Could not ${nextActive ? "reactivate" : "disable"} account.`);
                  setStudent((current) => current ? { ...current, active: nextActive } : current);
                  setActionMessage(result?.message || `Account ${nextActive ? "reactivated" : "disabled"} successfully.`);
                } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Account action failed."); }
                finally { setActionBusy(false); }
              }} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #ded6f5", borderRadius: 10, padding: "11px 16px", background: student.active ? "#fff0f0" : "#effcf4", color: student.active ? "#a33232" : "#17663b", fontWeight: 750, cursor: actionBusy ? "wait" : "pointer" }}><Power size={16} />{actionBusy ? "Saving…" : student.active ? "Disable user" : "Reactivate user"}</button>
            </div>
            <div style={{ borderTop: "1px solid #e8e1f5", paddingTop: 20 }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Bell size={18} /> Send notice to this user</h3>
              <p style={{ color: "#776d89", fontSize: 13 }}>Send a specific account notice or announcement to this registered user.</p>
              <form onSubmit={async (event) => {
                event.preventDefault(); setActionError(""); setActionMessage("");
                setActionError("Notice delivery is not enabled on the backend yet. The notice was not sent.");
              }} style={{ display: "grid", gap: 12, maxWidth: 720 }}>
                <label style={{ display: "grid", gap: 6, fontWeight: 650, color: "#50328d" }}>Notice title<input required maxLength={120} value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="e.g. Important account update" style={{ minHeight: 42, border: "1px solid #ddd5f4", borderRadius: 10, padding: "10px 12px" }} /></label>
                <label style={{ display: "grid", gap: 6, fontWeight: 650, color: "#50328d" }}>Message<textarea required maxLength={3000} rows={5} value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="Write the notice for this user…" style={{ border: "1px solid #ddd5f4", borderRadius: 10, padding: "10px 12px", resize: "vertical" }} /></label>
                <button type="submit" style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 8, border: 0, borderRadius: 10, padding: "11px 16px", background: "linear-gradient(135deg,#7954d7,#50318f)", color: "#fff", fontWeight: 750, cursor: "pointer" }}><Bell size={16} /> Send notice</button>
              </form>
            </div>
          </section>
        ) : (
        {/* PROFILE */}
  
        <section className="student-profile-card">
  
          <div className="student-profile-icon">
            <UserRound size={30} />
          </div>
  
          <div className="student-profile-main">
  
            <h1>
              {student.display_name ||
                "Unnamed User"}
            </h1>
  
            <div className="student-profile-meta">
  
              <span>
                <Mail size={13} />
  
                {student.email ||
                  "No email"}
              </span>
  
              <span>
                <GraduationCap size={13} />
  
                {student.branch_name ||
                  "Branch not available"}
              </span>
  
            </div>
  
          </div>
  
          <div
            className={
              student.active
                ? "student-account active"
                : "student-account inactive"
            }
          >
            {student.active
              ? "ACTIVE"
              : "INACTIVE"}
          </div>
  
        </section>
  
  
        {/* SUMMARY */}
  
        <section className="student-summary-grid">
  
          <div className="student-summary-card">
  
            <span>
              CGPA
            </span>
  
            <strong>
              {student.current_cgpa !== null
                ? Number(
                    student.current_cgpa
                  ).toFixed(2)
                : "—"}
            </strong>
  
          </div>
  
  
          <div className="student-summary-card">
  
            <span>
              CURRENT SEMESTER
            </span>
  
            <strong>
              {student.current_semester_number
                ? `SEM ${student.current_semester_number}`
                : "—"}
            </strong>
  
          </div>
  
  
          <div className="student-summary-card">
  
            <span>
              EARNED CREDITS
            </span>
  
            <strong>
              {student.current_earned_credits ??
                "—"}
            </strong>
  
          </div>
  
  
          <div className="student-summary-card">
  
            <span>
              TARGET CGPA
            </span>
  
            <strong>
              {student.target_cgpa !== null
                ? Number(
                    student.target_cgpa
                  ).toFixed(2)
                : "—"}
            </strong>
  
          </div>
  
        </section>
  
  
        {/* PROFILE INFORMATION */}
  
        <section className="student-information">
  
          <div className="student-section-heading">
  
            <div>
              <div className="student-section-kicker">
                ACCOUNT / ACADEMIC PROFILE
              </div>
  
              <h2>
                Student Information
              </h2>
            </div>
  
          </div>
  
  
          <div className="student-information-grid">
  
            <InfoItem
              label="Enrollment Number"
              value={
                student.student_identifier
              }
            />
  
            <InfoItem
              label="Institution"
              value={
                student.institution_name
              }
            />
  
            <InfoItem
              label="Program"
              value={
                student.program_name
              }
            />
  
            <InfoItem
              label="Branch"
              value={
                student.branch_name
              }
            />
  
            <InfoItem
              label="Scheme"
              value={
                student.scheme_name
              }
            />
  
            <InfoItem
              label="Admission Year"
              value={
                student.admission_year
              }
  
            />
  
            <InfoItem
              label="Graduation Year"
              value={
                student.graduation_year
              }
  
            />
  
          </div>
  
        </section>
  
  
        {/* SEMESTERS */}
  
        <section className="student-academic">
  
          <div className="student-section-heading">
  
            <div>
  
              <div className="student-section-kicker">
                ACADEMIC HISTORY
              </div>
  
              <h2>
                Semester Results
              </h2>
  
            </div>
  
          </div>
  
  
          {semesters.length === 0 ? (
  
            <div className="student-no-results">
              No semester records available.
            </div>
  
          ) : (
  
            semesters.map(
              (semester) => (
  
                <div
                  className="semester-card"
                  key={semester.id}
                >
  
                  <div className="semester-header">
  
                    <div>
  
                      <div className="semester-title">
  
                        <BookOpen size={17} />
  
                        Semester{" "}
                        {semester.semester_number}
  
                      </div>
  
                      <span>
                        Attempt{" "}
                        {semester.attempt_number}
                      </span>
  
                    </div>
  
  
                    <div className="semester-metrics">
  
                      <div>
                        <span>
                          SGPA
                        </span>
  
                        <strong>
                          {semester.sgpa !== null
                            ? Number(
                                semester.sgpa
                              ).toFixed(2)
                            : "—"}
                        </strong>
                      </div>
  
                      <div>
                        <span>
                          CREDITS
                        </span>
  
                        <strong>
                          {semester.credits_earned ??
                            "—"}
                        </strong>
                      </div>
  
                    </div>
  
                  </div>
  
  
                  <div className="course-table">
  
                    <div className="course-table-head">
  
                      <span>
                        SUBJECT
                      </span>
  
                      <span>
                        CREDITS
                      </span>
  
                      <span>
                        MARKS
                      </span>
  
                      <span>
                        GRADE
                      </span>
  
                      <span>
                        GRADE POINT
                      </span>
  
                      <span>
                        RESULT
                      </span>
  
                    </div>
  
  
                    {semester.courses.length ===
                    0 ? (
  
                      <div className="course-empty">
                        No course records available.
                      </div>
  
                    ) : (
  
                      semester.courses.map(
                        (course) => (
  
                          <div
                            className="course-row"
                            key={course.id}
                          >
  
                            <div>
  
                              <strong>
                                {
                                  course.course_name_snapshot ||
                                  "Unnamed Subject"
                                }
                              </strong>
  
                              <span>
                                {
                                  course.course_code_snapshot ||
                                  "No course code"
                                }
                              </span>
  
                            </div>
  
                            <span>
                              {course.credits ??
                                "—"}
                            </span>
  
                            <span>
                              {course.marks !== null
                                ? `${course.marks}${
                                    course.maximum_marks
                                      ? ` / ${course.maximum_marks}`
                                      : ""
                                  }`
                                : "—"}
                            </span>
  
                            <strong>
                              {course.grade_symbol ||
                                "—"}
                            </strong>
  
                            <span>
                              {course.grade_point ??
                                "—"}
                            </span>
  
                            <span>
                              {course.result_status ||
                                "—"}
                            </span>
  
                          </div>
  
                        )
                      )
  
                    )}
  
                  </div>
  
                </div>
  
              )
            )
  
          )}
  
        </section>
          )}
  
      </div>
    );
  }
  
  
  function InfoItem({
    label,
    value,
  }: {
    label: string;
    value:
      | string
      | number
      | null
      | undefined;
  }) {
  
    return (
      <div className="student-info-item">
  
        <span>
          {label}
        </span>
  
        <strong>
          {value ?? "—"}
        </strong>
  
      </div>
    );
  }