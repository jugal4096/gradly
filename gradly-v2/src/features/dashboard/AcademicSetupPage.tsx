import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./AcademicSetupPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Curriculum = { id: string; scheme_name: string; version?: string | number | null; total_semesters?: number | null };
type AdmissionMode = "Regular" | "Direct Second Year" | "Transfer" | "Other";
type EnrollmentInference = {
  programmePrefix: string;
  programmeLabel: string;
  admissionYear: number;
  admissionMode: AdmissionMode;
  entrySemester: number;
  branchCode: string;
  branchLabel: string;
  schemeLabel: string;
};

function inferEnrollment(value: string): EnrollmentInference | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "").slice(0, 7);
  const match = normalized.match(/^(BT|BE|MC|MT)(\d{2})([FS])(\d{2})$/);
  if (!match) return null;
  const [, programmePrefix, yearPart, modeCode, branchCode] = match;
  const branchLabels: Record<string, string> = {
    "01": "Civil Engineering", "02": "Mechanical Engineering", "03": "Electrical Engineering",
    "04": "Electronics and Telecommunication", "05": "Computer Science and Engineering",
    "06": "Branch code 06", "07": "Branch code 07",
  };
  const branchLabel = branchLabels[branchCode];
  if (!branchLabel) return null;
  const programmeLabels: Record<string, string> = {
    BT: "Bachelor of Technology", BE: "Bachelor of Engineering",
    MC: "Master of Computer Applications", MT: "Master of Technology",
  };
  const admissionMode: AdmissionMode = modeCode === "S" ? "Direct Second Year" : "Regular";
  // F/S is an engineering admission-mode marker. Postgraduate courses start in semester 1.
  const effectiveMode: AdmissionMode = programmePrefix === "BT" || programmePrefix === "BE" ? admissionMode : "Regular";
  return {
    programmePrefix, programmeLabel: programmeLabels[programmePrefix],
    admissionYear: 2000 + Number(yearPart), admissionMode: effectiveMode,
    entrySemester: effectiveMode === "Direct Second Year" ? 3 : 1,
    branchCode, branchLabel,
    schemeLabel: programmePrefix === "BT" ? "NEP" : programmePrefix === "BE" ? "New CBCS" : "",
  };
}

function inferenceEntrySemester(mode: AdmissionMode) { return mode === "Direct Second Year" ? 3 : 1; }

function getAcademicSession(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 7 ? "odd" : "even";
}

