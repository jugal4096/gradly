import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";
import TesterStudentPlatform from "./TesterStudentPlatform";

const API = API_BASE_URL.replace(/\/+$/, "");

type Institution = { id: string; name: string; branches?: unknown[] };
type Preview = {
  recognized: boolean;
  requiresConfirmation?: boolean;
  message?: string;
  programme?: string;
  programId?: string;
  branch?: string;
  branchId?: string;
  specialization?: string | null;
  specializationId?: string | null;
  curriculumId?: string;
  curriculumName?: string;
  scheme?: string;
  admissionYear?: number;
  admissionMode?: string;
  admissionModeId?: string | null;
  entrySemester?: number;
  totalSemesters?: number;
  expected?: { expectedSemester: number | null; academicYear?: string; semesterType?: string };
};

export default function TesterWorkspace() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [testerId, setTesterId] = useState("Tester");
  const [query, setQuery] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [enrollment, setEnrollment] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [semester, setSemester] = useState(1);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("gradly_tester_access_token") || "";
    if (!savedToken) { navigate("/tester/login", { replace: true }); return; }
    setToken(savedToken);
    setTesterId(sessionStorage.getItem("gradly_tester_login_id") || "Tester");
    let active = true;
    fetch(API + "/api/tester/me", { headers: { Authorization: "Bearer " + savedToken } })
      .then(response => { if (!response.ok) throw new Error("Tester access is inactive or expired. Contact your Super Admin."); return response.json(); })
      .then(data => { if (active) setTesterId(data.tester?.loginId || sessionStorage.getItem("gradly_tester_login_id") || "Tester"); })
      .catch(reason => { if (!active) return; sessionStorage.removeItem("gradly_tester_access_token"); setError(reason instanceof Error ? reason.message : "Unable to verify tester access."); });
    return () => { active = false; };
  }, [navigate]);


  useEffect(() => {
    const search = query.trim();
    if (search.length < 2 || institution) { setInstitutions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(API + "/api/academic/institutions/search?q=" + encodeURIComponent(search), { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Institution search failed.");
        setInstitutions(Array.isArray(body.data) ? body.data : []);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Institution search failed.");
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, institution]);

  const semesterOptions = useMemo(() => {
    const first = Math.max(1, Number(preview?.entrySemester || 1));
    const last = Math.max(first, Number(preview?.totalSemesters || 12));
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [preview]);

  async function identify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPreview(null);
    if (!institution) { setError("Select an institution before entering the enrollment number."); return; }
    if (!token) { setError("Tester session is not active. Sign in again."); return; }
    if (!enrollment.trim()) { setError("Enter an enrollment number."); return; }
    setBusy(true);
    try {
      const response = await fetch(API + "/api/tester/enrollment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ institutionId: institution.id, enrollmentNumber: enrollment.trim().toUpperCase() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to identify this enrollment.");
      const result = body.data as Preview;
      setPreview(result);
      if (result.recognized && !result.requiresConfirmation) {
        const predicted = Number(result.expected?.expectedSemester || result.entrySemester || 1);
        setSemester(Math.max(Number(result.entrySemester || 1), Math.min(Number(result.totalSemesters || 12), predicted)));
      } else setError(result.message || "This enrollment could not be resolved using the selected institution's academic configuration.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to identify this enrollment.");
    } finally { setBusy(false); }
  }

  function openStudentWorkspace() {
    if (!preview?.recognized || preview.requiresConfirmation || !institution || !token) return;
    const prefix = "gradly_tester_" + crypto.randomUUID();
    const profile = {
      institutionId: institution.id,
      institutionName: institution.name,
      programId: preview.programId || "",
      programName: preview.programme || "",
      branchId: preview.branchId || "",
      branchName: preview.branch || "",
      curriculumId: preview.curriculumId || "",
      semester: String(semester),
      enrollment: enrollment.trim().toUpperCase(),
      admissionYear: String(preview.admissionYear || new Date().getFullYear()),
      admissionMode: preview.admissionMode || "Regular",
      admissionNumber: "",
      scheme: preview.scheme || preview.curriculumName || "",
    };
    sessionStorage.setItem("gradly_tester_storage_prefix", prefix);
    sessionStorage.setItem(prefix + ":gradly_student_profile", JSON.stringify(profile));
    sessionStorage.setItem(prefix + ":gradly_tester_profile_ready", "true");
    setWorkspaceOpen(true);
    setError("");
  }

  function changeStudentIdentity() {
    exitStudentWorkspace();
    setPreview(null);
    setError("");
  }

  function exitStudentWorkspace() {
    const prefix = sessionStorage.getItem("gradly_tester_storage_prefix");
    if (prefix) {
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(prefix + ":")) sessionStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem("gradly_tester_storage_prefix");
    setWorkspaceOpen(false);
  }

  function signOutTester() {
    sessionStorage.removeItem("gradly_tester_access_token");
    sessionStorage.removeItem("gradly_tester_login_id");
    navigate("/tester/login", { replace: true });
  }

  return workspaceOpen ? <TesterStudentPlatform onExit={exitStudentWorkspace} onChangeIdentity={changeStudentIdentity} /> : <main className="tester-virtual-shell">
    <header className="tester-virtual-header">
      <a className="tester-virtual-brand" href="/"><span className="tester-virtual-mark">G</span><span>Gradly <small>VIRTUAL STUDENT ENVIRONMENT</small></span></a>
      <div className="tester-virtual-account"><span>TESTER · {testerId}</span><button type="button" onClick={signOutTester}>Sign out</button></div>
    </header>
    <section className="tester-virtual-main">
      <div className="tester-virtual-heading"><span className="tester-virtual-eyebrow">ISOLATED TEST WORKSPACE</span><h1>Enter a student enrollment number.</h1><p>Choose the institution and enter an enrollment number to preview the academic profile. This virtual environment does not require a student login and does not create or modify a student account.</p></div>
      <form className="tester-virtual-form" onSubmit={identify}>
        <label htmlFor="virtual-institution">INSTITUTION / UNIVERSITY</label>
        <input id="virtual-institution" value={query} onChange={event => { setQuery(event.target.value); setInstitution(null); setPreview(null); }} placeholder="Search institution" autoComplete="off" />
        {searching && <small className="tester-virtual-muted">Searching institutions…</small>}
        {!institution && institutions.length > 0 && <div className="tester-virtual-results">{institutions.slice(0, 8).map(item => <button type="button" key={item.id} onClick={() => { setInstitution(item); setQuery(item.name); setPreview(null); }}><strong>{item.name}</strong><small>{Array.isArray(item.branches) ? item.branches.length + " configured branches" : "Institution"}</small></button>)}</div>}
        {institution && <div className="tester-virtual-selected"><span><strong>{institution.name}</strong><small>Selected institution</small></span><button type="button" onClick={() => { setInstitution(null); setQuery(""); setPreview(null); }}>Change</button></div>}
        <label htmlFor="virtual-enrollment">ENROLLMENT NUMBER</label>
        <input id="virtual-enrollment" value={enrollment} onChange={event => { setEnrollment(event.target.value.toUpperCase()); setPreview(null); }} placeholder="Enter enrollment number" autoComplete="off" spellCheck={false} />
        {error && <p className="tester-virtual-error" role="alert">{error}</p>}
        <button className="tester-virtual-submit" type="submit" disabled={busy || !institution || !token}>{busy ? "IDENTIFYING PROFILE…" : "IDENTIFY STUDENT PROFILE"}</button>
      </form>
      {preview?.recognized && !preview.requiresConfirmation && <section className="tester-virtual-profile">
        <div className="tester-virtual-profile-head"><div><span className="tester-virtual-eyebrow">ACADEMIC IDENTIFICATION COMPLETE</span><h2>Student profile preview</h2></div><span className="tester-virtual-readonly">READ ONLY</span></div>
        <div className="tester-virtual-grid">
          <div><small>Enrollment number</small><strong>{enrollment.trim().toUpperCase()}</strong></div>
          <div><small>Programme</small><strong>{preview.programme || "—"}</strong></div>
          <div><small>Branch / discipline</small><strong>{preview.branch || "—"}{preview.specialization ? " · " + preview.specialization : ""}</strong></div>
          <div><small>Scheme / curriculum</small><strong>{preview.scheme || preview.curriculumName || "—"}</strong></div>
          <div><small>Admission mode</small><strong>{preview.admissionMode || "—"}</strong></div>
          <div><small>Admission year</small><strong>{preview.admissionYear || "—"}</strong></div>
        </div>
        <label className="tester-virtual-semester-label" htmlFor="virtual-semester">VIEW AS SEMESTER</label>
        <select id="virtual-semester" value={semester} onChange={event => setSemester(Number(event.target.value))}>{semesterOptions.map(value => <option key={value} value={value}>Semester {value}</option>)}</select>
        <p className="tester-virtual-note">The enrollment has been identified. Open the complete virtual student workspace with this temporary academic profile. All tester data remains isolated from student records.</p>
        <button className="tester-virtual-submit" type="button" onClick={openStudentWorkspace}>OPEN VIRTUAL STUDENT WORKSPACE →</button>
      </section>}
      <footer className="tester-virtual-footer">Temporary tester session · Full student-side feature set · No student authentication</footer>
    </section>
  </main>;
}
