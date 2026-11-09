import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./AcademicSetupPage.css";
import { availableSemesterOptions, resolveCurrentSemesterSelection } from "./academic-setup-state";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Curriculum = { id: string; scheme_name: string; scheme_id?: string; scheme_code?: string | null; version?: string | number | null; total_semesters?: number | null; configured_semesters?: number | null };
type AdmissionMode = { id: string; mode_code: string; mode_name: string; entry_semester: number };
type AcademicStatus = "ENROLLED" | "GRADUATED";
type EnrollmentPreview = {
  recognized: boolean; requiresConfirmation: boolean; unknown?: string; message?: string;
  programme?: string; programId?: string; branch?: string; branchId?: string;
  curriculumId?: string; curriculumName?: string; scheme?: string;
  admissionYear?: number; admissionMode?: string; admissionModeId?: string | null; entrySemester?: number;
  curriculumOptions?: Curriculum[]; totalSemesters?: number; schemeId?: string; schemeCode?: string | null;
  parsed?: { prefix: string; admissionYear: number; admissionModeCode: string; branchCode: string };
  expected?: { expectedSemester: number | null; academicYear: string; semesterType: "ODD" | "EVEN"; expectedDurationEnded: boolean; expectedGraduationSession: string; academicYearLabel: string | null };
};

