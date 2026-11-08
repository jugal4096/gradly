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
  admissionYear?: number; admissionMode?: string; admissionModeId?: string | null; entrySemester?: number;
  expected?: { expectedSemester: number | null; academicYear: string; semesterType: "ODD" | "EVEN"; expectedDurationEnded: boolean; expectedGraduationSession: string; academicYearLabel: string | null };
};

export default function AcademicSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchTimer = useRef<number | undefined>(undefined);
  const searchSequence = useRef(0);
  const previewSequence = useRef(0);
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
  if (preview?.programId && preview.programme && !programs.some(p => p.id === preview.programId)) programs.push({ id: preview.programId, name: preview.programme });
  const branches = (selected?.branches || []).filter(b => b.program_id === programId);
  if (preview?.branchId && preview.branch && preview.programId === programId && !branches.some(b => b.id === preview.branchId)) {
    branches.push({ id: preview.branchId, name: preview.branch, program_id: preview.programId, program_name: preview.programme || "", code: null });
  }
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
    const sequence = ++previewSequence.current;
    setError(""); setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester("");
    if (!selected || !enrollment.trim() || !user) { setError("Select your institution and enter your enrollment number first."); return; }
    setPreviewBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/enrollment/preview", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ institutionId: selected.id, enrollmentNumber: enrollment.trim() }) });
      const payload = await response.json();
      if (sequence !== previewSequence.current) return;
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
      if (sequence !== previewSequence.current) return;
      if (!curriculumResponse.ok) throw new Error(curriculumPayload.message || "Unable to load the matched curriculum.");
      const options = Array.isArray(curriculumPayload.data) ? curriculumPayload.data as Curriculum[] : [];
      setCurricula(options);
      if (!options.some(item => item.id === result.curriculumId)) { setError("The detected curriculum is no longer available in the institution directory. Please verify with your institution."); setCurriculumId(""); }
    } catch (e) { if (sequence === previewSequence.current) { setPreview(null); setError(e instanceof Error ? e.message : "Unable to identify academic details."); } }
    finally { if (sequence === previewSequence.current) setPreviewBusy(false); }
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
          admissionModeId: preview.admissionModeId || null, admissionModeName: preview.admissionMode, graduationYear, targetCgpa: null,
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
    previewSequence.current += 1; setPreviewBusy(false); setSelected(item); setQuery(item.name); setInstitutions([]);
    setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPreview(null);
  }

  return <main className="academic-setup-page">
    <header className="academic-setup-top">
      <a href="/" className="academic-setup-brand"><span>G✦</span> Gradly</a>
      <div className="academic-setup-top-meta"><span className="academic-setup-live-dot" /> STUDENT ONBOARDING <i /> ACADEMIC INTELLIGENCE</div>
    </header>

    <div className="academic-setup-shell">
      <section className="academic-setup-hero">
        <div className="academic-setup-hero-copy">
          <span className="academic-setup-kicker"><span className="academic-setup-kicker-mark">✦</span> YOUR ACADEMIC IDENTITY</span>
          <h1>Your academic journey,<br/><em>understood.</em></h1>
          <p>Enter your enrollment number and let Gradly intelligently identify your academic profile, admission details and academic progression.</p>
          <div className="academic-setup-trust"><span><b>01</b> Institution</span><i /><span><b>02</b> Identification</span><i /><span><b>03</b> Verification</span></div>
        </div>
        <div className="academic-setup-hero-art" aria-hidden="true">
          <div className="academic-setup-orbit orbit-one" /><div className="academic-setup-orbit orbit-two" />
          <div className="academic-setup-art-core"><span>G✦</span><small>ACADEMIC<br/>INTELLIGENCE</small></div>
          <span className="academic-setup-art-chip chip-top">✧ PROFILE MATCH</span><span className="academic-setup-art-chip chip-bottom"><i /> ENROLLMENT SIGNAL DETECTED</span>
        </div>
      </section>

      <div className="academic-setup-columns">
        <section className="academic-setup-card academic-setup-intelligence">
          <div className="academic-setup-section-head">
            <div><span className="academic-setup-overline">01 / ENROLLMENT INTELLIGENCE</span><h2>Let's identify your academic path.</h2><p>Start with your institution and university enrollment number.</p></div>
            <span className="academic-setup-head-icon">✳</span>
          </div>

          {error && <div className="academic-setup-error" role="alert"><span>!</span><div><strong>We couldn't complete that step</strong><p>{error}</p></div></div>}

          <form onSubmit={saveProfile}>
            <label htmlFor="institution-search">Institution name</label>
            <div className="academic-setup-search-wrap">
              <span className="academic-setup-input-icon">⌕</span>
              <input id="institution-search" value={query} onChange={e => {
                const value = e.target.value;
                previewSequence.current += 1; setPreviewBusy(false); setQuery(value); setSelected(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPreview(null);
                window.clearTimeout(searchTimer.current);
                searchTimer.current = window.setTimeout(() => void searchInstitutions(value), 250);
              }} placeholder="Search your college or university…" autoComplete="organization"/>
              {searching && <span className="academic-setup-search-spinner" />}
            </div>
            {searching && <small className="academic-setup-hint">Searching Gradly's institution directory…</small>}
            {!searching && query.trim().length >= 2 && !selected && institutions.length === 0 && <small className="academic-setup-hint">No matching institution found. You can request it below.</small>}
            {institutions.length > 0 && !selected && <div className="academic-setup-results">{institutions.map(item => <button type="button" key={item.id} onClick={() => chooseInstitution(item)}><span className="academic-setup-result-icon">▦</span><span><strong>{item.name}</strong><small>{item.branches.length} programme / branch options</small></span><span className="academic-setup-result-arrow">↗</span></button>)}</div>}
            {selected && <div className="academic-setup-selected"><span className="academic-setup-selected-icon">✓</span><span><small>SELECTED INSTITUTION</small><strong>{selected.name}</strong></span><button type="button" onClick={() => { previewSequence.current += 1; setPreviewBusy(false); setSelected(null); setQuery(""); setInstitutions([]); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); }}>Change</button></div>}

            {selected && <div className="academic-setup-enrollment">
              <label htmlFor="student-enrollment">University enrollment / roll number</label>
              <input id="student-enrollment" required value={enrollment} onChange={e => { previewSequence.current += 1; setPreviewBusy(false); setEnrollment(e.target.value.toUpperCase()); setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); }} placeholder="e.g. BE23S06F007" autoComplete="off"/>
              <small className="academic-setup-field-note">Enter it exactly as printed on your university records.</small>
              <button type="button" className="academic-setup-submit" disabled={!enrollment.trim() || previewBusy} onClick={() => void fetchEnrollmentDetails()}>
                {previewBusy ? <><span className="academic-setup-button-spinner" /> Analysing enrollment…</> : <> <span>✧</span> Fetch matching academic options <b>→</b></>}
              </button>
              {previewBusy && <div className="academic-setup-analysis"><span className="academic-setup-analysis-pulse" /> Reading enrollment pattern <i /> Resolving academic records <i /> Predicting progression</div>}
            </div>}

            {preview?.recognized && !preview.requiresConfirmation && preview.expected && <>
              <section className="academic-setup-identified" aria-live="polite">
                <div className="academic-setup-identified-head">
                  <div className="academic-setup-ai-icon">✧</div>
                  <div><span className="academic-setup-identified-label">AUTO-DETECTED</span><h3>AI identified profile</h3></div>
                  <span className="academic-setup-match"><i /> MATCH SUCCESSFUL</span>
                </div>
                <div className="academic-setup-identified-grid">
                  <div><small>PROGRAMME</small><strong>{preview.programme || "—"}</strong></div>
                  <div><small>BRANCH / SPECIALIZATION</small><strong>{preview.branch || "—"}</strong></div>
                  <div><small>ADMISSION YEAR</small><strong>{preview.admissionYear || "—"}</strong></div>
                  <div><small>ADMISSION MODE</small><strong>{preview.admissionMode || "Not specified"}</strong></div>
                  <div><small>ACADEMIC SCHEME</small><strong>{preview.curriculumName || preview.scheme || "—"}</strong></div>
                  <div><small>ENTRY SEMESTER</small><strong>{preview.entrySemester ? `Semester ${preview.entrySemester}` : "—"}</strong></div>
                </div>
                <div className="academic-setup-identified-foot"><span>✦</span> Identified from your enrollment pattern and institution records. Review the details before saving.</div>
              </section>

              <section className="academic-setup-progression">
                <div className="academic-setup-subhead"><div><span className="academic-setup-overline">02 / ACADEMIC PROGRESSION</span><h3>Progression overview</h3></div><span className="academic-setup-prediction-tag">PREDICTED</span></div>
                <div className="academic-setup-progress-summary">
                  <div><small>CURRENT ACADEMIC SESSION</small><strong>{preview.expected.academicYear || "—"}</strong><span>{preview.expected.semesterType === "ODD" ? "Odd semester" : "Even semester"}</span></div>
                  <div><small>EXPECTED SEMESTER</small><strong>{predictionComplete ? "—" : preview.expected.expectedSemester ? `Semester ${preview.expected.expectedSemester}` : "Pending"}</strong><span>{preview.expected.academicYearLabel || "Estimated progression"}</span></div>
                  <div><small>EXPECTED GRADUATION</small><strong>{preview.expected.expectedGraduationSession || "—"}</strong><span>Estimated session</span></div>
                </div>
                <div className={`academic-setup-timeline ${predictionComplete ? "is-complete" : ""}`}>
                  <div className="academic-setup-timeline-track"><span /><span /><span /><span /></div>
                  <div className="academic-setup-timeline-step"><i>✓</i><small>ADMISSION</small><strong>{preview.admissionYear || "Recorded"}</strong></div>
                  <div className="academic-setup-timeline-step"><i>✦</i><small>PROGRESSION</small><strong>{predictionComplete ? "Duration reached" : preview.expected.expectedSemester ? `Semester ${preview.expected.expectedSemester}` : "In progress"}</strong></div>
                  <div className="academic-setup-timeline-step"><i>◎</i><small>EXPECTED COMPLETION</small><strong>{preview.expected.expectedGraduationSession || "To be determined"}</strong></div>
                </div>
                {predictionComplete && <div className="academic-setup-completion"><span className="academic-setup-completion-icon">✓</span><div><strong>Expected programme duration completed</strong><p>Your expected programme duration has reached completion. Please confirm your actual academic status. This prediction does not confirm that you have graduated.</p></div></div>}
              </section>

              <section className="academic-setup-confirmation">
                <div className="academic-setup-subhead"><div><span className="academic-setup-overline">03 / STUDENT VERIFICATION</span><h3>Review & confirm your details</h3></div><span className="academic-setup-student-tag">YOUR INPUT</span></div>
                <p className="academic-setup-confirmation-intro">Gradly has inferred your academic identity. Confirm the editable academic selections below before saving your profile.</p>
                <div className="academic-setup-source-legend"><span><i className="source-auto" /> Auto-detected by Gradly</span><span><i className="source-student" /> Confirmed by you</span></div>
                <div className="academic-setup-grid">
                  <div><label htmlFor="program-select">Programme <span className="academic-setup-source-pill auto">AUTO</span></label><select id="program-select" required value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Select programme</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                  <div><label htmlFor="branch-select">Branch / specialization <span className="academic-setup-source-pill auto">AUTO</span></label><select id="branch-select" required value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                  <div className="academic-setup-wide"><label htmlFor="curriculum-select">Curriculum / scheme <span className="academic-setup-source-pill auto">AUTO</span></label><select id="curriculum-select" required value={curriculumId} onChange={e => setCurriculumId(e.target.value)}><option value="">Select curriculum</option>{curricula.map(item => <option key={item.id} value={item.id}>{item.scheme_name}{item.version ? " · " + item.version : ""}</option>)}</select></div>
                  <div className="academic-setup-wide"><label htmlFor="academic-status">Academic status confirmation <span className="academic-setup-source-pill student">YOU CONFIRM</span></label><select id="academic-status" value={academicStatus} onChange={e => setAcademicStatus(e.target.value as AcademicStatus)}>
                    {predictionComplete ? <><option value="AWAITING_RESULTS">Awaiting results</option><option value="PENDING_BACKLOGS">Pending backlogs</option><option value="APPROVED_EXTENSION">Approved academic extension</option><option value="GRADUATED">Graduated</option></> : <><option value="ENROLLED">Currently enrolled</option><option value="PENDING_BACKLOGS">Pending backlogs</option><option value="APPROVED_EXTENSION">Approved academic extension</option><option value="AWAITING_RESULTS">Awaiting results</option></>}
                  </select></div>
                  {(!predictionComplete || academicStatus === "APPROVED_EXTENSION" || academicStatus === "PENDING_BACKLOGS") && <div className="academic-setup-wide"><label htmlFor="actual-semester">Actual enrolled semester <span className="academic-setup-source-pill student">YOU CONFIRM</span></label><select id="actual-semester" required value={actualSemester} onChange={e => setActualSemester(e.target.value)}><option value="">Select your actual semester</option>{availableSemesters.map(number => <option key={number} value={String(number)}>Semester {number}</option>)}</select><small className="academic-setup-hint">Self-reported by you; separate from Gradly's expected progression estimate.</small></div>}
                </div>
                <div className="academic-setup-confirm-note"><span>i</span><p>Expected progression is an estimate based on configured academic records. Backlog or extension status must be confirmed by you. Gradly does not infer graduation or unverified gap years.</p></div>
                <button className="academic-setup-submit academic-setup-save" disabled={saving || previewBusy || !curriculumId}>{saving ? <><span className="academic-setup-button-spinner" /> Saving academic profile…</> : <>Confirm & save academic profile <b>→</b></>}</button>
              </section>
            </>}
          </form>
        </section>

        <aside className="academic-setup-side">
          <div className="academic-setup-side-card">
            <span className="academic-setup-side-icon">✧</span><span className="academic-setup-overline">BUILT FOR STUDENTS</span>
            <h3>Your details.<br/>Less manual work.</h3>
            <p>Gradly reads the structure of your enrollment number and matches it against your institution's academic records.</p>
            <div className="academic-setup-side-points"><span><i>✓</i> Programme & branch matching</span><span><i>✓</i> Admission details recognition</span><span><i>✓</i> Academic progression estimate</span></div>
          </div>
          <div className="academic-setup-request">
            <div><span className="academic-setup-overline">INSTITUTION DIRECTORY</span><h3>Can't find your institute?</h3><p>Request your college or university. The Gradly team can review and add it to the directory.</p></div>
            {requestSent ? <div className="academic-setup-success">✓ Request submitted. The Super Admin team can now review your institution request.</div> :
              <form onSubmit={submitInstitutionRequest}>
                <label>College / university name<input required minLength={2} maxLength={160} value={requestName} onChange={e => setRequestName(e.target.value)} placeholder="Institution name"/></label>
                <label>City / district / locality<input required minLength={2} maxLength={160} value={requestCity} onChange={e => setRequestCity(e.target.value)} placeholder="e.g. Solapur, Maharashtra"/></label>
                <button type="submit" disabled={requestBusy}>{requestBusy ? "Submitting…" : "Send institution request →"}</button>
              </form>}
          </div>
          <div className="academic-setup-privacy"><span>▣</span><p>Your academic information is used to create your Gradly student profile and is handled through your authenticated account.</p></div>
        </aside>
      </div>
      <footer className="academic-setup-footer"><span>GRADLY <b>✦</b></span><span>ACADEMIC INTELLIGENCE, MADE CLEAR.</span></footer>
    </div>
  </main>;
}
