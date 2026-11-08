import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./AcademicSetupPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
type Branch = { id: string; name: string; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Curriculum = { id: string; scheme_name: string; version?: string | number | null; total_semesters?: number | null };

export default function AcademicSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchTimer = useRef<number | undefined>(undefined);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState<Institution | null>(null);
  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [curriculumId, setCurriculumId] = useState("");
  const [semester, setSemester] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [admissionYear, setAdmissionYear] = useState(String(new Date().getFullYear()));
  const [admissionMode, setAdmissionMode] = useState("Regular");
  const [searching, setSearching] = useState(false);
  const [loadingCurricula, setLoadingCurricula] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestCity, setRequestCity] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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

  async function searchInstitutions(value: string) {
    setQuery(value);
    setSelected(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId("");
    if (value.trim().length < 2) { setInstitutions([]); return; }
    setSearching(true);
    try {
      const response = await fetch(API + "/api/academic/institutions/search?q=" + encodeURIComponent(value.trim()));
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Institution search failed.");
      setInstitutions(Array.isArray(data.data) ? data.data : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Institution search failed."); }
    finally { setSearching(false); }
  }

  async function loadCurricula(nextProgramId: string, nextBranchId: string) {
    if (!selected || !nextProgramId || !nextBranchId) return;
    setLoadingCurricula(true); setCurricula([]); setCurriculumId("");
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
    if (!user || !selected || !curriculumId || !enrollment.trim() || !semester) {
      setError("Complete each required field before continuing."); return;
    }
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const existing = await fetch(API + "/api/student/profile", { headers: { Authorization: "Bearer " + token } });
      const existingData = await existing.json();
      const response = await fetch(API + "/api/student/profile", {
        method: existingData.profile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          institutionId: selected.id, curriculumId, studentIdentifier: enrollment.trim(),
          admissionYear: Number(admissionYear), currentSemesterNumber: Number(semester),
          admissionModeId: null, graduationYear: null, targetCgpa: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save your academic profile.");
      localStorage.setItem("gradly_student_profile", JSON.stringify({
        institutionId: selected.id, institutionName: selected.name, programId,
        programName: selected.branches.find(b => b.program_id === programId)?.program_name || "",
        branchId, branchName: selected.branches.find(b => b.id === branchId)?.name || "",
        curriculumId, semester, enrollment: enrollment.trim(), admissionYear,
        admissionMode, scheme: curricula.find(c => c.id === curriculumId)?.scheme_name || "",
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

  const programs = Array.from(new Map((selected?.branches || []).map(b => [b.program_id, { id: b.program_id, name: b.program_name }])).values());
  const branches = (selected?.branches || []).filter(b => b.program_id === programId);
  const semesterCount = curricula.find(c => c.id === curriculumId)?.total_semesters || (programs.find(p => p.id === programId)?.name.toLowerCase().includes("btech") ? 8 : 4);

  return <main className="academic-setup-page">
    <header className="academic-setup-top"><a href="/" className="academic-setup-brand"><span>G✦</span> Gradly</a><span>STUDENT ACADEMIC SETUP</span></header>
    <section className="academic-setup-layout">
      <aside className="academic-setup-intro">
        <span className="academic-setup-kicker">YOUR ACADEMIC IDENTITY</span>
        <h1>Let's build your<br/><em>academic profile.</em></h1>
        <p>Tell Gradly where you study and which curriculum you follow. We'll use it to organise your subjects, semester results and progress.</p>
        <div className="academic-setup-steps"><b>01 <span>Institution</span></b><b>02 <span>Programme & curriculum</span></b><b>03 <span>Your student details</span></b></div>
        <small>You can update these details later from Academic Profile.</small>
      </aside>
      <section className="academic-setup-card">
        <div className="academic-setup-card-head"><span>PROFILE SETUP · 3 STEPS</span><h2>Where do you study?</h2><p>Search Gradly's directory. If your institution isn't listed, request it below.</p></div>
        {error && <div className="academic-setup-error" role="alert">{error}</div>}
        <form onSubmit={saveProfile}>
          <label>Institution name</label>
          <input value={query} onChange={e => { const value=e.target.value; setQuery(value); window.clearTimeout(searchTimer.current); searchTimer.current=window.setTimeout(() => void searchInstitutions(value), 250); }} placeholder="Start typing your college or university…" autoComplete="organization"/>
          {searching && <small className="academic-setup-hint">Searching Gradly institutions…</small>}
          {institutions.length > 0 && !selected && <div className="academic-setup-results">{institutions.map(item => <button type="button" key={item.id} onClick={() => { setSelected(item); setQuery(item.name); setInstitutions([]); setProgramId(""); setBranchId(""); setCurricula([]); }}><strong>{item.name}</strong><span>{item.branches.length} programme / branch options</span></button>)}</div>}
          {selected && <div className="academic-setup-selected"><span>SELECTED INSTITUTION</span><strong>{selected.name}</strong><button type="button" onClick={() => { setSelected(null); setQuery(""); setProgramId(""); setBranchId(""); setCurricula([]); }}>Change</button></div>}
          {selected && <>
            <div className="academic-setup-grid">
              <div><label>Programme</label><select required value={programId} onChange={e => { setProgramId(e.target.value); setBranchId(""); setCurricula([]); setCurriculumId(""); }}><option value="">Select programme</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label>Branch / specialization</label><select required disabled={!programId} value={branchId} onChange={e => { setBranchId(e.target.value); void loadCurricula(programId, e.target.value); }}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div className="academic-setup-wide"><label>Curriculum / scheme</label><select required disabled={!branchId || loadingCurricula} value={curriculumId} onChange={e => setCurriculumId(e.target.value)}><option value="">{loadingCurricula ? "Loading available schemes…" : "Select curriculum"}</option>{curricula.map(c => <option key={c.id} value={c.id}>{c.scheme_name}{c.version ? " · " + c.version : ""}</option>)}</select>{!loadingCurricula && branchId && !curricula.length && <small className="academic-setup-hint">No curriculum is configured for this branch yet. Use the institution request below or contact your institute administrator.</small>}</div>
              <div><label>Current semester</label><select required value={semester} onChange={e => setSemester(e.target.value)}><option value="">Select semester</option>{Array.from({ length: Math.max(1, Math.min(12, Number(semesterCount))) }, (_, i) => <option key={i + 1} value={String(i + 1)}>Semester {i + 1}</option>)}</select></div>
              <div><label>Admission year</label><input required type="number" min="1900" max="2100" value={admissionYear} onChange={e => setAdmissionYear(e.target.value)}/></div>
              <div className="academic-setup-wide"><label>University enrollment / roll number</label><input required value={enrollment} onChange={e => setEnrollment(e.target.value)} placeholder="Enter your enrollment number"/></div>
              <div><label>Admission mode</label><select value={admissionMode} onChange={e => setAdmissionMode(e.target.value)}><option>Regular</option><option>Direct Second Year</option><option>Transfer</option><option>Other</option></select></div>
            </div>
            <button className="academic-setup-submit" disabled={saving}>{saving ? "Saving profile…" : "Save academic profile →"}</button>
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
