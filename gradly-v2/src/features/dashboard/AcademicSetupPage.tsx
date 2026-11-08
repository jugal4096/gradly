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
  const [predictionConfirmed, setPredictionConfirmed] = useState<boolean | null>(null);
  const [editingPrediction, setEditingPrediction] = useState(false);
  const [hasBacklogs, setHasBacklogs] = useState<boolean | null>(null);
  const [backlogCount, setBacklogCount] = useState("");
  const [confirmedAdmissionYear, setConfirmedAdmissionYear] = useState("");
  const [confirmedAdmissionMode, setConfirmedAdmissionMode] = useState("");
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
      setPredictionConfirmed(null); setEditingPrediction(false); setHasBacklogs(null); setBacklogCount("");
      setConfirmedAdmissionYear(String(result.admissionYear || "")); setConfirmedAdmissionMode(result.admissionMode || "");
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
    if (!user || !selected || !preview?.recognized || preview.requiresConfirmation || !curriculumId || !programId || !branchId) {
      setError("Fetch and verify a complete academic profile before saving."); return;
    }
    if (predictionConfirmed !== true) { setError("Please confirm the predicted academic details before continuing."); return; }
    if (hasBacklogs === null) { setError("Please confirm whether you have any pending backlogs."); return; }
    const parsedBacklogCount = hasBacklogs ? Number(backlogCount) : 0;
    if (!Number.isInteger(parsedBacklogCount) || parsedBacklogCount < 0 || parsedBacklogCount > 100 || (hasBacklogs && parsedBacklogCount < 1)) {
      setError("Enter a valid pending backlog count between 0 and 100."); return;
    }
    if (!confirmedAdmissionYear || !Number.isInteger(Number(confirmedAdmissionYear)) || Number(confirmedAdmissionYear) < 1900 || Number(confirmedAdmissionYear) > new Date().getFullYear()) {
      setError("Enter a valid admission year."); return;
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
          admissionYear: Number(confirmedAdmissionYear), currentSemesterNumber: completed && academicStatus !== "APPROVED_EXTENSION" && academicStatus !== "PENDING_BACKLOGS" ? null : Number(actualSemester),
          admissionModeId: confirmedAdmissionMode === preview.admissionMode ? preview.admissionModeId || null : null, admissionModeName: confirmedAdmissionMode, graduationYear, targetCgpa: null,
          academicStatus, academicProfileConfirmed: true, pendingBacklogCount: parsedBacklogCount,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save your academic profile.");
      localStorage.setItem("gradly_student_profile", JSON.stringify({
        institutionId: selected.id, institutionName: selected.name, programId,
        programName: programs.find(item => item.id === programId)?.name || preview.programme, branchId, branchName: branches.find(item => item.id === branchId)?.name || preview.branch,
        curriculumId, semester: actualSemester || "", enrollment: enrollment.trim(), admissionYear: Number(confirmedAdmissionYear),
        admissionMode: confirmedAdmissionMode, graduationYear, academicStatus,
        academicProfileConfirmed: true, pendingBacklogCount: parsedBacklogCount, hasPendingBacklogs: parsedBacklogCount > 0,
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
    <div className="academic-setup-wrap">
      <header className="academic-setup-header">
        <a href="/" className="academic-setup-brand" aria-label="Gradly home"><span className="academic-setup-logo">G</span><span>gradly</span></a>
        <span className="academic-setup-step">STEP 02 <i /> OF 03</span>
      </header>
      <div className="academic-setup-progress" aria-label="Step 2 of 3"><span /></div>

      <section className="academic-setup-content">
        <div className="academic-setup-heading">
          <p className="academic-setup-eyebrow">ACADEMIC PROFILE</p>
          <h1>Let's get you set up.</h1>
          <p>Tell us a little about your academic journey. We'll take care of the rest.</p>
        </div>

        {error && <div className="academic-setup-error" role="alert"><span>!</span>{error}</div>}

        <form className="academic-setup-form" onSubmit={saveProfile}>
          <section className="academic-setup-field-section">
            <label htmlFor="institution-search">Your institution</label>
            <div className="academic-setup-input-wrap">
              <input id="institution-search" value={query} onChange={e => {
                const value = e.target.value;
                previewSequence.current += 1; setPreviewBusy(false); setQuery(value); setSelected(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPreview(null); setPredictionConfirmed(null); setEditingPrediction(false); setHasBacklogs(null); setBacklogCount("");
                window.clearTimeout(searchTimer.current);
                searchTimer.current = window.setTimeout(() => void searchInstitutions(value), 250);
              }} placeholder="Search your college or university" autoComplete="organization" />
              {searching && <span className="academic-setup-search-spinner" />}
            </div>
            {searching && <small className="academic-setup-helper">Searching institutions…</small>}
            {!searching && query.trim().length >= 2 && !selected && institutions.length === 0 && <small className="academic-setup-helper">No match found. You can request your institution below.</small>}
            {institutions.length > 0 && !selected && <div className="academic-setup-results">{institutions.map(item => <button type="button" key={item.id} onClick={() => chooseInstitution(item)}><span>{item.name}</span><small>{item.branches.length} academic options</small></button>)}</div>}
            {selected && <div className="academic-setup-selected"><span className="academic-setup-selected-check">✓</span><span>{selected.name}</span><button type="button" onClick={() => { previewSequence.current += 1; setPreviewBusy(false); setSelected(null); setQuery(""); setInstitutions([]); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPreview(null); }}>Change</button></div>}
          </section>

          {selected && <section className="academic-setup-field-section enrollment-section">
            <label htmlFor="student-enrollment">Your enrollment number</label>
            <div className="academic-setup-enrollment-control">
              <input id="student-enrollment" required value={enrollment} onChange={e => { previewSequence.current += 1; setPreviewBusy(false); setEnrollment(e.target.value.toUpperCase()); setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setActualSemester(""); setPredictionConfirmed(null); setEditingPrediction(false); setHasBacklogs(null); setBacklogCount(""); }} placeholder="e.g. BE23S06F007" autoComplete="off" />
              <button type="button" disabled={!enrollment.trim() || previewBusy} onClick={() => void fetchEnrollmentDetails()}>
                {previewBusy ? <><span className="academic-setup-button-spinner" /> Checking</> : <>Identify <span>→</span></>}
              </button>
            </div>
            <small className="academic-setup-helper">Enter it exactly as printed on your university records.</small>
            {previewBusy && <div className="academic-setup-loading"><span className="academic-setup-button-spinner" /> Identifying your academic details…</div>}
          </section>}

          {preview?.recognized && !preview.requiresConfirmation && preview.expected && <>
            <section className="academic-setup-predicted" aria-live="polite">
              <div className="academic-setup-predicted-heading">
                <span className="academic-setup-predicted-sparkle">✦</span>
                <div><h2>Predicted Academic Details</h2><p>Review the information Gradly identified from your enrollment.</p></div>
                <span className="academic-setup-auto-tag"><i /> AUTO-DETECTED</span>
              </div>
              <dl className="academic-setup-predicted-grid">
                <div><dt>Programme</dt><dd>{programs.find(item => item.id === programId)?.name || preview.programme || "—"}</dd></div>
                <div><dt>Branch</dt><dd>{branches.find(item => item.id === branchId)?.name || preview.branch || "—"}</dd></div>
                <div><dt>Admission year</dt><dd>{confirmedAdmissionYear || "—"}</dd></div>
                <div><dt>Admission mode</dt><dd>{confirmedAdmissionMode || "Not specified"}</dd></div>
                <div><dt>Entry semester</dt><dd>{preview.entrySemester ? `Semester ${preview.entrySemester}` : "—"}</dd></div>
                <div><dt>Academic scheme</dt><dd>{curricula.find(item => item.id === curriculumId)?.scheme_name || preview.curriculumName || preview.scheme || "—"}</dd></div>
                <div className="academic-setup-predicted-wide"><dt>Academic progression</dt><dd>{predictionComplete ? "Expected programme duration completed" : preview.expected.expectedSemester ? `Predicted current semester: Semester ${preview.expected.expectedSemester}` : "Semester prediction unavailable"}</dd></div>
              </dl>
              {predictionComplete && <p className="academic-setup-predicted-note">Please confirm your current academic status below. Expected duration does not mean that you have graduated.</p>}
              {predictionConfirmed === true && !editingPrediction ? <div className="academic-setup-confirmed-state"><span>✓</span><div><strong>Academic details confirmed</strong><small>You've confirmed these details for your Gradly profile.</small></div><button type="button" onClick={() => { setPredictionConfirmed(null); setEditingPrediction(true); }}>Edit</button></div> : <>
                <div className="academic-setup-data-question">Is this data correct?</div>
                {!editingPrediction ? <div className="academic-setup-choice-row">
                  <button type="button" className="academic-setup-choice primary-choice" onClick={() => { setPredictionConfirmed(true); setEditingPrediction(false); setError(""); }}>✓ Yes, everything is correct</button>
                  <button type="button" className="academic-setup-choice" onClick={() => { setEditingPrediction(true); setPredictionConfirmed(null); setError(""); }}>No, I want to edit it</button>
                </div> : <div className="academic-setup-edit-fields">
                  <div><label htmlFor="edit-programme">Programme</label><select id="edit-programme" value={programId} onChange={e => { setProgramId(e.target.value); setBranchId(""); setCurricula([]); setCurriculumId(""); }}><option value="">Select programme</option>{programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  <div><label htmlFor="edit-branch">Branch</label><select id="edit-branch" value={branchId} onChange={async e => {
                    const nextBranchId=e.target.value; setBranchId(nextBranchId); setCurricula([]); setCurriculumId("");
                    const nextBranch=selected?.branches.find(item=>item.id===nextBranchId);
                    if(!selected || !nextBranch || !user) return;
                    try { const token=await user.getIdToken(); const params=new URLSearchParams({institutionId:selected.id,programId:nextBranch.program_id,branchId:nextBranchId}); const response=await fetch(API+"/api/academic/curricula?"+params.toString()); const payload=await response.json(); if(!response.ok) throw new Error(payload.message||"Unable to load the selected branch curriculum."); const options=Array.isArray(payload.data)?payload.data as Curriculum[]:[]; setCurricula(options); if(options.length===1) setCurriculumId(options[0].id); } catch(e) { setError(e instanceof Error?e.message:"Unable to load curriculum options."); }
                  }}><option value="">Select branch</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  <div className="academic-setup-edit-wide"><label htmlFor="edit-scheme">Academic scheme</label><select id="edit-scheme" value={curriculumId} onChange={e => setCurriculumId(e.target.value)}><option value="">Select scheme</option>{curricula.map(item => <option key={item.id} value={item.id}>{item.scheme_name}{item.version ? " · "+item.version : ""}</option>)}</select></div>
                  <div><label htmlFor="edit-admission-year">Admission year</label><input id="edit-admission-year" type="number" min="1900" max={new Date().getFullYear()} value={confirmedAdmissionYear} onChange={e => setConfirmedAdmissionYear(e.target.value)} /></div>
                  <div><label htmlFor="edit-admission-mode">Admission mode</label><input id="edit-admission-mode" value={confirmedAdmissionMode} onChange={e => setConfirmedAdmissionMode(e.target.value)} placeholder="e.g. Regular, Lateral Entry" /></div>
                  <div className="academic-setup-edit-actions"><button type="button" className="academic-setup-choice" onClick={() => { setEditingPrediction(false); setPredictionConfirmed(null); }}>Cancel</button><button type="button" className="academic-setup-choice primary-choice" disabled={!programId || !branchId || !curriculumId || !confirmedAdmissionYear || !confirmedAdmissionMode.trim()} onClick={() => { setPredictionConfirmed(true); setEditingPrediction(false); setError(""); }}>Confirm updated details</button></div>
                </div>}
              </>}
            </section>

            <section className="academic-setup-backlogs">
              <div><h2>Do you have any pending backlogs?</h2><p>This information is provided by you, not inferred by Gradly.</p></div>
              <div className="academic-setup-backlog-options">
                <button type="button" className={hasBacklogs === false ? "selected" : ""} aria-pressed={hasBacklogs === false} onClick={() => { setHasBacklogs(false); setBacklogCount("0"); if (academicStatus === "PENDING_BACKLOGS") setAcademicStatus("ENROLLED"); }}><span>{hasBacklogs === false ? "●" : "○"}</span>No backlogs</button>
                <button type="button" className={hasBacklogs === true ? "selected" : ""} aria-pressed={hasBacklogs === true} onClick={() => { setHasBacklogs(true); setBacklogCount(value => value && Number(value)>0 ? value : "1"); if (academicStatus === "ENROLLED") setAcademicStatus("PENDING_BACKLOGS"); }}><span>{hasBacklogs === true ? "●" : "○"}</span>Yes, I have backlogs</button>
              </div>
              {hasBacklogs === true && <div className="academic-setup-backlog-count"><label htmlFor="backlog-count">How many pending backlogs do you have?</label><input id="backlog-count" type="number" min="1" max="100" step="1" required value={backlogCount} onChange={e => setBacklogCount(e.target.value)} placeholder="Enter number of backlogs" /></div>}
            </section>

            <section className="academic-setup-confirmation">
              <div className="academic-setup-confirm-fields">
                <div><label htmlFor="academic-status">Academic status</label><select id="academic-status" value={academicStatus} onChange={e => setAcademicStatus(e.target.value as AcademicStatus)}>
                  {predictionComplete ? <><option value="AWAITING_RESULTS">Awaiting results</option><option value="PENDING_BACKLOGS">Pending backlogs</option><option value="APPROVED_EXTENSION">Approved academic extension</option><option value="GRADUATED">Graduated</option></> : <><option value="ENROLLED">Currently enrolled</option><option value="PENDING_BACKLOGS">Pending backlogs</option><option value="APPROVED_EXTENSION">Approved academic extension</option><option value="AWAITING_RESULTS">Awaiting results</option></>}
                </select></div>
                {(!predictionComplete || academicStatus === "APPROVED_EXTENSION" || academicStatus === "PENDING_BACKLOGS") && <div><label htmlFor="actual-semester">Actual enrolled semester</label><select id="actual-semester" required value={actualSemester} onChange={e => setActualSemester(e.target.value)}><option value="">Choose semester</option>{availableSemesters.map(number => <option key={number} value={String(number)}>Semester {number}</option>)}</select></div>}
              </div>
            </section>

            <button className="academic-setup-continue" type="submit" disabled={saving || previewBusy || predictionConfirmed !== true || hasBacklogs === null || (hasBacklogs && !backlogCount.trim()) || !curriculumId}>
              {saving ? <><span className="academic-setup-button-spinner" /> Saving your profile…</> : <>Continue <span>→</span></>}
            </button>
            <p className="academic-setup-footnote">Your information is saved to your authenticated Gradly student profile.</p>
          </>}}
        </form>

        {!selected && <p className="academic-setup-first-step-note">Start by selecting your college or university. Your enrollment number comes next.</p>}

        <details className="academic-setup-institution-request">
          <summary>Can't find your institution?</summary>
          {requestSent ? <p className="academic-setup-request-success">✓ Request submitted. Our team can review your institution.</p> : <form onSubmit={submitInstitutionRequest}>
            <label>College or university name<input required minLength={2} maxLength={160} value={requestName} onChange={e => setRequestName(e.target.value)} placeholder="Institution name" /></label>
            <label>City or district<input required minLength={2} maxLength={160} value={requestCity} onChange={e => setRequestCity(e.target.value)} placeholder="e.g. Solapur, Maharashtra" /></label>
            <button type="submit" disabled={requestBusy}>{requestBusy ? "Submitting…" : "Send request"}</button>
          </form>}
        </details>
      </section>
      <footer className="academic-setup-footer"><span>© Gradly</span><span>ACADEMIC SETUP</span></footer>
    </div>
  </main>;
}
