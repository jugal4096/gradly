import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./TesterAcademicSetupPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Preview = {
  recognized: boolean; requiresConfirmation?: boolean; message?: string;
  programme?: string; programId?: string; branch?: string; branchId?: string;
  specialization?: string | null; specializationId?: string | null;
  curriculumId?: string; curriculumName?: string; scheme?: string;
  admissionYear?: number; admissionMode?: string; admissionModeId?: string | null;
  entrySemester?: number; totalSemesters?: number;
  expected?: { expectedSemester: number | null; academicYear?: string; semesterType?: "ODD" | "EVEN"; academicYearLabel?: string | null };
};

export default function TesterAcademicSetupPage() {
  const { user, isTester, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [enrollment, setEnrollment] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [semester, setSemester] = useState(1);
  const [busy, setBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!isTester || !user) navigate("/", { replace: true });
  }, [loading, isTester, user, navigate]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setInstitutions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      try {
        const response = await fetch(API + "/api/academic/institutions/search?q=" + encodeURIComponent(normalized), { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Institution search failed.");
        setInstitutions(Array.isArray(body.data) ? body.data : []);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Institution search failed.");
      } finally { if (!controller.signal.aborted) setSearchBusy(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function resolve(event: FormEvent) {
    event.preventDefault();
    setError(""); setPreview(null);
    if (!institution) { setError("Select your institution first."); return; }
    if (!user || !isTester) { setError("Tester session is not active. Sign in again."); return; }
    const normalized = enrollment.trim().toUpperCase();
    if (!normalized) { setError("Enter an enrollment number."); return; }
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/tester/enrollment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ institutionId: institution.id, enrollmentNumber: normalized }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to identify this enrollment.");
      const data = body.data as Preview;
      setPreview(data);
      if (!data.recognized || data.requiresConfirmation) setError(data.message || "The enrollment could not be resolved against this institution's academic configuration.");
      else {
        const first = Number(data.entrySemester || 1);
        const last = Number(data.totalSemesters || 12);
        const predicted = Number(data.expected?.expectedSemester || first);
        setSemester(Math.max(first, Math.min(last, predicted)));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resolve the enrollment.");
    } finally { setBusy(false); }
  }

  function enterStudentWorkspace() {
    if (!preview?.recognized || !institution) return;
    const prefix = sessionStorage.getItem("gradly_tester_storage_prefix");
    if (!prefix) { setError("Tester sandbox could not be initialized. Please sign in again."); return; }
    const profile = {
      institutionId: institution.id,
      institutionName: institution.name,
      programId: preview.programId || "",
      programName: preview.programme || "",
      branchId: preview.branchId || "",
      branchName: preview.branch || "",
      specialization: preview.specialization || "",
      specializationId: preview.specializationId || "",
      curriculumId: preview.curriculumId || "",
      semester: String(semester),
      enrollment: enrollment.trim().toUpperCase(),
      admissionYear: String(preview.admissionYear || new Date().getFullYear()),
      admissionMode: preview.admissionMode || "Regular",
      admissionNumber: "",
      scheme: preview.scheme || preview.curriculumName || "",
    };
    sessionStorage.setItem(prefix + ":gradly_student_profile", JSON.stringify(profile));
    sessionStorage.setItem(prefix + ":gradly_tester_profile_ready", "true");
    navigate("/dashboard", { replace: true });
  }

  if (loading || !isTester) return <main className="tester-setup-loading">Preparing your isolated Gradly student workspace…</main>;

  return <main className="tester-setup-page">
    <header className="tester-setup-header"><a href="/"><span className="tester-setup-logo">G</span><span>Gradly <small>STUDENT SPACE</small></span></a><span className="tester-setup-mode">TESTER SESSION · ISOLATED</span></header>
    <section className="tester-setup-content">
      <span className="tester-setup-kicker">STUDENT ACADEMIC SETUP</span>
      <h1>Let's identify your academic profile.</h1>
      <p className="tester-setup-intro">Choose the institution first, then enter an enrollment number. Gradly will use its existing academic identification engine to determine the student profile. This is a temporary test profile; no student account is created.</p>
      <form className="tester-setup-card" onSubmit={resolve}>
        <label htmlFor="tester-institution">INSTITUTION / UNIVERSITY</label>
        <input id="tester-institution" value={query} onChange={event=>{setQuery(event.target.value);setInstitution(null);setPreview(null);}} placeholder="Search your institution" autoComplete="off"/>
        {searchBusy && <small>Searching institutions…</small>}
        {institutions.length > 0 && !institution && <div className="tester-setup-results">{institutions.slice(0,8).map(item=><button type="button" key={item.id} onClick={()=>{setInstitution(item);setQuery(item.name);setPreview(null);}}><strong>{item.name}</strong><small>{item.branches.length} configured branches</small></button>)}</div>}
        {institution && <div className="tester-setup-selected"><strong>{institution.name}</strong><button type="button" onClick={()=>{setInstitution(null);setQuery("");setPreview(null);}}>Change</button></div>}
        <label htmlFor="tester-enrollment">ENROLLMENT NUMBER</label>
        <input id="tester-enrollment" value={enrollment} onChange={event=>{setEnrollment(event.target.value.toUpperCase());setPreview(null);}} placeholder="Enter enrollment number" autoComplete="off" spellCheck={false}/>
        <button className="tester-setup-primary" type="submit" disabled={busy || !institution}>{busy ? "IDENTIFYING ACADEMIC PROFILE…" : "IDENTIFY ACADEMIC PROFILE"}</button>
        {error && <p className="tester-setup-error" role="alert">{error}</p>}
      </form>
      {preview?.recognized && !preview.requiresConfirmation && <section className="tester-setup-card tester-setup-confirm">
        <span className="tester-setup-kicker">PROFILE IDENTIFIED</span>
        <h2>Review your academic details</h2>
        <dl>
          <div><dt>Programme</dt><dd>{preview.programme || "—"}</dd></div>
          <div><dt>Branch / discipline</dt><dd>{preview.branch || "—"}{preview.specialization ? " · " + preview.specialization : ""}</dd></div>
          <div><dt>Scheme / curriculum</dt><dd>{preview.scheme || preview.curriculumName || "—"}</dd></div>
          <div><dt>Admission mode</dt><dd>{preview.admissionMode || "—"}</dd></div>
          <div><dt>Admission year</dt><dd>{preview.admissionYear || "—"}</dd></div>
          <div><dt>Predicted semester</dt><dd>{preview.expected?.expectedSemester ?? preview.entrySemester ?? "—"}</dd></div>
        </dl>
        <label htmlFor="tester-semester">TEST AS SEMESTER</label>
        <select id="tester-semester" value={semester} onChange={event=>setSemester(Number(event.target.value))}>
          {Array.from({length:Math.max(1,Number(preview.totalSemesters || 8))},(_,index)=>index+1).filter(value=>value>=Number(preview.entrySemester || 1)).map(value=><option key={value} value={value}>Semester {value}</option>)}
        </select>
        <button className="tester-setup-primary" type="button" onClick={enterStudentWorkspace}>CONTINUE TO STUDENT WORKSPACE →</button>
      </section>}
      <p className="tester-setup-footnote">Sandbox protection: temporary session storage only · no student registration · no academic record writes · no access to Admin or Super Admin functions.</p>
    </section>
  </main>;
}