function validateEnrollmentNumber(value: string): string | null {
  if (!value) return "Enter your enrollment number."; 
  if (!/^(BE|BT|MC|MT)/.test(value)) return "Invalid enrollment number. Programme prefix is not recognized."; 
  if (value[7] !== "F") return "Invalid enrollment number. The 8th character must be F."; 
  if (value.length !== 11) return "Invalid enrollment number. It must contain exactly 11 characters."; 
  if (!/^\d{2}$/.test(value.slice(2, 4))) return "Invalid enrollment number. Admission year must contain two digits."; 
  if (!/^[FS]$/.test(value[4] || "")) return "Invalid enrollment number. Admission mode must be F or S."; 
  if (!/^\d{2}$/.test(value.slice(5, 7))) return "Unrecognized branch code. Please verify your enrollment number."; 
  if (!/^\d{3}$/.test(value.slice(-3))) return "Invalid enrollment number. The last three characters must contain only digits."; 
  return null;
}
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
  const [admissionModes, setAdmissionModes] = useState<AdmissionMode[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => typeof window !== "undefined" && window.localStorage.getItem("gradly-academic-theme") === "dark" ? "dark" : "light");
  const [expectedSemester, setExpectedSemester] = useState<number | null>(null);
  const [expectedDurationEnded, setExpectedDurationEnded] = useState(false);
  const [selectedCurrentSemester, setSelectedCurrentSemester] = useState("");
  const selectedCurrentSemesterRef = useRef("");
  const [academicStatus, setAcademicStatus] = useState<AcademicStatus>("ENROLLED");
  const hasManuallySelectedSemester = useRef(false);
  const [predictionConfirmed, setPredictionConfirmed] = useState<boolean | null>(null);
  const [editingPrediction, setEditingPrediction] = useState(false);
  const [confirmedAdmissionYear, setConfirmedAdmissionYear] = useState("");
  const [confirmedAdmissionMode, setConfirmedAdmissionMode] = useState("");
  const [academicGapYears, setAcademicGapYears] = useState("");
  const [pendingBacklogCount, setPendingBacklogCount] = useState("");
  const [grievanceCategory, setGrievanceCategory] = useState("INVALID_ENROLLMENT");
  const [grievanceDescription, setGrievanceDescription] = useState("");
  const [grievanceBusy, setGrievanceBusy] = useState(false);
  const [grievances, setGrievances] = useState<Array<{id:string;category:string;description:string;status:string;adminNote?:string|null;createdAt:string}>>([]);
  const [institutionRequests, setInstitutionRequests] = useState<Array<{id:string;collegeName:string;locality:string;status:string;createdAt:string;reviewedAt?:string|null}>>([]);
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
  const semesterCount = Number(selectedCurriculum?.total_semesters || selectedCurriculum?.configured_semesters || preview?.totalSemesters) || 0;
  const selectedAdmissionMode = admissionModes.find(item => item.mode_name === confirmedAdmissionMode);
  const predictedEntrySemester = selectedAdmissionMode?.entry_semester ?? preview?.entrySemester ?? 1;
  const availableSemesters = availableSemesterOptions(semesterCount, predictedEntrySemester, expectedSemester, preview?.expected?.semesterType, expectedDurationEnded);
  const enrollmentPrefix = enrollment.trim().toUpperCase().slice(0, 2);
  const eligibleCurricula = curricula.filter(item => {
    const normalized = item.scheme_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (enrollmentPrefix === "BE") return /^new cbcs(?:\s|$)/.test(normalized) && !/\b(nep|new education policy|national education policy)\b/.test(normalized);
    if (enrollmentPrefix === "BT") return /\b(nep|new education policy|national education policy)\b/.test(normalized) && !/\b(cbcs|legacy)\b/.test(normalized);
    return enrollmentPrefix === "MC" || enrollmentPrefix === "MT";
  });
  const adjustedExpectedSemester = expectedSemester !== null && expectedSemester >= predictedEntrySemester && expectedSemester <= semesterCount ? expectedSemester : null;

  useEffect(() => { window.localStorage.setItem("gradly-academic-theme", theme); }, [theme]);

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
          const expectedReferenceSemester = expectedSemester ?? (expectedDurationEnded ? semesterCount : null);
      localStorage.setItem("gradly_student_profile", JSON.stringify({
            institutionId: p.institution_id || "", institutionName: p.institution_name || "",
            programId: p.program_id || "", programName: p.program_name || "",
            branchId: p.branch_id || "", branchName: p.branch_name || "",
            curriculumId: p.curriculum_id || "", semester: String(p.current_semester_number || ""),
            enrollment: p.student_identifier || "", admissionYear: String(p.admission_year || ""),
            admissionMode: p.admission_mode_name || "Regular", admissionNumber: "", scheme: p.scheme_name || "",
            academicProfileConfirmed: Boolean(p.academic_profile_confirmed), pendingBacklogCount: p.pending_backlog_count ?? null,
            academicGapYears: p.academic_gap_years ?? null, predictedSemesterNumber: p.predicted_semester_number ?? null,
          }));
          navigate("/dashboard", { replace: true });
        }
      } catch { /* A missing profile is expected during first-time setup. */ }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const [institutionResponse, grievanceResponse] = await Promise.all([
          fetch(API + "/api/student/institution-requests", { headers: { Authorization: "Bearer " + token } }),
          fetch(API + "/api/student/enrollment-grievances", { headers: { Authorization: "Bearer " + token } }),
        ]);
        const [institutionData, grievanceData] = await Promise.all([institutionResponse.json(), grievanceResponse.json()]);
        if (!cancelled && institutionResponse.ok) setInstitutionRequests(Array.isArray(institutionData.requests) ? institutionData.requests : []);
        if (!cancelled && grievanceResponse.ok) setGrievances(Array.isArray(grievanceData.grievances) ? grievanceData.grievances : []);
      } catch { /* Tracking remains available when the API is reachable. */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function fetchEnrollmentDetails(requestedCurriculumId?: string) {
    const sequence = ++previewSequence.current;
    const curriculumRecheck = Boolean(requestedCurriculumId);
    setError("");
    if (!curriculumRecheck) {
      setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setAdmissionModes([]);
      setSelectedCurrentSemester(""); selectedCurrentSemesterRef.current = ""; setExpectedSemester(null); setExpectedDurationEnded(false); setAcademicStatus("ENROLLED"); setAcademicGapYears(""); setPendingBacklogCount("");
      hasManuallySelectedSemester.current = false; setPredictionConfirmed(null);
    } else if (requestedCurriculumId) {
      setCurriculumId(requestedCurriculumId);
    }
    const normalizedEnrollment = enrollment.trim().toUpperCase();
    const enrollmentError = validateEnrollmentNumber(normalizedEnrollment);
    if (enrollmentError) { setError(enrollmentError); return; }
    if (!selected || !normalizedEnrollment || !user) { setError("Select your institution and enter your enrollment number first."); return; }
    setPreviewBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/enrollment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ institutionId: selected.id, enrollmentNumber: normalizedEnrollment, ...(requestedCurriculumId ? { curriculumId: requestedCurriculumId } : {}) }),
      });
      const payload = await response.json();
      if (sequence !== previewSequence.current) return;
      if (!response.ok) throw new Error(payload.message || "Unable to identify academic details.");
      const result = payload.data as EnrollmentPreview;
      setPreview(result);
      if (result.programId) setProgramId(result.programId);
      if (result.branchId) setBranchId(result.branchId);
      if (result.admissionYear) setConfirmedAdmissionYear(String(result.admissionYear));
      if (result.admissionMode) setConfirmedAdmissionMode(result.admissionMode);

      if (result.curriculumOptions) setCurricula(result.curriculumOptions);
      const modeParams = new URLSearchParams({ institutionId: selected.id, programmePrefix: normalizedEnrollment.slice(0, 2) });
      const modeResponse = await fetch(API + "/api/academic/admission-modes?" + modeParams.toString());
      const modePayload = await modeResponse.json();
      if (sequence !== previewSequence.current) return;
      if (!modeResponse.ok) throw new Error(modePayload.message || "Unable to load admission modes.");
      const modeOptions = Array.isArray(modePayload.data) ? modePayload.data as AdmissionMode[] : [];
      setAdmissionModes(modeOptions);
      if (modeOptions.length && !modeOptions.some(item => item.mode_name === (result.admissionMode || ""))) {
        setConfirmedAdmissionMode(modeOptions[0].mode_name);
      }

      if (!result.recognized || result.requiresConfirmation) {
        setCurriculumId(requestedCurriculumId || "");
        setPredictionConfirmed(null);
        setError(result.message || "Some academic details need manual confirmation.");
        return;
      }
      if (!result.programId || !result.branchId || !result.curriculumId || !result.expected) {
        setError("Programme, branch, curriculum or academic calendar is unresolved. No semester prediction was generated.");
        return;
      }
      setCurriculumId(result.curriculumId);
      setPredictionConfirmed(null); setEditingPrediction(false);
      const params = new URLSearchParams({ institutionId: selected.id, programId: result.programId, branchId: result.branchId });
      let options: Curriculum[] = [];
      try {
        const curriculumResponse = await fetch(API + "/api/academic/curricula?" + params.toString());
        if (curriculumResponse.ok) {
          const curriculumPayload = await curriculumResponse.json();
          options = Array.isArray(curriculumPayload.data) ? curriculumPayload.data as Curriculum[] : [];
        }
      } catch {
        // The enrollment preview already validated the curriculum and returned its semester count.
        // A secondary directory refresh must not suppress the prediction or semester selection.
      }
      if (sequence !== previewSequence.current) return;
      const selectedOption = options.find(item => item.id === result.curriculumId) || {
        id: result.curriculumId,
        scheme_name: result.curriculumName || result.scheme || "Selected curriculum",
        scheme_id: result.schemeId,
        scheme_code: result.schemeCode,
        total_semesters: result.totalSemesters,
        configured_semesters: result.totalSemesters,
      };
      // The preview already validated this curriculum and returned its semester count.
      // Keep that authoritative result usable even if the secondary directory refresh omits the row.
      setCurricula(options.some(item => item.id === result.curriculumId) ? options : [...options, selectedOption]);

      const prediction = Number.isInteger(result.expected.expectedSemester) ? result.expected.expectedSemester : null;
      const semesterLimit = Number(result.totalSemesters || selectedOption.total_semesters || selectedOption.configured_semesters) || 0;
      const validPrediction = prediction !== null && prediction >= 1 && prediction <= semesterLimit;
      setExpectedSemester(validPrediction ? prediction : null);
      setExpectedDurationEnded(Boolean(result.expected.expectedDurationEnded));
      const nextSelection = resolveCurrentSemesterSelection(
        validPrediction ? prediction : null,
        semesterLimit,
        hasManuallySelectedSemester.current,
        selectedCurrentSemesterRef.current,
        Number(result.entrySemester || 1), result.expected.semesterType, Boolean(result.expected.expectedDurationEnded),
      );
      selectedCurrentSemesterRef.current = nextSelection;
      setSelectedCurrentSemester(nextSelection);
      if (hasManuallySelectedSemester.current && nextSelection !== selectedCurrentSemester) {
        hasManuallySelectedSemester.current = false;
      }
    } catch (e) {
      if (sequence === previewSequence.current) {
        setPreview(null); setExpectedSemester(null);
        setError(e instanceof Error ? e.message : "Unable to identify academic details.");
      }
    } finally {
      if (sequence === previewSequence.current) setPreviewBusy(false);
    }
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


  function changeAdmissionMode(modeId: string) {
    const mode = admissionModes.find(item => item.id === modeId);
    if (!mode) { setConfirmedAdmissionMode(""); return; }
    setConfirmedAdmissionMode(mode.mode_name);
    if (!preview?.expected || !confirmedAdmissionYear) return;
    const sessionYear = Number(preview.expected.academicYear.slice(0, 4));
    const sessionOffset = preview.expected.semesterType === "EVEN" ? 1 : 0;
    const candidate = mode.entry_semester + (sessionYear - Number(confirmedAdmissionYear)) * 2 + sessionOffset;
    const durationEnded = candidate > semesterCount;
    const prediction = candidate >= mode.entry_semester && candidate <= semesterCount ? candidate : null;
    setExpectedSemester(prediction);
    setExpectedDurationEnded(durationEnded);
    const previousSelection = selectedCurrentSemesterRef.current;
    const nextSelection = resolveCurrentSemesterSelection(prediction, semesterCount, hasManuallySelectedSemester.current, previousSelection, mode.entry_semester, preview.expected.semesterType, durationEnded);
    selectedCurrentSemesterRef.current = nextSelection;
    setSelectedCurrentSemester(nextSelection);
    if (hasManuallySelectedSemester.current && nextSelection !== previousSelection) {
      hasManuallySelectedSemester.current = false;
    }
  }

  function changeAdmissionYear(value: string) {
    setConfirmedAdmissionYear(value);
    setPredictionConfirmed(null);
    if (!preview?.expected || !/^\d{4}$/.test(value)) return;
    const sessionYear = Number(preview.expected.academicYear.slice(0, 4));
    const offset = preview.expected.semesterType === "EVEN" ? 1 : 0;
    const candidate = predictedEntrySemester + (sessionYear - Number(value)) * 2 + offset;
    const prediction = candidate >= predictedEntrySemester && candidate <= semesterCount ? candidate : null;
    const ended = candidate > semesterCount;
    setExpectedSemester(prediction);
    setExpectedDurationEnded(ended);
    const next = resolveCurrentSemesterSelection(prediction, semesterCount, hasManuallySelectedSemester.current,
      selectedCurrentSemesterRef.current, predictedEntrySemester, preview.expected.semesterType, ended);
    selectedCurrentSemesterRef.current = next;
    setSelectedCurrentSemester(next);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!user || !selected || !preview?.recognized || preview.requiresConfirmation || !curriculumId || !programId || !branchId) {
      setError("Fetch and verify a complete academic profile before saving."); return;
    }
    if (predictionConfirmed !== true) { setError("Please confirm the predicted academic details before continuing."); return; }
    if (!confirmedAdmissionYear || !Number.isInteger(Number(confirmedAdmissionYear)) || Number(confirmedAdmissionYear) < 1900 || Number(confirmedAdmissionYear) > new Date().getFullYear()) {
      setError("Enter a valid admission year."); return;
    }
    const completed = selectedCurrentSemester === "COMPLETED";
    if (!selectedCurrentSemester || (!completed && !availableSemesters.includes(Number(selectedCurrentSemester)))) { setError("Select your current semester."); return; }
    if (completed && Number(pendingBacklogCount || 0) > 0) { setError("You cannot mark the degree as completed while you still have pending backlogs."); return; }
    const finalAcademicStatus: AcademicStatus = completed ? "GRADUATED" : "ENROLLED";
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const existing = await fetch(API + "/api/student/profile", { headers: { Authorization: "Bearer " + token } });
      const existingData = await existing.json();
      const graduationYear = confirmedAdmissionYear && semesterCount ? Number(confirmedAdmissionYear) + Math.ceil((semesterCount - predictedEntrySemester + 1) / 2) : Number(preview.expected?.expectedGraduationSession?.slice(0, 4)) || null;
      const response = await fetch(API + "/api/student/profile", {
        method: existingData.profile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          institutionId: selected.id, curriculumId, studentIdentifier: enrollment,
          admissionYear: Number(confirmedAdmissionYear), currentSemesterNumber: completed ? null : Number(selectedCurrentSemester),
          admissionModeId: confirmedAdmissionMode === preview.admissionMode ? preview.admissionModeId || null : null, admissionModeName: confirmedAdmissionMode, graduationYear, targetCgpa: null,
          academicStatus: finalAcademicStatus, academicProfileConfirmed: true,
          predictedSemesterNumber: expectedSemester,
          academicGapYears: academicGapYears === "" ? null : Number(academicGapYears),
          pendingBacklogCount: pendingBacklogCount === "" ? null : Number(pendingBacklogCount),
          academicProfileOverrides: { programme: programId !== preview.programId, branch: branchId !== preview.branchId, curriculum: curriculumId !== preview.curriculumId, admissionYear: Number(confirmedAdmissionYear) !== Number(preview.admissionYear), admissionMode: confirmedAdmissionMode !== preview.admissionMode },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save your academic profile.");
      localStorage.setItem("gradly_student_profile", JSON.stringify({
        institutionId: selected.id, institutionName: selected.name, programId,
        programName: programs.find(item => item.id === programId)?.name || preview.programme, branchId, branchName: branches.find(item => item.id === branchId)?.name || preview.branch,
        curriculumId, semester: selectedCurrentSemester || "", enrollment, admissionYear: Number(confirmedAdmissionYear),
        admissionMode: confirmedAdmissionMode, graduationYear, academicStatus: finalAcademicStatus,
        academicProfileConfirmed: true,
        expectedSemester,
        expectedDurationEnded: Boolean(expectedDurationEnded),
        estimatedAcademicDelaySemesters: completed || expectedReferenceSemester === null ? null : Math.max(0, expectedReferenceSemester - Number(selectedCurrentSemester)),
        estimatedAcademicDelayYears: completed || expectedReferenceSemester === null ? null : Math.max(0, expectedReferenceSemester - Number(selectedCurrentSemester)) / 2,
        verifiedGapYears: academicGapYears === "" ? null : Number(academicGapYears), gapYearsVerificationStatus: "STUDENT_DECLARED", academicGapYears: academicGapYears === "" ? null : Number(academicGapYears), pendingBacklogCount: pendingBacklogCount === "" ? null : Number(pendingBacklogCount), scheme: curricula.find(item => item.id === curriculumId)?.scheme_name || preview.curriculumName || preview.scheme || "",
      }));
      navigate("/dashboard", { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save your profile."); }
    finally { setSaving(false); }
  }

  async function submitEnrollmentGrievance(event: FormEvent) {
    event.preventDefault();
    if (!user || !selected) { setError("Select your institution before submitting an enrollment grievance."); return; }
    if (grievanceDescription.trim().length < 10) { setError("Please describe the issue in at least 10 characters."); return; }
    setGrievanceBusy(true); setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/enrollment-grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ institutionId: selected.id, enrollmentNumber: enrollment.trim().toUpperCase(), category: grievanceCategory, description: grievanceDescription.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit grievance.");
      setGrievanceDescription("");
      try {
        const listResponse = await fetch(API + "/api/student/enrollment-grievances", { headers: { Authorization: "Bearer " + token } });
        const listData = await listResponse.json();
        if (listResponse.ok) setGrievances(Array.isArray(listData.grievances) ? listData.grievances : []);
      } catch { /* The grievance was submitted; history can refresh on the next visit. */ }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit grievance."); }
    finally { setGrievanceBusy(false); }
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
      try {
        const trackingResponse = await fetch(API + "/api/student/institution-requests", { headers: { Authorization: "Bearer " + token } });
        const trackingData = await trackingResponse.json();
        if (trackingResponse.ok) setInstitutionRequests(Array.isArray(trackingData.requests) ? trackingData.requests : []);
      } catch { /* The request was submitted; tracking can refresh on the next visit. */ }
    } catch (e) { setError(e instanceof Error ? e.message : "Your request could not be submitted."); }
    finally { setRequestBusy(false); }
  }

  function chooseInstitution(item: Institution) {
    previewSequence.current += 1; setPreviewBusy(false); setSelected(item); setQuery(item.name); setInstitutions([]);
    setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setAdmissionModes([]); setSelectedCurrentSemester(""); selectedCurrentSemesterRef.current = ""; setExpectedSemester(null); setAcademicStatus("ENROLLED"); setAcademicGapYears(""); setPendingBacklogCount(""); hasManuallySelectedSemester.current = false; setPreview(null);
  }

  return <main className={"academic-setup-page theme-" + theme}>
    <div className="academic-setup-wrap">
      <header className="academic-setup-header">
        <a href="/" className="academic-setup-brand" aria-label="Gradly home"><span className="academic-setup-logo">G</span><span>gradly</span></a>
        <div className="academic-setup-header-actions"><span className="academic-setup-step">STEP 02 <i /> OF 03</span><button type="button" className="academic-setup-theme-toggle" onClick={() => setTheme(current => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} title={theme === "light" ? "Dark theme" : "Light theme"}>{theme === "light" ? "☾" : "☼"}</button></div>
      </header>
      <div className="academic-setup-progress" aria-label="Step 2 of 3"><span /></div>

      <section className="academic-setup-content">
        <div className="academic-setup-heading">
          <p className="academic-setup-eyebrow">ACADEMIC PROFILE</p>
          <h1>Let's set up your academic profile.</h1>
          <p>Confirm a few details to make Gradly yours.</p>
        </div>

        {error && <div className="academic-setup-error" role="alert"><span>!</span>{error}</div>}

        <form className="academic-setup-form" onSubmit={saveProfile}>
          <section className="academic-setup-field-section">
            <label htmlFor="institution-search">Your institution</label>
            <div className="academic-setup-input-wrap">
              <input id="institution-search" value={query} onChange={e => {
                const value = e.target.value;
                previewSequence.current += 1; setPreviewBusy(false); setQuery(value); setSelected(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setSelectedCurrentSemester(""); selectedCurrentSemesterRef.current = ""; setExpectedSemester(null); setAcademicStatus("ENROLLED"); hasManuallySelectedSemester.current = false; setPreview(null); setPredictionConfirmed(null); setEditingPrediction(false);
                window.clearTimeout(searchTimer.current);
                searchTimer.current = window.setTimeout(() => void searchInstitutions(value), 250);
              }} placeholder="Search your college or university" autoComplete="organization" />
              {searching && <span className="academic-setup-search-spinner" />}
            </div>
            {searching && <small className="academic-setup-helper">Searching institutions…</small>}
            {!searching && query.trim().length >= 2 && !selected && institutions.length === 0 && <small className="academic-setup-helper">No match found. You can request your institution below.</small>}
            {institutions.length > 0 && !selected && <div className="academic-setup-results">{institutions.map(item => <button type="button" key={item.id} onClick={() => chooseInstitution(item)}><span>{item.name}</span><small>{item.branches.length} academic options</small></button>)}</div>}
            {selected && <div className="academic-setup-selected"><span className="academic-setup-selected-check">✓</span><span>{selected.name}</span><button type="button" onClick={() => { previewSequence.current += 1; setPreviewBusy(false); setSelected(null); setQuery(""); setInstitutions([]); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setSelectedCurrentSemester(""); selectedCurrentSemesterRef.current = ""; setExpectedSemester(null); setAcademicStatus("ENROLLED"); hasManuallySelectedSemester.current = false; setPreview(null); }}>Change</button></div>}
          </section>

          {selected && <section className="academic-setup-field-section enrollment-section">
            <label htmlFor="student-enrollment">Your enrollment number</label>
            <div className="academic-setup-enrollment-control">
              <input id="student-enrollment" required value={enrollment} onChange={e => { previewSequence.current += 1; setPreviewBusy(false); setEnrollment(e.target.value); setPreview(null); setProgramId(""); setBranchId(""); setCurricula([]); setCurriculumId(""); setSelectedCurrentSemester(""); setExpectedSemester(null); setAcademicStatus("ENROLLED"); hasManuallySelectedSemester.current = false; setPredictionConfirmed(null); setEditingPrediction(false);  }} placeholder="e.g. BE23S06F007" autoComplete="off" />
              <button type="button" disabled={!enrollment.trim() || previewBusy} onClick={() => void fetchEnrollmentDetails()}>
                {previewBusy ? <><span className="academic-setup-button-spinner" /> Checking</> : <>Identify <span>→</span></>}
              </button>
            </div>
            <small className="academic-setup-helper">Enter it exactly as printed on your university records.</small>
            {previewBusy && <div className="academic-setup-loading"><span className="academic-setup-button-spinner" /> Identifying your academic details…</div>}
          </section>}

          {(preview?.unknown === "SCHEME" || preview?.unknown === "CURRICULUM") && !preview.recognized && <section className="academic-setup-confirmation academic-setup-manual-scheme">
            <div className="academic-setup-confirmation-heading"><h2>Confirm your academic scheme</h2><p>Gradly will not guess a curriculum for this enrollment prefix. Choose the exact scheme used by your institution.</p></div>
            <label htmlFor="manual-scheme-choice">Available curricula</label>
            <select id="manual-scheme-choice" value={curriculumId} onChange={e => { const id = e.target.value; setCurriculumId(id); if (id) void fetchEnrollmentDetails(id); }}>
              <option value="">Select the correct curriculum</option>
              {(preview.curriculumOptions || []).map(option => <option key={option.id} value={option.id}>{option.scheme_name}{option.version ? " · " + option.version : ""}</option>)}
            </select>
            {!(preview.curriculumOptions || []).length && <p>No matching curriculum records are available for this programme and branch. Ask your institution administrator to configure the curriculum.</p>}
          </section>}
          {preview?.recognized && !preview.requiresConfirmation && preview.expected && <>
            <section className="academic-setup-predicted" aria-live="polite">
              <div className="academic-setup-predicted-heading">
                <span className="academic-setup-predicted-sparkle">✦</span>
                <div><h2>Academic details identified</h2><p>Review the information Gradly identified from your enrollment.</p></div>
                <span className="academic-setup-auto-tag"><i /> AUTO-DETECTED</span>
              </div>
              <dl className="academic-setup-predicted-grid">
                <div><dt>Programme</dt><dd>{programs.find(item => item.id === programId)?.name || preview.programme || "—"}</dd></div>
                <div><dt>Branch</dt><dd>{branches.find(item => item.id === branchId)?.name || preview.branch || "—"}</dd></div>
                <div><dt>Admission year</dt><dd>{confirmedAdmissionYear || "—"}</dd></div>
                <div><dt>Admission mode</dt><dd>{confirmedAdmissionMode || "Not specified"}</dd></div>
                <div><dt>Academic scheme</dt><dd>{curricula.find(item => item.id === curriculumId)?.scheme_name || preview.curriculumName || preview.scheme || "—"}</dd></div>
              </dl>
              {predictionConfirmed === true && !editingPrediction ? <div className="academic-setup-confirmed-state"><span>✓</span><div><strong>Academic details confirmed</strong><small>You've confirmed these details for your Gradly profile.</small></div><button type="button" onClick={() => { setPredictionConfirmed(null); setEditingPrediction(true); }}>Edit</button></div> : <>
                <div className="academic-setup-data-question">Is this data correct?</div>
                {!editingPrediction ? <div className="academic-setup-choice-row">
                  <button type="button" className="academic-setup-choice primary-choice" onClick={() => { setPredictionConfirmed(true); setEditingPrediction(false); setError(""); }}>✓ Yes, everything is correct</button>
                  <button type="button" className="academic-setup-choice" onClick={() => { setEditingPrediction(true); setPredictionConfirmed(null); setError(""); }}>No, I want to edit it</button>
                </div> : <div className="academic-setup-edit-fields">
                  <div><label htmlFor="edit-programme">Programme</label><select id="edit-programme" value={programId} onChange={e => { setProgramId(e.target.value); setBranchId(""); setCurricula([]); setCurriculumId(""); }}><option value="">Select programme</option>{programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  <div><label htmlFor="edit-branch">Branch</label><select id="edit-branch" value={branchId} onChange={async e => {
                    const nextBranchId=e.target.value; setBranchId(nextBranchId); setCurricula([]); setCurriculumId("");
                    const nextBranch=branches.find(item=>item.id===nextBranchId);
                    if(!selected || !nextBranch || !user) return;
                    try { const params=new URLSearchParams({institutionId:selected.id,programId:nextBranch.program_id,branchId:nextBranchId}); const response=await fetch(API+"/api/academic/curricula?"+params.toString()); const payload=await response.json(); if(!response.ok) throw new Error(payload.message||"Unable to load the selected branch curriculum."); const options=Array.isArray(payload.data)?payload.data as Curriculum[]:[]; setCurricula(options); if(options.length===1) setCurriculumId(options[0].id); } catch(e) { setError(e instanceof Error?e.message:"Unable to load curriculum options."); }
                  }}><option value="">Select branch</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  <div className="academic-setup-edit-wide"><label htmlFor="edit-scheme">Academic scheme</label><select id="edit-scheme" value={curriculumId} onChange={e => { setCurriculumId(e.target.value); setPredictionConfirmed(null); }}><option value="">Select scheme</option>{eligibleCurricula.map(item => <option key={item.id} value={item.id}>{item.scheme_name}{item.version ? " · "+item.version : ""}</option>)}</select></div>
                  <div><label htmlFor="edit-admission-year">Admission year</label><input id="edit-admission-year" type="number" min="1990" max={new Date().getFullYear()} value={confirmedAdmissionYear} onChange={e => changeAdmissionYear(e.target.value)} /></div>
                  <div className="academic-setup-edit-wide"><label htmlFor="edit-admission-mode">Admission mode</label><select id="edit-admission-mode" value={selectedAdmissionMode?.id || ""} onChange={e => changeAdmissionMode(e.target.value)}><option value="">Select admission mode</option>{admissionModes.map(item => <option key={item.id} value={item.id}>{item.mode_name}</option>)}</select></div>
                  <div className="academic-setup-edit-actions"><button type="button" className="academic-setup-choice" onClick={() => { setEditingPrediction(false); setPredictionConfirmed(null); }}>Cancel</button><button type="button" className="academic-setup-choice primary-choice" disabled={!programId || !branchId || !curriculumId || !/^\d{4}$/.test(confirmedAdmissionYear) || Number(confirmedAdmissionYear) < 1990 || Number(confirmedAdmissionYear) > new Date().getFullYear() || !confirmedAdmissionMode.trim()} onClick={() => { setPredictionConfirmed(true); setEditingPrediction(false); setError(""); }}>Confirm updated details</button></div>
                </div>}
              </>}
            <section className="academic-setup-confirmation academic-setup-journey">
              <div className="academic-setup-confirmation-heading"><h2>Your Academic Journey</h2><p>Choose the semester you are actually in. The prediction is only a comparison reference.</p></div>
              <div className="academic-setup-journey-grid">
                <div className="academic-setup-current-semester"><label htmlFor="actual-semester">Current Semester</label><select id="actual-semester" required value={selectedCurrentSemester} onChange={e => { setSelectedCurrentSemester(e.target.value); selectedCurrentSemesterRef.current = e.target.value; hasManuallySelectedSemester.current = true; }}><option value="">Choose your current semester</option>{availableSemesters.map(number => <option key={number} value={String(number)}>Semester {number}</option>)}<option value="COMPLETED">Completed Programme</option></select></div>
                <div className="academic-setup-prediction-reference"><span>Predicted current semester</span><strong>{adjustedExpectedSemester ? "Semester " + adjustedExpectedSemester : expectedDurationEnded ? "Expected duration completed" : "Not available"}</strong><small>Based on your enrollment details and selected admission mode</small></div>
              </div>
              {selectedCurrentSemester && selectedCurrentSemester !== "COMPLETED" && <div className="academic-setup-delay">
                <div className="academic-setup-delay-metrics"><div><span>Estimated academic delay</span><strong>{adjustedExpectedSemester === null ? "Not available" : adjustedExpectedSemester > Number(selectedCurrentSemester) ? (adjustedExpectedSemester - Number(selectedCurrentSemester)) + " semester(s) · " + ((adjustedExpectedSemester - Number(selectedCurrentSemester)) / 2) + " year(s)" : "No estimated delay"}</strong></div></div>
                <p>{adjustedExpectedSemester === null ? "No expected semester is available for comparison in this session." : "Expected semester " + adjustedExpectedSemester + " is compared with your selected semester " + selectedCurrentSemester + "."} This is an estimate, not a verified gap-year record.</p>
              </div>}
              {selectedCurrentSemester === "COMPLETED" && <div className="academic-setup-completed-message">✓ You selected Completed Programme. Gradly will mark your academic status as completed.</div>}
              <div className="academic-setup-journey-grid academic-setup-history-fields">
                <div className="academic-setup-current-semester">
                  <label htmlFor="academic-gap-years">Academic gap (student-declared)</label>
                  <select id="academic-gap-years" value={academicGapYears} onChange={e => setAcademicGapYears(e.target.value)}>
                    <option value="">Not specified</option><option value="0">No gap</option>
                    {Array.from({length:10},(_,index)=>index+1).map(year=><option key={year} value={String(year)}>{year} {year===1?"year":"years"}</option>)}
                  </select>
                </div>
                <div className="academic-setup-current-semester">
                  <label htmlFor="pending-backlogs">Pending backlogs (optional)</label>
                  <input id="pending-backlogs" type="number" min="0" max="100" value={pendingBacklogCount} onChange={e=>setPendingBacklogCount(e.target.value)} placeholder="Enter count" />
                </div>
              </div>
          
            </section>

  </section>

            <button className="academic-setup-continue" type="submit" disabled={saving || previewBusy || predictionConfirmed !== true || !selectedCurrentSemester || !curriculumId}>
              {saving ? <><span className="academic-setup-button-spinner" /> Saving your profile…</> : <>Confirm &amp; Continue <span>→</span></>}
            </button>
            <p className="academic-setup-footnote">Your information is saved to your authenticated Gradly student profile.</p>
          </>}
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
        {institutionRequests.length > 0 && <section className="academic-setup-request-tracking">
          <h3>Your institution requests</h3>
          {institutionRequests.map(request=><div key={request.id} className="academic-setup-request-row">
            <div><strong>{request.collegeName}</strong><small>{request.locality} · {new Date(request.createdAt).toLocaleDateString()}</small></div>
            <span>{request.status.replace(/_/g," ")}</span>
          </div>)}
        </section>}
        <details className="academic-setup-institution-request academic-setup-grievance">
          <summary>Having trouble with your enrollment number or academic details?</summary>
          <form onSubmit={submitEnrollmentGrievance}>
            <label>Issue category
              <select value={grievanceCategory} onChange={e=>setGrievanceCategory(e.target.value)}>
                <option value="INVALID_ENROLLMENT">Enrollment number marked invalid</option>
                <option value="ALREADY_REGISTERED">Enrollment number already registered</option>
                <option value="WRONG_PROGRAMME">Incorrect programme / degree</option>
                <option value="WRONG_SCHEME">Incorrect academic scheme</option>
                <option value="WRONG_BRANCH">Incorrect branch</option>
                <option value="WRONG_ADMISSION_MODE">Incorrect admission mode</option>
                <option value="WRONG_SEMESTER">Incorrect semester prediction</option>
                <option value="OTHER">Other enrollment issue</option>
              </select>
            </label>
            <label>Enrollment number (if available)
              <input value={enrollment} onChange={e=>setEnrollment(e.target.value.toUpperCase())} maxLength={32} placeholder="e.g. BE23S06F007" />
            </label>
            <label>Describe your issue
              <textarea required minLength={10} maxLength={3000} rows={4} value={grievanceDescription} onChange={e=>setGrievanceDescription(e.target.value)} placeholder="Explain what happened so the Super Admin team can verify your record." />
            </label>
            <button type="submit" disabled={grievanceBusy || !selected}>{grievanceBusy ? "Submitting…" : "Submit grievance"}</button>
          </form>
          {grievances.length > 0 && <div className="academic-setup-grievance-list">
            <h3>Your grievance history</h3>
            {grievances.map(item=><article key={item.id}>
              <div><strong>{item.category.replace(/_/g," ")}</strong><span>{item.status.replace(/_/g," ")}</span></div>
              <p>{item.description}</p>
              {item.adminNote && <small>Admin response: {item.adminNote}</small>}
              <small>Submitted {new Date(item.createdAt).toLocaleDateString()}</small>
            </article>)}
          </div>}
        </details>
      </section>
      <footer className="academic-setup-footer"><span>© Gradly</span><span>ACADEMIC SETUP</span></footer>
    </div>
  </main>;
}
