import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./AcademicSetupPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Curriculum = { id: string; scheme_name: string; version?: string | number | null; total_semesters?: number | null };
type AcademicStatus = "ENROLLED" | "AWAITING_RESULTS" | "PENDING_BACKLOGS" | "APPROVED_EXTENSION" | "GRADUATED";
type EnrollmentPreview = {
  recognized: boolean; requiresConfirmation: boolean; unknown?: string; message?: string;
  programme?: string; programId?: string; branch?: string; branchId?: string;
  curriculumId?: string; curriculumName?: string; scheme?: string;
  admissionYear?: number; admissionMode?: string; entrySemester?: number;
  expected?: { expectedSemester: number | null; academicYear: string; semesterType: "ODD" | "EVEN"; expectedDurationEnded: boolean; expectedGraduationSession: string; academicYearLabel: string | null };
};

export default function AcademicSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchTimer = useRef<number | undefined>(undefined);
  const searchSequence = useRef(0);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState<Institution | null>(null);
  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [curriculumId, setCurriculumId] = useState("");
  const [academicStatus, setAcademicStatus] = useState<AcademicStatus>("ENROLLED");
  const [actualSemester, setActualSemester] = useState("");
  const [preview, setPreview] = useState<EnrollmentPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [enrollment, setEnrollment] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestCity, setRequestCity] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const programs = Array.from(new Map((selected?.branches || []).map(b => [b.program_id, { id: b.program_id, name: b.program_name }])).values());
  const branches = (selected?.branches || []).filter(b => b.program_id === programId);
  const selectedProgramName = programs.find(p => p.id === programId)?.name || "";
  const selectedCurriculum = curricula.find(item => item.id === curriculumId);
  const semesterCount = Number(selectedCurriculum?.total_semesters) || 0;
  const predictionComplete = Boolean(preview?.expected?.expectedDurationEnded);
  const availableSemesters = Array.from({ length: semesterCount }, (_, index) => index + 1);
  const academicSessionLabel = preview?.expected
    ? `${preview.expected.academicYear} · ${preview.expected.semesterType === "ODD" ? "Odd" : "Even"} semester`
    : "";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(API + "/api/student/profile", { headers: { Authorization: "Bearer " + token } });
        const data = await response.json();
        if (response.ok && data.profile && !cancelled) {
          const p = data.profile;
          localStorage.setItem("gradly_student_profile", JSON.stringify({
            institutionId: p.institution_id || "", institutionName: p.institution_name || "",
            programId: p.program_id || "", programName: p.program_name || "",
            branchId: p.branch_id || "", branchName: p.branch_name || "",
            curriculumId: p.curriculum_id || "", semester: String(p.current_semester_number || ""),
            enrollment: p.student_identifier || "", admissionYear: String(p.admission_year || ""),
            admissionMode: p.admission_mode_name || "Regular", admissionNumber: "", scheme: p.scheme_name || "",
          }));
          navigate("/dashboard", { replace: true });
        }
      } catch { /* A missing profile is expected during first-time setup. */ }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);


  async function fetchEnrollmentDetails() {
    setError(""); setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester("");
    if (!selected || !enrollment.trim() || !user) { setError("Select your institution and enter your enrollment number first."); return; }
    setPreviewBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/enrollment/preview", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ institutionId: selected.id, enrollmentNumber: enrollment.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to identify academic details.");
      const result = payload.data as EnrollmentPreview;
      setPreview(result);
      if (!result.recognized || result.requiresConfirmation) { setError(result.message || "Some academic details could not be resolved. Please contact your institution administrator."); return; }
      if (!result.programId || !result.branchId || !result.curriculumId || !result.expected) { setError("Programme, branch, curriculum or academic calendar is unresolved. No semester prediction was generated."); return; }
      setProgramId(result.programId); setBranchId(result.branchId); setCurriculumId(result.curriculumId);
      setAcademicStatus(result.expected.expectedDurationEnded ? "AWAITING_RESULTS" : "ENROLLED");
      const params = new URLSearchParams({ institutionId: selected.id, programId: result.programId, branchId: result.branchId });
      const curriculumResponse = await fetch(API + "/api/academic/curricula?" + params.toString());
      const curriculumPayload = await curriculumResponse.json();
      if (!curriculumResponse.ok) throw new Error(curriculumPayload.message || "Unable to load the matched curriculum.");
      const options = Array.isArray(curriculumPayload.data) ? curriculumPayload.data as Curriculum[] : [];
      setCurricula(options);
      if (!options.some(item => item.id === result.curriculumId)) { setError("The detected curriculum is no longer available in the institution directory. Please verify with your institution."); setCurriculumId(""); }
    } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : "Unable to identify academic details."); }
    finally { setPreviewBusy(false); }
  }

  async function searchInstitutions(value: string) {
    const sequence = ++searchSequence.current;
    if (value.trim().length < 2) { setInstitutions([]); setSearching(false); return; }
    setSearching(true);
    try {
      const response = await fetch(API + "/api/academic/institutions/search?q=" + encodeURIComponent(value.trim()));
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Institution search failed.");
      if (sequence === searchSequence.current) setInstitutions(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      if (sequence === searchSequence.current) setError(e instanceof Error ? e.message : "Institution search failed.");
    } finally {
      if (sequence === searchSequence.current) setSearching(false);
    }
  }


  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!user || !selected || !preview?.recognized || preview.requiresConfirmation || !curriculumId || !preview.programId || !preview.branchId) {
      setError("Fetch and verify a complete academic profile before saving."); return;
    }
    const completed = Boolean(preview.expected?.expectedDurationEnded);
    const needsActualSemester = !completed || academicStatus === "APPROVED_EXTENSION" || academicStatus === "PENDING_BACKLOGS";
    if (needsActualSemester && (!actualSemester || !availableSemesters.includes(Number(actualSemester)))) {
      setError("Select your actual currently enrolled semester. This is separate from the expected progression."); return;
    }
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const existing = await fetch(API + "/api/student/profile", { headers: { Authorization: "Bearer " + token } });
      const existingData = await existing.json();
      const graduationYear = Number(preview.expected?.expectedGraduationSession?.slice(0, 4)) || null;
      const response = await fetch(API + "/api/student/profile", {
        method: existingData.profile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          institutionId: selected.id, curriculumId, studentIdentifier: enrollment.trim(),
          admissionYear: preview.admissionYear, currentSemesterNumber: completed && academicStatus !== "APPROVED_EXTENSION" && academicStatus !== "PENDING_BACKLOGS" ? null : Number(actualSemester),
          admissionModeId: null, admissionModeName: preview.admissionMode, graduationYear, targetCgpa: null,
          academicStatus,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save your academic profile.");
      localStorage.setItem("gradly_student_profile", JSON.stringify({
        institutionId: selected.id, institutionName: selected.name, programId: preview.programId,
        programName: preview.programme, branchId: preview.branchId, branchName: preview.branch,
        curriculumId, semester: actualSemester || "", enrollment: enrollment.trim(), admissionYear: preview.admissionYear,
        admissionMode: preview.admissionMode, graduationYear, academicStatus,
        expectedSemester: preview.expected?.expectedSemester ?? null,
        expectedDurationEnded: completed, verifiedGapYears: null, scheme: preview.curriculumName || preview.scheme || "",
      }));
      navigate("/dashboard", { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save your profile."); }
    finally { setSaving(false); }
  }

  async function submitInstitutionRequest(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!user) { setError("Sign in before requesting an institution."); return; }
    setRequestBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/institution-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ collegeName: requestName.trim(), locality: requestCity.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Your request could not be submitted.");
      setRequestSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Your request could not be submitted."); }
    finally { setRequestBusy(false); }
  }

  function chooseInstitution(item: Institution) {
    setSelected(item); setQuery(item.name); setInstitutions([]); setInferenceConfirmed(false); setFetchAttempted(false);
    setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPreview(null);
  }

  return <main className="academic-setup-page">
    <header className="academic-setup-top"><a href="/" className="academic-setup-brand"><span>G✦</span> Gradly</a><span>STUDENT ACADEMIC SETUP</span></header>
    <section className="academic-setup-layout">
      <aside className="academic-setup-intro">
        <span className="academic-setup-kicker">YOUR ACADEMIC IDENTITY</span>
        <h1>Let's build your<br/><em>academic profile.</em></h1>
        <p>Choose your institution and enter your enrollment number. Fetch your academic details, then review the matching programme and curriculum.</p>
        <div className="academic-setup-steps"><b>01 <span>Institution</span></b><b>02 <span>Enrollment intelligence</span></b><b>03 <span>Programme & curriculum</span></b></div>
        <small>You can update these details later from Academic Profile.</small>
      </aside>
      <section className="academic-setup-card">
        <div className="academic-setup-card-head"><span>ACADEMIC INTELLIGENCE · STUDENT SETUP</span><h2>Let's identify your academic path.</h2><p>Choose your institution, enter your enrollment number and fetch the matching programme, branch and curriculum options from Gradly's academic records.</p></div>
        {error && <div className="academic-setup-error" role="alert">{error}</div>}
        <form onSubmit={saveProfile}>
          <label>Institution name</label>
          <input value={query} onChange={e => {
            const value = e.target.value;
            setQuery(value); setSelected(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPreview(null);
            window.clearTimeout(searchTimer.current);
            searchTimer.current = window.setTimeout(() => void searchInstitutions(value), 250);
          }} placeholder="Search institutions in Gradly's database…" autoComplete="organization"/>
          {searching && <small className="academic-setup-hint">Searching Gradly's institution directory…</small>}
          {!searching && query.trim().length >= 2 && !selected && institutions.length === 0 && <small className="academic-setup-hint">No matching institution found. You can request it below.</small>}
          {institutions.length > 0 && !selected && <div className="academic-setup-results">{institutions.map(item => <button type="button" key={item.id} onClick={() => chooseInstitution(item)}><strong>{item.name}</strong><span>{item.branches.length} programme / branch options</span></button>)}</div>}
          {selected && <div className="academic-setup-selected"><span>SELECTED INSTITUTION</span><strong>{selected.name}</strong><button type="button" onClick={() => { setSelected(null); setQuery(""); setInstitutions([]); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); }}>Change</button></div>}
          {selected && <>
            <div className="academic-setup-enrollment">
              <label htmlFor="student-enrollment">University enrollment / roll number</label>
              <input id="student-enrollment" required value={enrollment} onChange={e => { setEnrollment(e.target.value.toUpperCase()); setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); }} placeholder="Enter your university enrollment number" autoComplete="off"/>
              <button type="button" className="academic-setup-submit" disabled={!enrollment.trim() || previewBusy} onClick={() => void fetchEnrollmentDetails()}>{previewBusy ? "Identifying academic details…" : "Fetch matching academic options →"}</button>
            </div>
            {preview?.recognized && !preview.requiresConfirmation && preview.expected && <div className="academic-setup-grid">
              <div><label>Programme</label><select required value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Select programme</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label>Branch / specialization</label><select required value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div className="academic-setup-wide"><label>Curriculum / scheme</label><select required value={curriculumId} onChange={e => setCurriculumId(e.target.value)}><option value="">Select curriculum</option>{curricula.map(item => <option key={item.id} value={item.id}>{item.scheme_name}{item.version ? " · " + item.version : ""}</option>)}</select></div>
              <div className="academic-setup-wide academic-setup-session"><span>{academicSessionLabel}</span>
                {predictionComplete ? <><strong>Expected programme duration completed</strong><small>Expected graduation session: {preview.expected.expectedGraduationSession}. This does not confirm that you graduated.</small></> :
                <><strong>Expected semester: {preview.expected.expectedSemester}</strong><small>{preview.expected.academicYearLabel || ""} · Estimated from the configured admission session and institutional calendar.</small></>}
              </div>
              <div className="academic-setup-wide"><label>Academic status confirmation</label>
                <select value={academicStatus} onChange={e => setAcademicStatus(e.target.value as AcademicStatus)}>
                  {predictionComplete ? <>
                    <option value="AWAITING_RESULTS">Awaiting results</option><option value="PENDING_BACKLOGS">Pending backlogs</option><option value="APPROVED_EXTENSION">Approved academic extension</option><option value="GRADUATED">Graduated</option>
                  </> : <><option value="ENROLLED">Currently enrolled</option><option value="PENDING_BACKLOGS">Pending backlogs</option><option value="APPROVED_EXTENSION">Approved academic extension</option><option value="AWAITING_RESULTS">Awaiting results</option></>}
                </select>
              </div>
              {(!predictionComplete || academicStatus === "APPROVED_EXTENSION" || academicStatus === "PENDING_BACKLOGS") && <div className="academic-setup-wide"><label>Actual enrolled semester</label><select required value={actualSemester} onChange={e => setActualSemester(e.target.value)}><option value="">Select your actual semester</option>{availableSemesters.map(number => <option key={number} value={String(number)}>Semester {number}</option>)}</select><small className="academic-setup-hint">This is your self-reported actual semester, not an automatically verified result.</small></div>}
            </div>}
            {preview?.recognized && !preview.requiresConfirmation && <button className="academic-setup-submit" disabled={saving || previewBusy || !curriculumId}>{saving ? "Saving profile…" : "Confirm and save academic profile →"}</button>}
          </>}
        </form>
        <div className="academic-setup-request">
          <div><span>CAN'T FIND YOUR INSTITUTE?</span><h3>Request it from Gradly</h3><p>Type the institution name and city manually. Your request will be sent to the Super Admin team for review.</p></div>
          {requestSent ? <div className="academic-setup-success">✓ Request submitted. The Super Admin team can now review your institution request.</div> :
            <form onSubmit={submitInstitutionRequest}>
              <label>College / university name<input required minLength={2} maxLength={160} value={requestName} onChange={e => setRequestName(e.target.value)} placeholder="Type institution name"/></label>
              <label>City / district / locality<input required minLength={2} maxLength={160} value={requestCity} onChange={e => setRequestCity(e.target.value)} placeholder="e.g. Solapur, Maharashtra"/></label>
              <button type="submit" disabled={requestBusy}>{requestBusy ? "Submitting…" : "Send institution request →"}</button>
            </form>}
        </div>
      </section>
    </section>
  </main>;
}