function getSemesterPlan(admissionYear: number, admissionMode: AdmissionMode, totalSemesters: number, date = new Date()) {
  const yearDifference = date.getFullYear() - admissionYear;
  const entrySemester = admissionMode === "Direct Second Year" ? 3 : 1;
  const sessionOffset = getAcademicSession(date) === "odd" ? 0 : 1;
  const rawSemester = entrySemester + yearDifference * 2 + sessionOffset;
  const expectedSemester = Math.max(entrySemester, Math.min(totalSemesters, rawSemester));
  const graduationYear = admissionYear + (admissionMode === "Direct Second Year" ? 3 : 4);
  const passedOut = date.getFullYear() > graduationYear ||
    (date.getFullYear() === graduationYear && rawSemester > totalSemesters);
  const eligibleSemesters = Array.from(
    { length: Math.max(0, expectedSemester - entrySemester + 1) },
    (_, index) => entrySemester + index,
  );
  return { expectedSemester, graduationYear, passedOut, eligibleSemesters, session: getAcademicSession(date) };
}

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
  const [semester, setSemester] = useState("");
  const [academicStatus, setAcademicStatus] = useState<"Enrolled" | "Passed out">("Enrolled");
  const [gapYears, setGapYears] = useState("0");
  const [enrollment, setEnrollment] = useState("");
  const [inferenceConfirmed, setInferenceConfirmed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingCurricula, setLoadingCurricula] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestCity, setRequestCity] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const inference = inferEnrollment(enrollment);
  const normalizedEnrollment = enrollment.trim().toUpperCase().replace(/[\s-]+/g, "");
  const enrollmentEntryComplete = normalizedEnrollment.length >= 7;
  const programs = Array.from(new Map((selected?.branches || []).map(b => [b.program_id, { id: b.program_id, name: b.program_name }])).values());
  const branches = (selected?.branches || []).filter(b => b.program_id === programId);
  const selectedProgramName = programs.find(p => p.id === programId)?.name || "";
  const isEngineering = /engineering|b\.?tech|bachelor of technology/i.test(selectedProgramName);
  const semesterCount = Number(curricula.find(c => c.id === curriculumId)?.total_semesters) ||
    (isEngineering ? 8 : 4);
  const inferredAdmissionYear = inference?.admissionYear ?? new Date().getFullYear();
  const inferredAdmissionMode = inference?.admissionMode ?? "Regular";
  const semesterPlan = getSemesterPlan(inferredAdmissionYear, inferredAdmissionMode, Math.max(1, semesterCount));
  const availableSemesters = Array.from({ length: Math.max(0, semesterCount - inferenceEntrySemester(inferredAdmissionMode) + 1) }, (_, index) => inferenceEntrySemester(inferredAdmissionMode) + index);
  const predictedSemester = semesterPlan.passedOut ? semesterCount : semesterPlan.expectedSemester;
  const selectedSemester = Number(semester || predictedSemester);
  const inferredGapYears = Math.max(0, Math.floor((predictedSemester - selectedSemester) / 2));
  const sessionLabel = semesterPlan.session === "odd" ? "July–December · Odd semester" : "January–June · Even semester";

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

  useEffect(() => {
    if (!inference) return;
    setInferenceConfirmed(true);
    setSemester("");
    setAcademicStatus("Enrolled");
    setGapYears("0");
    const matchingProgram = programs.find(p =>
      inference.programmePrefix === "BE"
        ? /bachelor of engineering|\bBE\b/i.test(p.name)
        : /bachelor of technology|\bB\.?Tech\b/i.test(p.name),
    );
    if (matchingProgram) {
      setProgramId(matchingProgram.id);
      const branchMatches = (selected?.branches || []).filter(b => b.program_id === matchingProgram.id);
      const branchMatch = branchMatches.find(b => {
        const code = String(b.code || "").toUpperCase().replace(/^0+/, "").padStart(2, "0");
        const name = b.name.toLowerCase();
        const byName = inference.branchCode === "01" ? /civil/.test(name)
          : inference.branchCode === "02" ? /mechanical/.test(name)
          : inference.branchCode === "03" ? /electrical/.test(name)
          : inference.branchCode === "04" ? /electronics|entc|telecommunication/.test(name)
          : inference.branchCode === "05" ? /computer science|\\bcse\\b/.test(name)
          : false;
        return code === inference.branchCode || byName;
      });
      setBranchId(branchMatch?.id || "");
      setCurricula([]);
      setCurriculumId("");
    }
  // Inference is intentionally applied only when the enrollment number changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment, selected]);

  useEffect(() => {
    if (!inference || !inferenceConfirmed || !curriculumId) return;
    const plan = getSemesterPlan(inference.admissionYear, inference.admissionMode, semesterCount);
    setSemester(String(plan.passedOut ? semesterCount : plan.expectedSemester));
    setAcademicStatus(plan.passedOut ? "Passed out" : "Enrolled");
    setGapYears("0");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferenceConfirmed, curriculumId, enrollment]);

  useEffect(() => {
    if (selected && programId && branchId && inference) void loadCurricula(programId, branchId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, programId, branchId, inference?.branchCode]);

  useEffect(() => {
    if (!curricula.length || curriculumId || !inference?.schemeLabel) return;
    const match = curricula.find(c => c.scheme_name.toLowerCase().includes(inference.schemeLabel.toLowerCase()));
    if (match) setCurriculumId(match.id);
  }, [curricula, curriculumId, inference?.schemeLabel]);

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

  async function loadCurricula(nextProgramId: string, nextBranchId: string) {
    if (!selected || !nextProgramId || !nextBranchId) return;
    setLoadingCurricula(true); setCurricula([]); setCurriculumId(""); setSemester("");
    try {
      const params = new URLSearchParams({ institutionId: selected.id, programId: nextProgramId, branchId: nextBranchId });
      const response = await fetch(API + "/api/academic/curricula?" + params.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load curriculum schemes.");
      setCurricula(Array.isArray(data.data) ? data.data : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load curriculum schemes."); }
    finally { setLoadingCurricula(false); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!user || !selected || !curriculumId || !enrollment.trim() || !inference || !semester) {
      setError("Enter a supported enrollment number and complete the remaining required fields."); return;
    }
    if (!availableSemesters.includes(Number(semester)) || (academicStatus === "Enrolled" && Number(semester) > predictedSemester)) {
      setError("That semester is not available in your current academic session or admission path."); return;
    }
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const existing = await fetch(API + "/api/student/profile", { headers: { Authorization: "Bearer " + token } });
      const existingData = await existing.json();
      const graduationYear = getSemesterPlan(inference.admissionYear, inference.admissionMode, semesterCount).graduationYear;
      const response = await fetch(API + "/api/student/profile", {
        method: existingData.profile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          institutionId: selected.id, curriculumId, studentIdentifier: enrollment.trim(),
          admissionYear: inference.admissionYear, currentSemesterNumber: Number(semester),
          admissionModeId: null, admissionModeName: inference.admissionMode, graduationYear, targetCgpa: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save your academic profile.");
      localStorage.setItem("gradly_student_profile", JSON.stringify({
        institutionId: selected.id, institutionName: selected.name, programId,
        programName: selectedProgramName,
        branchId, branchName: branches.find(b => b.id === branchId)?.name || "",
        curriculumId, semester, enrollment: enrollment.trim(), admissionYear: inference.admissionYear,
        admissionMode: inference.admissionMode, graduationYear, academicStatus, gapYears: Number(gapYears),
        scheme: curricula.find(c => c.id === curriculumId)?.scheme_name || "",
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
    setSelected(item); setQuery(item.name); setInstitutions([]);
    setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setSemester("");
  }

  return <main className="academic-setup-page">
    <header className="academic-setup-top"><a href="/" className="academic-setup-brand"><span>G✦</span> Gradly</a><span>STUDENT ACADEMIC SETUP</span></header>
    <section className="academic-setup-layout">
      <aside className="academic-setup-intro">
        <span className="academic-setup-kicker">YOUR ACADEMIC IDENTITY</span>
        <h1>Let's build your<br/><em>academic profile.</em></h1>
        <p>Start with your institution and enrollment number. Gradly will infer your admission path and eligible semester, and calculates your current semester automatically.</p>
        <div className="academic-setup-steps"><b>01 <span>Institution</span></b><b>02 <span>Enrollment intelligence</span></b><b>03 <span>Programme & curriculum</span></b></div>
        <small>You can update these details later from Academic Profile.</small>
      </aside>
      <section className="academic-setup-card">
        <div className="academic-setup-card-head"><span>ACADEMIC INTELLIGENCE · STUDENT SETUP</span><h2>Let's identify your academic path.</h2><p>Choose your institution and enter your enrollment number. Gradly detects your programme, scheme, admission year, branch and entry path, then predicts your semester.</p></div>
        {error && <div className="academic-setup-error" role="alert">{error}</div>}
        <form onSubmit={saveProfile}>
          <label>Institution name</label>
          <input value={query} onChange={e => {
            const value = e.target.value;
            setQuery(value); setSelected(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setSemester("");
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
              <input id="student-enrollment" required value={enrollment} onChange={e => { setEnrollment(e.target.value.toUpperCase()); setInferenceConfirmed(false); }} placeholder="e.g. BT24S05F004 or BE24F01…" autoComplete="off"/>
              {inference ? <div className="academic-setup-inference">
                <div className="academic-setup-inference-top"><span>GRADLY ENROLLMENT ANALYSIS</span><strong>{inference.programmeLabel}</strong></div>
                <div className="academic-setup-inference-grid">
                  <div><small>Admission year</small><b>{inference.admissionYear}</b></div>
                  <div><small>Admission path</small><b>{inference.admissionMode}</b></div>
                  <div><small>Entry semester</small><b>Semester {inference.entrySemester}</b></div>
                  <div><small>Branch detected</small><b>{inference.branchLabel}</b></div>
                  <div><small>Academic session</small><b>{sessionLabel}</b></div>
                </div>
                <p>Only the first seven characters are parsed. The remaining suffix is ignored. Confirm the detected programme, branch and scheme before saving.</p>
              </div> : enrollmentEntryComplete ? <div className="academic-setup-manual">
                <strong>Enrollment number not recognized.</strong>
                <p>Enter a valid seven-character enrollment prefix (programme, admission year, admission path and branch code). Any characters after the first seven are ignored.</p>
              </div> : null}
            </div>
            {inference && <div className="academic-setup-grid">
              <div><label>Programme</label><select required value={programId} onChange={e => { setProgramId(e.target.value); setBranchId(""); setCurricula([]); setCurriculumId(""); setSemester(""); }}><option value="">Select programme</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label>Branch / specialization</label><select required disabled={!programId} value={branchId} onChange={e => { setBranchId(e.target.value); void loadCurricula(programId, e.target.value); }}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div className="academic-setup-wide"><label>Curriculum / scheme</label><select required disabled={!branchId || loadingCurricula} value={curriculumId} onChange={e => { setCurriculumId(e.target.value); setSemester(""); }}><option value="">{loadingCurricula ? "Loading available schemes…" : "Select curriculum"}</option>{curricula.map(c => <option key={c.id} value={c.id}>{c.scheme_name}{c.version ? " · " + c.version : ""}</option>)}</select>{!loadingCurricula && branchId && !curricula.length && <small className="academic-setup-hint">No curriculum is configured for this branch yet. Use the institution request below or contact your institute administrator.</small>}</div>
              <div className="academic-setup-wide academic-setup-session"><span>{sessionLabel}</span><strong>Predicted current semester: {predictedSemester}</strong><small>{semesterPlan.passedOut ? "The enrollment timeline indicates the expected course duration has ended." : "Based on your enrollment year and the current academic session."}</small></div>
              <div className="academic-setup-wide"><label>Current semester (adjust if needed)</label><select required value={semester} onChange={e => { setSemester(e.target.value); setGapYears(String(Math.max(0, Math.floor((predictedSemester - Number(e.target.value)) / 2)))); }}><option value="">Select semester</option>{availableSemesters.filter(number => academicStatus === "Passed out" || number <= predictedSemester).map(number => <option key={number} value={String(number)}>Semester {number}{number === predictedSemester ? " · Predicted" : ""}</option>)}</select><small className="academic-setup-hint">{inferredAdmissionMode === "Direct Second Year" ? "Direct Second Year options start at Semester 3." : "Choose the semester you are currently studying in."}</small></div>
              <div><label>Academic status</label><select value={academicStatus} onChange={e => { setAcademicStatus(e.target.value as "Enrolled" | "Passed out"); if (e.target.value === "Passed out") setSemester(String(semesterCount)); else setSemester(String(predictedSemester)); }}><option value="Enrolled">Currently enrolled</option><option value="Passed out">Passed out</option></select></div>
              <div><label>Backlog / gap years</label><select value={gapYears} onChange={e => setGapYears(e.target.value)}><option value="0">No gap year</option>{[1,2,3,4].map(year => <option key={year} value={String(year)}>{year} {year === 1 ? "year" : "years"}</option>)}</select><small className="academic-setup-hint">Estimated from the difference between your predicted and selected semester. Adjust if you had a year gap or backlogs.</small></div>
            </div>}
            <button className="academic-setup-submit" disabled={saving || !inference || !semester}>{saving ? "Saving profile…" : "Save verified academic profile →"}</button>
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
