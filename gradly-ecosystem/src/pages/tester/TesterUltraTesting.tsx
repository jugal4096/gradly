import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, BarChart3, BookOpen, Download, FlaskConical, Play, RefreshCw, Search, ShieldCheck, Square, Users, WandSparkles } from "lucide-react";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";
import "./TesterUltraEnhancements.css";

const API = API_BASE_URL.replace(/\/+$/, "");
// GECA zero-point outcomes: D and its D1/D2/D3 variants, plus legacy F/AB tokens.
const GRADE_POINTS: Record<string, number> = { "A++": 10, "A+": 9, A: 8, "B+": 7, B: 6, "C+": 5, C: 4, D: 0, D1: 0, D2: 0, D3: 0, F: 0, AB: 0 };
const ZERO_CREDIT_MANDATORY_CODES = new Set(["INMC2001", "INMC2010"]);
// GECA official CSE NEP Sem VI credit confirmations; used only if live catalogue lookup is unavailable.
const GECA_VERIFIED_CREDIT_OVERRIDES: Record<string, number> = { CSHNC0020: 4, INMDM9006: 3 };
type Institution = { id: string; name: string; branches?: unknown[] };
type Preview = { recognized: boolean; requiresConfirmation?: boolean; message?: string; programme?: string; programId?: string; branch?: string; branchId?: string; curriculumId?: string; curriculumName?: string; scheme?: string; admissionYear?: number; admissionMode?: string; entrySemester?: number; totalSemesters?: number };
type ResultSession = { id: string; title: string; url: string };
type CatalogueSubject = { code?: string; name?: string; courseCode?: string; courseName?: string; credits?: number | string; semesterNumber?: number | string; courseType?: string; mandatory?: boolean };
type ResultGrade = { courseCode: string; grade: string; courseName?: string; credits?: number };
type ResultDocument = { title: string; url: string; semester: number | null; grades: ResultGrade[] };
type SubjectFinding = { code: string; name: string; grade: string; credits: number | null; kind: "NEW" | "NAME_MISMATCH" | "CREDIT_MISMATCH" | "CODE_MISMATCH"; semester: number; document: string };
type SemesterAudit = { semester: number; sgpa: number | null; cgpa: number | null; credits: number; subjects: number; status: string; failedRemark?: boolean; findings: SubjectFinding[]; error?: string };
type StudentAudit = { enrollment: string; status: "queued" | "processing" | "completed" | "partial" | "failed"; branch: string; scheme: string; admissionMode: string; curriculumId: string; semesters: SemesterAudit[]; errors: string[]; findings: SubjectFinding[]; cgpa: number | null };
type GlobalFinding = Omit<SubjectFinding, "semester"> & { semesters: number[]; occurrences: number; enrollments: string[]; branchNames: string[] };
const normalizeCode = (value: unknown) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const courseCodeAliases = (value: unknown) => String(value || "").toUpperCase().split(/[\\/;,]+/).map(normalizeCode).filter(Boolean);
const catalogueCodeMatches = (candidate: unknown, code: string) => courseCodeAliases(candidate).includes(code);
const normalizeName = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const uniqueEnrollments = (value: string) => [...new Set(value.split(/[\s,;]+/).map(item => item.trim().toUpperCase()).filter(Boolean))];
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
const normalizeResultSessions = (value: unknown): ResultSession[] => Array.isArray(value) ? value.filter((item: any) => item && item.id != null).map((item: any) => ({ id: String(item.id), title: String(item.title || item.name || "Untitled examination session"), url: String(item.url || "") })) : [];

export default function TesterUltraTesting() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [testerId, setTesterId] = useState("Tester");
  const [institutionQuery, setInstitutionQuery] = useState("Government College of Engineering");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [enrollmentText, setEnrollmentText] = useState("");
  const [sampleProgramme, setSampleProgramme] = useState<"BE"|"BT"|"MT"|"MC">("BE");
  const [sampleAdmissionYear, setSampleAdmissionYear] = useState("2023");
  const [sampleAdmissionMode, setSampleAdmissionMode] = useState<"F"|"S">("F");
  const [sampleBranch, setSampleBranch] = useState("01");
  const [sampleSerialStart, setSampleSerialStart] = useState("1");
  const [sampleCount, setSampleCount] = useState("10");
  const [generatedEnrollments, setGeneratedEnrollments] = useState<string[]>([]);
  const [generatorError, setGeneratorError] = useState("");

  const [sessions, setSessions] = useState<ResultSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [searchingInstitutions, setSearchingInstitutions] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<StudentAudit[]>([]);
  const [activeTab, setActiveTab] = useState<"students" | "subjects" | "branches" | "issues">("students");
  const [analyticsSemester, setAnalyticsSemester] = useState(1);
  const [analyticsMetric, setAnalyticsMetric] = useState<"sgpa" | "cgpa">("sgpa");
  const [analyticsScheme, setAnalyticsScheme] = useState("ALL");
  const [analyticsAdmission, setAnalyticsAdmission] = useState("ALL");
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("gradly_tester_access_token") || sessionStorage.getItem("gradly_tester_access_token") || "";
    if (!saved) { navigate("/tester/login", { replace: true }); return; }
    setToken(saved);
    const controller = new AbortController();
    fetch(API + "/api/tester/me", { headers: { Authorization: "Bearer " + saved }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Tester access is inactive. Sign in again."); return response.json(); })
      .then(data => setTesterId(data.tester?.loginId || "Tester"))
      .catch(reason => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Unable to verify tester access."); if (/inactive/i.test(String(reason))) navigate("/tester/login", { replace: true }); } });
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoadingSessions(true);
    fetch(API + "/api/tester/results/sessions", { headers: { Authorization: "Bearer " + token }, signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.message || "Unable to load GECA examination sessions."); return body; })
      .then(body => { const loaded = normalizeResultSessions(body.sessions); setSessions(loaded);  })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load examination sessions."); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSessions(false); });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    const query = institutionQuery.trim();
    if (query.length < 2 || institution) { setInstitutions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingInstitutions(true);
      try {
        const response = await fetch(API + "/api/academic/institutions/search?q=" + encodeURIComponent(query), { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Institution search failed.");
        const matches = Array.isArray(body.data) ? body.data as Institution[] : [];
        const defaultGeca = matches.find(item => /government college of engineering/i.test(item.name) && /aurangabad|chhatrapati sambhajinagar|geca/i.test(item.name))
          || matches.find(item => /government college of engineering/i.test(item.name))
          || matches.find(item => /geca|chhatrapati sambhajinagar/i.test(item.name));
        if (!institution && defaultGeca) {
          setInstitution(defaultGeca);
          setInstitutionQuery(defaultGeca.name);
          setInstitutions([]);
        } else {
          setInstitutions(matches);
        }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Institution search failed."); }
      finally { if (!controller.signal.aborted) setSearchingInstitutions(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [institutionQuery, institution]);

  const enrollmentList = useMemo(() => uniqueEnrollments(enrollmentText), [enrollmentText]);
  useEffect(() => {
    const parsed = enrollmentList.map(value => /^(BE|BT)(\d{2})([FS])(\d{2})F(\d{3})$/.exec(value)).filter(Boolean) as RegExpExecArray[];
    const onlyDse = parsed.length > 0 && parsed.length === enrollmentList.length && parsed.every(match => match[3] === "S");
    if (onlyDse) setSelectedSemesters(current => current.filter(semester => semester >= 3));
  }, [enrollmentList]);
  const supportedInstitution = Boolean(institution && /geca|aurangabad|chhatrapati sambhajinagar/i.test(institution.name));
  const duplicateCount = enrollmentText.split(/[\s,;]+/).map(item => item.trim().toUpperCase()).filter(Boolean).length - enrollmentList.length;
  const globalFindings = useMemo<GlobalFinding[]>(() => {
    const grouped = new Map<string, GlobalFinding>();
    rows.forEach(student => student.findings.forEach(item => {
      const key = [student.curriculumId, normalizeCode(item.code), item.kind].join("|");
      const existing = grouped.get(key);
      if (existing) { existing.occurrences++; if (!existing.semesters.includes(item.semester)) existing.semesters.push(item.semester); if (!existing.enrollments.includes(student.enrollment)) existing.enrollments.push(student.enrollment); if (student.branch && !existing.branchNames.includes(student.branch)) existing.branchNames.push(student.branch); }
      else { const { semester, ...rest } = item; grouped.set(key, { ...rest, semesters: [semester], occurrences: 1, enrollments: [student.enrollment], branchNames: student.branch ? [student.branch] : [] }); }
    }));
    return [...grouped.values()].map(item=>({...item,semesters:item.semesters.sort((a,b)=>a-b)})).sort((a,b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));
  }, [rows]);
  const completedCount = rows.filter(row => row.status === "completed" || row.status === "partial" || row.status === "failed").length;
  const successfulCount = rows.filter(row => row.status === "completed").length;
  const failedCount = rows.filter(row => row.status === "failed").length;
  async function fetchJson(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + token);

    // GECA PDF matching can take time, but a stalled API must never leave an
    // enrollment permanently marked as "processing" in the audit table.
    const requestController = new AbortController();
    const callerSignal = init.signal;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, 120_000);
    const abortFromCaller = () => requestController.abort();
    if (callerSignal?.aborted) requestController.abort();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      let response: Response;
      try {
        response = await fetch(url, { ...init, headers, signal: requestController.signal });
      } catch (reason) {
        if (timedOut && !callerSignal?.aborted) {
          throw new Error("The backend did not respond within 120 seconds. This semester scan timed out; check Render logs and retry with fewer enrollments or examination sessions.");
        }
        throw reason;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "The audit request failed.");
      return body;
    } finally {
      window.clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }


  async function runAudit() {
    if (!institution || !supportedInstitution || !token || !enrollmentList.length || enrollmentList.length > 100 || !selectedSessions.length || !selectedSemesters.length) {
      setError("Choose an institution, enter 1–100 unique enrollments, select at least one examination session and semester, then start the audit.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true); setError(""); setNotice("");
    const initial: StudentAudit[] = enrollmentList.map(enrollment => ({ enrollment, status: "queued", branch: "", scheme: "", admissionMode: "", curriculumId: "", semesters: [], errors: [], findings: [], cgpa: null }));
    setRows(initial);
    const catalogueCache = new Map<string, Promise<CatalogueSubject[]>>();
    const getCatalogue = (curriculumId: string, entrySemester: number) => {
      const key = curriculumId + ":" + entrySemester;
      if (!catalogueCache.has(key)) catalogueCache.set(key, fetchJson(API + "/api/academic/curricula/" + encodeURIComponent(curriculumId) + "/semesters/" + entrySemester + "/subjects?includeAllBranches=true&includeAllSemesters=true", { signal: controller.signal }).then(body => Array.isArray(body.data) ? body.data : []));
      return catalogueCache.get(key)!;
    };
    let cursor = 0;
    const worker = async () => {
      while (cursor < enrollmentList.length && !controller.signal.aborted) {
        const index = cursor++;
        const enrollment = enrollmentList[index];
        setRows(current => current.map((row,i)=>i===index?{...row,status:"processing"}:row));
        try {
          const previewBody = await fetchJson(API + "/api/tester/enrollment/preview", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ institutionId: institution.id, enrollmentNumber: enrollment }), signal:controller.signal });
          const preview = previewBody.data as Preview;
          if (!preview?.recognized || preview.requiresConfirmation || !preview.curriculumId) throw new Error(preview?.message || "Enrollment could not be confidently resolved to a curriculum.");
          const entrySemester = Math.max(1, Number(preview.entrySemester || 1));
          const catalogue = await getCatalogue(preview.curriculumId, entrySemester);
          const semesterAudits: SemesterAudit[] = [];
          const allFindings: SubjectFinding[] = [];
          const allErrors: string[] = [];
          let cumulativeWeighted = 0;
          let cumulativeCredits = 0;
          let cumulativeComplete = true;
          const applicableSemesters = [...selectedSemesters].filter(value=>value>=entrySemester && value<=Number(preview.totalSemesters||8)).sort((a,b)=>a-b);
          let expectedSemester = entrySemester;
          for (const semester of applicableSemesters) {
            if (semester !== expectedSemester) cumulativeComplete = false;
            expectedSemester = semester + 1;
            if (controller.signal.aborted) break;
            let found: ResultDocument | null = null;
            let semesterError = "";
            for (const sessionId of selectedSessions) {
              const session = sessions.find(item=>item.id===sessionId);
              if (!session) continue;
              try {
                const matchBody = await fetchJson(API + "/api/tester/results/sessions/" + encodeURIComponent(session.id) + "/match", {
                  method:"POST", headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({ enrollmentNumber: enrollment, selectedSemester: semester }),
                  signal:controller.signal,
                });
                const docs = Array.isArray(matchBody.matches) ? matchBody.matches as ResultDocument[] : [];
                const match = docs.find(document => Number(document.semester) === semester && Array.isArray(document.grades) && document.grades.length > 0);
                if (matchBody.scanIncomplete || Number(matchBody.parseFailures || 0) > 0) semesterError = "Result scan diagnostics: " + Number(matchBody.documentsScanned || 0) + " PDFs scanned, " + Number(matchBody.parseFailures || 0) + " parse failures, " + Number(matchBody.downloadFailures || 0) + " download failures.";
                else if (Number(matchBody.enrollmentHits) > 0) semesterError = "Enrollment was found in a PDF, but its subject grades could not be parsed.";
                if (match) { found = match; break; }
              } catch (reason) {
                const message = reason instanceof Error ? reason.message : "Result fetch failed.";
                semesterError = message;
                if (controller.signal.aborted) break;
              }
            }
            if (!found) {
              const unavailable = semesterError.includes("unavailable only for Semester II");
              const issue = semesterError || "No matching result was found in the selected examination sessions.";
              allErrors.push("Semester " + semester + ": " + issue);
              cumulativeComplete = false;
              semesterAudits.push({ semester, sgpa:null, cgpa:null, credits:0, subjects:0, status:unavailable?"MANUAL ONLY":"NOT FOUND", findings:[], error:issue });
              continue;
            }
            const resultCodes = [...new Set(found.grades.map(row=>normalizeCode(row.courseCode)).filter(Boolean))];
            let sharedRegistry: CatalogueSubject[] = [];
            try {
              const registryBody = await fetchJson(API + "/api/tester/results/discovered-subjects?curriculumId=" + encodeURIComponent(preview.curriculumId) + "&codes=" + encodeURIComponent(resultCodes.join(",")), { signal:controller.signal });
              sharedRegistry = Array.isArray(registryBody.data) ? registryBody.data as CatalogueSubject[] : [];
            } catch (reason) {
              if (controller.signal.aborted) throw reason;
              allErrors.push("Semester " + semester + ": institution-wide subject catalogue could not be checked; curriculum-only comparison was used.");
            }
            const findings: SubjectFinding[] = [];
            const incompleteRows: string[] = [];
            let failedRemark = false;
            let weighted = 0, credits = 0, incomplete = false;
            for (const resultRow of found.grades) {
              const code = normalizeCode(resultRow.courseCode);
              if (!code) continue;
              const curriculumCodeRow = catalogue.find(item=>catalogueCodeMatches(item.code,code));
              const sharedCodeRow = sharedRegistry.find(item=>catalogueCodeMatches(item.code ?? item.courseCode,code));
              const nameMatchedRow = !curriculumCodeRow && !sharedCodeRow && resultRow.courseName ? catalogue.find(item=>normalizeName(item.name)===normalizeName(resultRow.courseName)) : undefined;
              const catalogueRow = curriculumCodeRow || sharedCodeRow || nameMatchedRow;
              const grade = String(resultRow.grade || "").trim().toUpperCase();
              const zeroCreditMandatory = ZERO_CREDIT_MANDATORY_CODES.has(code);
              // Prefer a positive, authoritative credit mapping. A stale zero-credit
              // placeholder in one branch must not mask a valid shared-registry value.
              const creditCandidates = [curriculumCodeRow?.credits, sharedCodeRow?.credits, nameMatchedRow?.credits, resultRow.credits]
                .map(value => value == null || value === "" ? Number.NaN : Number(value));
              const mappedCredits = creditCandidates.find(value => Number.isFinite(value) && value > 0);
              // The official GECA confirmations are a last-resort fallback, never overriding live curriculum data.
              const verifiedFallbackCredits = GECA_VERIFIED_CREDIT_OVERRIDES[code];
              const rowCredits = zeroCreditMandatory ? 0 : mappedCredits ?? verifiedFallbackCredits ?? 0;
              // A dash in an optional curriculum subject means the student did not select that elective/minor.
              // It is not a missing grade and must not withhold an otherwise valid SGPA.
              if (grade === "-" && curriculumCodeRow?.mandatory === false) continue;
              if (!catalogueRow && !zeroCreditMandatory) findings.push({ code:resultRow.courseCode, name:resultRow.courseName || resultRow.courseCode, grade, credits:rowCredits>0?rowCredits:null, kind:"NEW", semester, document:found.title });
              else if (catalogueRow) {
                if (nameMatchedRow) findings.push({ code:resultRow.courseCode, name:resultRow.courseName || String(nameMatchedRow.name || resultRow.courseCode), grade, credits:rowCredits>0?rowCredits:null, kind:"CODE_MISMATCH", semester, document:found.title });
                if ((curriculumCodeRow || sharedCodeRow) && resultRow.courseName && (catalogueRow.name || catalogueRow.courseName) && normalizeName(resultRow.courseName)!==normalizeName(catalogueRow.name ?? catalogueRow.courseName)) findings.push({ code:resultRow.courseCode, name:resultRow.courseName, grade, credits:rowCredits>0?rowCredits:null, kind:"NAME_MISMATCH", semester, document:found.title });
                if (Number.isFinite(Number(resultRow.credits)) && Number(resultRow.credits)>0 && Number(catalogueRow.credits)>0 && Number(resultRow.credits)!==Number(catalogueRow.credits)) findings.push({ code:resultRow.courseCode, name:resultRow.courseName || catalogueRow.name || catalogueRow.courseName || resultRow.courseCode, grade, credits:rowCredits, kind:"CREDIT_MISMATCH", semester, document:found.title });
                if (curriculumCodeRow && sharedCodeRow && Number(curriculumCodeRow.credits)>0 && Number(sharedCodeRow.credits)>0 && Number(curriculumCodeRow.credits)!==Number(sharedCodeRow.credits)) findings.push({ code:resultRow.courseCode, name:String(curriculumCodeRow.name || resultRow.courseName || resultRow.courseCode), grade, credits:Number(sharedCodeRow.credits), kind:"CREDIT_MISMATCH", semester, document:found.title });
              }
              const points = GRADE_POINTS[grade];
              // Environmental Studies is a valid zero-credit mandatory course;
              // it contributes neither numerator nor denominator and cannot block SGPA.
              if (zeroCreditMandatory) continue;
              if (!Number.isFinite(rowCredits) || rowCredits<=0) incompleteRows.push(code + " (credit mapping)");
              if (points===undefined) incompleteRows.push(code + " (grade " + (grade || "missing") + ")");
              if (!Number.isFinite(rowCredits) || rowCredits<=0 || points===undefined) { incomplete=true; continue; }
              credits += rowCredits; weighted += rowCredits*points;
            }
            const sgpa = !incomplete && credits>0 ? weighted/credits : null;
            if (sgpa!==null) { cumulativeWeighted+=weighted; cumulativeCredits+=credits; } else cumulativeComplete=false;
            const cgpa = cumulativeComplete && cumulativeCredits>0 ? cumulativeWeighted/cumulativeCredits : null;
            allFindings.push(...findings);
            semesterAudits.push({ semester, sgpa, cgpa, credits, subjects:found.grades.length, status:sgpa===null?"INCOMPLETE":"VERIFIED", failedRemark, findings, error:sgpa===null?"Could not map "+incompleteRows.join(", ")+". SGPA is withheld rather than estimated.":undefined });
          }
          const status: StudentAudit["status"] = semesterAudits.length>0 && semesterAudits.every(item=>item.status==="VERIFIED") && allErrors.length===0 ? "completed" : semesterAudits.some(item=>item.status==="VERIFIED") ? "partial" : "failed";
          setRows(current => current.map((row,i)=>i===index?{...row,status,branch:preview.branch||"Unknown",scheme:preview.scheme||preview.curriculumName||"Unknown",admissionMode:preview.admissionMode||"Unknown",curriculumId:preview.curriculumId||"",semesters:semesterAudits,errors:allErrors,findings:allFindings,cgpa:cumulativeComplete&&cumulativeCredits>0?cumulativeWeighted/cumulativeCredits:null}:row));
        } catch (reason) {
          if (controller.signal.aborted) break;
          const message = reason instanceof Error ? reason.message : "Unexpected enrollment audit failure.";
          setRows(current => current.map((row,i)=>i===index?{...row,status:"failed",errors:[message]}:row));
        }
      }
    };
    try {
      await worker(); // Serialize enrollment scans on the 512 MiB Render instance to avoid overlapping PDF.js memory spikes.
      if (controller.signal.aborted) { setRows(current=>current.map(row=>row.status==="processing"?{...row,status:"queued"}:row)); setNotice("Batch stopped. Completed student reports have been retained in this workspace; unprocessed enrollments remain queued."); }
      else setNotice("Batch audit finished. Review incomplete records and the consolidated discovery registry below.");
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function generateSampleEnrollments() {
    setGeneratorError("");
    const year = Number(sampleAdmissionYear);
    const serialStart = Number(sampleSerialStart);
    const count = Number(sampleCount);
    if (!/^\d{4}$/.test(sampleAdmissionYear) || year < 2000 || year > 2099) { setGeneratorError("Enter a four-digit admission year between 2000 and 2099."); return; }
    if (!Number.isInteger(serialStart) || serialStart < 1 || serialStart > 999) { setGeneratorError("Starting serial must be between 001 and 999."); return; }
    if (sampleProgramme === "BE" && year !== 2023) { setGeneratorError("GECA New CBCS BE enrollment generation is limited to the 2023 admission cohort under the current identity rules. Choose B.Tech (NEP) for other cohorts."); return; }
    if (sampleProgramme === "MT" && year < 2023) { setGeneratorError("GECA M.Tech NEP enrollment numbers begin with the 2023 admission cohort."); return; }
    if ((sampleProgramme === "MC" || sampleProgramme === "MT") && sampleAdmissionMode !== "F") { setGeneratorError("M.Tech and MCA use Regular admission (F) only."); return; }
    if (!/^\d{2}$/.test(sampleBranch)) { setGeneratorError("Enter a valid two-digit branch/specialization code (00–99)."); return; }
    if (!Number.isInteger(count) || count < 1 || count > 100 || serialStart + count - 1 > 999) { setGeneratorError("Choose 1–100 samples and keep the final serial at or below 999."); return; }
    const yy = String(year).slice(-2);
    const generated = Array.from({length:count},(_,index)=>sampleProgramme+yy+sampleAdmissionMode+sampleBranch+"F"+String(serialStart+index).padStart(3,"0"));
    setGeneratedEnrollments(generated);
    setNotice("Generated "+generated.length+" illustrative sample enrollment numbers. These are synthetic test IDs, not proof of real student enrollment.");
  }

  function importGeneratedEnrollments() {
    if (!generatedEnrollments.length) return;
    const merged = uniqueEnrollments([enrollmentText.trim(),generatedEnrollments.join("\n")].filter(Boolean).join("\n"));
    if (merged.length > 100) { setGeneratorError("Import would exceed the 100-enrollment batch limit. Reduce the sample count or clear some existing IDs."); return; }
    setEnrollmentText(merged.join("\n"));
    setGeneratorError("");
    setNotice("Imported "+generatedEnrollments.length+" generated sample IDs into the Ultra Testing batch.");
  }

  function stopAudit() { abortRef.current?.abort(); }
  function toggleSemester(value:number) { setSelectedSemesters(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value].sort((a,b)=>a-b)); }
  function toggleSession(id:string) { setSelectedSessions(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]); }

  function exportCsv() {
    const lines = [["Enrollment","Branch","Scheme","Semester","SGPA","Cumulative CGPA","Credits","Status","Issue"]];
    rows.forEach(row => {
      if (!row.semesters.length) lines.push([row.enrollment,row.branch,row.scheme,"","","","",""+row.status,row.errors.join(" | ")]);
      row.semesters.forEach(sem=>lines.push([row.enrollment,row.branch,row.scheme,String(sem.semester),sem.sgpa===null?"":sem.sgpa.toFixed(3),sem.cgpa===null?"":sem.cgpa.toFixed(3),String(sem.credits),sem.status,sem.error||""]));
    });
    const csv = lines.map(line=>line.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href=url; anchor.download="gradly-ultra-audit.csv"; anchor.click(); URL.revokeObjectURL(url);
  }


  // Keep the input cohort ordered by the same fixed enrollment-number positions
  // used by the academic identity decoder: prefix, YY, F/S, branch, fixed F, serial.
  const enrollmentSortParts = (value: string) => {
    const match = /^(BE|BT|MC|ME|MT)(\d{2})([FS])(\d{2})F(\d{3})$/.exec(value);
    if (!match) return { scheme: 9, prefix: "ZZ", year: 9999, mode: "Z", branch: "ZZ", serial: 9999 };
    const scheme = match[1] === "BE" || match[1] === "ME" ? 0
      : match[1] === "BT" || match[1] === "MT" ? 1 : 2;
    return { scheme, prefix: match[1], year: 2000 + Number(match[2]), mode: match[3], branch: match[4], serial: Number(match[5]) };
  };
  const sortedEnrollmentList = useMemo(() => [...enrollmentList].sort((a,b) => {
    const left=enrollmentSortParts(a), right=enrollmentSortParts(b);
    return left.scheme-right.scheme || left.prefix.localeCompare(right.prefix) || left.year-right.year ||
      left.branch.localeCompare(right.branch) || left.mode.localeCompare(right.mode) || left.serial-right.serial || a.localeCompare(b);
  }), [enrollmentList]);
  const enrollmentSchemeCounts = useMemo(() => sortedEnrollmentList.reduce((counts,value) => {
    const prefix=value.slice(0,2);
    const label=prefix==="BE"||prefix==="ME"?"New CBCS":prefix==="BT"||prefix==="MT"?"NEP":"Other / verify";
    counts[label]=(counts[label]||0)+1; return counts;
  }, {} as Record<string,number>), [sortedEnrollmentList]);
  const visibleRows = useMemo(() => rows
    .filter(row => !filter.trim() || [row.enrollment,row.branch,row.scheme,row.admissionMode].some(value => String(value||"").toLowerCase().includes(filter.trim().toLowerCase())))
    .sort((a,b) => {
      const left=enrollmentSortParts(a.enrollment), right=enrollmentSortParts(b.enrollment);
      return left.scheme-right.scheme || left.prefix.localeCompare(right.prefix) || left.year-right.year ||
        left.branch.localeCompare(right.branch) || left.mode.localeCompare(right.mode) || left.serial-right.serial || a.enrollment.localeCompare(b.enrollment);
    }), [rows,filter]);

  const schemeOptions=[...new Set(rows.map(row=>row.scheme).filter(Boolean))].sort();
  const analyticsRows=rows.filter(row=>(analyticsScheme==="ALL"||row.scheme===analyticsScheme)&&(analyticsAdmission==="ALL"||(analyticsAdmission==="DSE"?/direct|dse/i.test(row.admissionMode):!/direct|dse/i.test(row.admissionMode))));
  const cgpaRows=rows.filter(row=>row.cgpa!==null&&Number.isFinite(row.cgpa));
  const cgpaCohorts=new Set(cgpaRows.map(row=>row.scheme+"|"+(/direct|dse/i.test(row.admissionMode)?"DSE":"REGULAR")));
  const averageCgpa=cgpaRows.length&&cgpaCohorts.size===1?cgpaRows.reduce((sum,row)=>sum+(row.cgpa||0),0)/cgpaRows.length:null;
  const branchStats = useMemo(() => {
    const groups = new Map<string, { count:number; sum:number; min:number; max:number }>();
    analyticsRows.forEach(row=>{
      const sem=row.semesters.find(item=>item.semester===analyticsSemester);
      const value=analyticsMetric==="sgpa"?sem?.sgpa:sem?.cgpa;
      if(value===null||value===undefined||!Number.isFinite(value)) return;
      const current=groups.get(row.branch)||{count:0,sum:0,min:10,max:0};
      current.count++; current.sum+=value; current.min=Math.min(current.min,value); current.max=Math.max(current.max,value);
      groups.set(row.branch,current);
    });
    return [...groups.entries()].map(([branch,value])=>({branch,...value,average:value.sum/value.count})).sort((a,b)=>b.average-a.average);
  },[analyticsRows,analyticsSemester,analyticsMetric]);
  const selectedSemesterRows=analyticsRows.map(row=>({row,sem:row.semesters.find(item=>item.semester===analyticsSemester)}));
  const selectedSemesterValues=selectedSemesterRows.map(({sem})=>analyticsMetric==="sgpa"?sem?.sgpa:sem?.cgpa).filter((value):value is number=>value!==null&&value!==undefined&&Number.isFinite(value));
  const selectedSemesterStats=selectedSemesterValues.length?{average:selectedSemesterValues.reduce((sum,value)=>sum+value,0)/selectedSemesterValues.length,min:Math.min(...selectedSemesterValues),max:Math.max(...selectedSemesterValues),count:selectedSemesterValues.length}:null;
  const batchScoreValues=analyticsRows.flatMap(row=>row.semesters.filter(sem=>sem.status==="VERIFIED").map(sem=>analyticsMetric==="sgpa"?sem.sgpa:sem.cgpa)).filter((value):value is number=>value!==null&&value!==undefined&&Number.isFinite(value));
  const batchScoreStats=batchScoreValues.length?{average:batchScoreValues.reduce((sum,value)=>sum+value,0)/batchScoreValues.length,min:Math.min(...batchScoreValues),max:Math.max(...batchScoreValues),count:batchScoreValues.length}:null;
  const intraRows=analyticsRows.map(row=>{const sem=row.semesters.find(item=>item.semester===analyticsSemester);const value=analyticsMetric==="sgpa"?sem?.sgpa:sem?.cgpa;const branchAverage=branchStats.find(item=>item.branch===row.branch)?.average;return {enrollment:row.enrollment,branch:row.branch,value,branchAverage,delta:value===null||value===undefined||branchAverage===undefined?null:value-branchAverage};}).filter((item):item is {enrollment:string;branch:string;value:number;branchAverage:number;delta:number}=>item.value!==null&&item.value!==undefined&&item.branchAverage!==undefined&&item.delta!==null).sort((a,b)=>a.branch.localeCompare(b.branch)||b.value-a.value);
  const studentScoreRows=selectedSemesterRows.map(({row,sem})=>({enrollment:row.enrollment,branch:row.branch,scheme:row.scheme,admissionMode:row.admissionMode,sgpa:sem?.sgpa??null,cgpa:sem?.cgpa??null,credits:sem?.credits??0,subjects:sem?.subjects??0,status:sem?.status??"NOT AUDITED",issue:sem?.error||row.errors.find(detail=>detail.includes("Semester "+analyticsSemester))||""})).sort((a,b)=>(b.sgpa??-1)-(a.sgpa??-1)||a.enrollment.localeCompare(b.enrollment));
  const exportAnalyticsCsv=()=>{const lines=[["Enrollment","Branch","Scheme","Admission type","Semester","SGPA","CGPA","Credits","Subjects","Status","Issue"]];studentScoreRows.forEach(item=>lines.push([item.enrollment,item.branch,item.scheme,item.admissionMode,String(analyticsSemester),item.sgpa===null?"":item.sgpa.toFixed(3),item.cgpa===null?"":item.cgpa.toFixed(3),String(item.credits),String(item.subjects),item.status,item.issue]));const blob=new Blob([lines.map(line=>line.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="gradly-ultra-student-analytics-semester-"+analyticsSemester+".csv";anchor.click();URL.revokeObjectURL(url);};
  const exportFindingsCsv=()=>{const lines=[["Subject","Course code","Finding","Semesters","Occurrences","Branches","Affected enrollments","Source document"]];globalFindings.forEach(item=>lines.push([item.name,item.code,item.kind,item.semesters.join("; "),String(item.occurrences),item.branchNames.join("; "),item.enrollments.join("; "),item.document]));const blob=new Blob([lines.map(line=>line.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="gradly-ultra-subject-findings.csv";anchor.click();URL.revokeObjectURL(url);};
  const issueMap=new Map<string,{enrollment:string;branch:string;semester:string;severity:string;detail:string}>();
  rows.forEach(student=>{
    student.errors.forEach(raw=>{
      const match=raw.match(/^Semester\s+(\d+)\s*:\s*(.*)$/i);
      const semester=match?.[1]||"—";
      const detail=match?.[2]||raw;
      const severity=/failed|incomplete|parse|could not/i.test(detail)?"HIGH":"MEDIUM";
      issueMap.set([student.enrollment,semester,detail.toLowerCase()].join("|"),{enrollment:student.enrollment,branch:student.branch,semester,severity,detail});
    });
    student.semesters.filter(sem=>Boolean(sem.error)).forEach(sem=>{
      const detail=sem.error||sem.status;
      const key=[student.enrollment,String(sem.semester),detail.toLowerCase()].join("|");
      const severity=sem.status==="MANUAL ONLY"?"INFO":/failed|incomplete|parse|could not/i.test(detail)?"HIGH":"MEDIUM";
      if(!issueMap.has(key)) issueMap.set(key,{enrollment:student.enrollment,branch:student.branch,semester:String(sem.semester),severity,detail});
    });
  });
  const issueRows=[...issueMap.values()];
  const issueCount = issueRows.length + rows.reduce((sum,row)=>sum+row.findings.length,0);

  return <main className="tester-ultra-page">
    <header className="tester-ultra-header"><button type="button" onClick={()=>navigate("/tester/mode")}><ArrowLeft size={17}/> Testing modes</button><div className="tester-ultra-brand"><span>G</span><div>GRADLY <small>ULTRA TESTING</small></div></div><div className="tester-ultra-user"><span><i/> {testerId}</span><button type="button" onClick={()=>{localStorage.removeItem("gradly_tester_access_token");sessionStorage.removeItem("gradly_tester_access_token");navigate("/tester/login");}}>Sign out</button></div></header>
    <section className="tester-ultra-main">
      <div className="tester-ultra-hero"><div><span className="tester-ultra-eyebrow"><FlaskConical size={14}/> ACADEMIC QUALITY & ASSURANCE</span><h1>One batch. A complete academic audit.</h1><p>Validate up to 100 enrollments against official result PDFs, the curriculum catalogue and Gradly's academic calculations. Every scan is read-only.</p></div><div className="tester-ultra-hero-mark"><BarChart3 size={42}/><strong>100</strong><small>ENROLLMENTS / BATCH</small></div></div>

      <section className="tester-ultra-setup">
        <div className="tester-ultra-section-heading"><div><span>01 · CONFIGURE YOUR BATCH</span><h2>Start with your student list</h2></div><span className="tester-ultra-limit">MAX 100 UNIQUE ENROLLMENTS</span></div>

        <div className="tester-ultra-setup-grid">
          <div className="tester-ultra-field"><label htmlFor="ultra-institution">INSTITUTION / UNIVERSITY</label><div className="tester-ultra-search"><Search size={16}/><input id="ultra-institution" value={institutionQuery} onChange={event=>{setInstitutionQuery(event.target.value);setInstitution(null);}} placeholder="Search institution…"/></div>{searchingInstitutions&&<small>Searching institutions…</small>}{!institution&&institutions.length>0&&<div className="tester-ultra-institution-results">{institutions.slice(0,8).map(item=><button type="button" key={item.id} onClick={()=>{setInstitution(item);setInstitutionQuery(item.name);setInstitutions([]);}}>{item.name}</button>)}</div>}{institution&&<div className="tester-ultra-selected-institution"><span>{institution.name}</span><button type="button" onClick={()=>{setInstitution(null);setInstitutionQuery("");}}>Change</button></div>}{institution&&!supportedInstitution&&<small className="tester-ultra-inline-warning">Official result-PDF auditing is currently connected to GECA only. Choose Government College of Engineering, Chhatrapati Sambhajinagar to run this batch.</small>}{institution&&supportedInstitution&&<small className="tester-ultra-muted">GECA official result archive connected · read-only scanning</small>}</div>
          <div className="tester-ultra-field"><label htmlFor="ultra-enrollments">ENROLLMENT NUMBERS · ONE PER LINE</label><textarea id="ultra-enrollments" value={enrollmentText} onChange={(event:ChangeEvent<HTMLTextAreaElement>)=>setEnrollmentText(event.target.value)} placeholder={"BE23S01F001\nBE23S01F002\nBT25S01F001"} rows={6}/><div className="tester-ultra-input-footer"><span>{enrollmentList.length} / 100 unique enrollments</span><span>{duplicateCount>0?duplicateCount+" duplicates will be removed automatically":"Duplicates are automatically removed"}</span><button type="button" className="tester-ultra-inline-clear" onClick={()=>{abortRef.current?.abort();setRunning(false);setEnrollmentText("");setGeneratedEnrollments([]);setRows([]);setNotice("All enrollment numbers and previous audit results were cleared.");setError("");setGeneratorError("");}}>Clear list ×</button></div><small className="tester-ultra-muted">Paste official IDs here, or generate synthetic sample IDs below for parser and workflow testing. Generated IDs are illustrative only and are not real student records.</small>
            <div className="tester-ultra-generator">
              <div className="tester-ultra-generator-heading"><div><span>SAMPLE DATA BUILDER</span><strong>Generate enrollment list</strong><small>Uses the enrollment identity format: programme + admission year + mode + branch + fixed F + serial</small></div><WandSparkles size={20}/></div>
              <div className="tester-ultra-generator-fields">
                <label>PROGRAMME<select value={sampleProgramme} onChange={event=>{const next=event.target.value as "BE"|"BT"|"MT"|"MC";setSampleProgramme(next);setSampleAdmissionMode("F");setSampleBranch(next==="MT"?"09":next==="MC"?"":"01");}}><option value="BE">BE · New CBCS</option><option value="BT">B.Tech · NEP</option><option value="MT">M.Tech · NEP</option><option value="MC">MCA · NEP</option></select></label>
                <label>ADMISSION YEAR<input type="number" min="2000" max="2099" value={sampleAdmissionYear} onChange={event=>setSampleAdmissionYear(event.target.value)}/></label>
                {sampleProgramme==="MC"||sampleProgramme==="MT"?<label>ADMISSION MODE<input value="Regular (F) · Postgraduate" readOnly/></label>:<label>ADMISSION MODE<select value={sampleAdmissionMode} onChange={event=>setSampleAdmissionMode(event.target.value as "F"|"S")}><option value="F">Regular (F)</option><option value="S">Direct Second Year / DSE (S)</option></select></label>}
                {sampleProgramme==="MC"?<label>MCA BRANCH CODE<input value={sampleBranch} onChange={event=>setSampleBranch(event.target.value.replace(/[^0-9]/g,"").slice(0,2))} inputMode="numeric" maxLength={2} placeholder="2-digit code from enrollment"/><small>Use the exact two-digit code printed in a real MCA enrollment number.</small></label>:sampleProgramme==="MT"?<label>M.TECH SPECIALIZATION<select value={sampleBranch} onChange={event=>setSampleBranch(event.target.value)}><option value="09">Structural Engineering · 09</option><option value="08">Water Resources Engineering · 08</option><option value="16">Geotechnical Engineering · 16</option><option value="15">Electrical Machines and Drives · 15</option><option value="12">Electrical Power Systems · 12</option><option value="13">Electronics & Telecommunication · 13</option><option value="05">Computer Science & Engineering · 05</option></select></label>:<label>BRANCH<select value={sampleBranch} onChange={event=>setSampleBranch(event.target.value)}><option value="01">Civil Engineering · 01</option><option value="02">Mechanical Engineering · 02</option><option value="03">Electrical Engineering · 03</option><option value="04">Electronics & Telecommunication · 04</option><option value="05">Computer Science & Engineering · 05</option><option value="06">Information Technology · 06</option></select></label>}
                <label>STARTING SERIAL<input type="number" min="1" max="999" value={sampleSerialStart} onChange={event=>setSampleSerialStart(event.target.value)}/></label>
                <label>NUMBER TO GENERATE<input type="number" min="1" max="100" value={sampleCount} onChange={event=>setSampleCount(event.target.value)}/></label>
              </div>
              <div className="tester-ultra-generator-actions"><button type="button" onClick={generateSampleEnrollments}><WandSparkles size={14}/> Generate sample list</button><span>Max 100 per batch · serials 001–999</span></div>
              {generatorError&&<p className="tester-ultra-error" role="alert">{generatorError}</p>}
              {generatedEnrollments.length>0&&<div className="tester-ultra-generator-preview"><div><strong>{generatedEnrollments.length} sample IDs ready</strong><button type="button" onClick={importGeneratedEnrollments} >Import into batch <span>→</span></button></div><textarea readOnly rows={Math.min(5,generatedEnrollments.length)} value={generatedEnrollments.join("\n")}/><small>These IDs follow the selected programme, year, admission mode and branch. They are synthetic and may not exist in GECA's official result archive.</small></div>}
            </div><div className="tester-ultra-sort-summary"><span>Auto-sort follows enrollment identity rules</span>{Object.entries(enrollmentSchemeCounts).map(([label,count])=><b key={label}>{label} <i>{count}</i></b>)}</div><button className="tester-ultra-sort-button" type="button" onClick={()=>setEnrollmentText(sortedEnrollmentList.join("\n"))} disabled={!enrollmentList.length}>Sort enrollment list · New CBCS → NEP → Other</button></div>
        </div>
        {enrollmentList.length>100&&<p className="tester-ultra-error">This batch contains more than 100 unique enrollment numbers. Split it into smaller batches.</p>}
        <div className="tester-ultra-config-grid">
          <div className="tester-ultra-field"><label>EXAMINATION SESSIONS</label><div className="tester-ultra-session-actions"><button type="button" onClick={()=>setSelectedSessions([])} disabled={!selectedSessions.length}>Clear selection</button><span>{selectedSessions.length} selected · choose sessions individually</span></div><div className="tester-ultra-session-list">{loadingSessions?<span className="tester-ultra-muted">Loading official GECA sessions…</span>:sessions.length?sessions.map(session=><label key={session.id} className="tester-ultra-check"><input type="checkbox" checked={selectedSessions.includes(session.id)} onChange={()=>toggleSession(session.id)}/><span>{session.title}</span></label>):<span className="tester-ultra-muted">No examination sessions loaded.</span>}</div><button className="tester-ultra-text-button" type="button" onClick={()=>{setLoadingSessions(true);fetchJson(API+"/api/tester/results/sessions").then(body=>{const loaded=normalizeResultSessions(body.sessions);setSessions(loaded);}).catch(reason=>setError(reason instanceof Error?reason.message:"Unable to refresh sessions.")).finally(()=>setLoadingSessions(false));}}><RefreshCw size={13}/> Refresh sessions</button></div>
          <div className="tester-ultra-field"><label>SEMESTERS TO AUDIT</label><div className="tester-ultra-semester-grid">{Array.from({length:enrollmentList.length>0&&enrollmentList.every(value=>/^(?:MC|MT)/.test(value))?4:8},(_,index)=>index+1).map(semester=>{const parsed=enrollmentList.map(value=>/^(BE|BT)(\d{2})([FS])(\d{2})F(\d{3})$/.exec(value)).filter(Boolean) as RegExpExecArray[];const onlyDse=parsed.length>0&&parsed.length===enrollmentList.length&&parsed.every(match=>match[3]==="S");const unavailable=onlyDse&&semester<3;return <label key={semester} className={"tester-ultra-semester "+(selectedSemesters.includes(semester)?"selected":"")+(unavailable?" disabled":"")}><input type="checkbox" checked={selectedSemesters.includes(semester)} disabled={unavailable} onChange={()=>toggleSemester(semester)}/><span>SEM {semester}</span></label>;})}</div><small>No semesters are preselected. Semester 1–2 are disabled when every recognized BE/BT enrollment in the pasted list is DSE; mixed or unrecognized lists remain selectable and the audit applies each student’s actual entry semester.</small></div>
        </div>
        {error&&<p className="tester-ultra-error" role="alert">{error}</p>}
        <div className="tester-ultra-actions">{running?<button className="tester-ultra-stop" type="button" onClick={stopAudit}><Square size={15}/> Stop batch</button>:<button className="tester-ultra-run" type="button" onClick={()=>void runAudit()} disabled={!institution||!supportedInstitution||!enrollmentList.length||enrollmentList.length>100||!selectedSessions.length||!selectedSemesters.length||!token}><Play size={16}/> Run Ultra Audit <span>→</span></button>}<span><ShieldCheck size={14}/> Read-only · No student records or catalogue entries are changed</span></div>
      </section>

      {(rows.length>0)&&<>
        <section className="tester-ultra-results">
          <div className="tester-ultra-section-heading"><div><span>02 · BATCH PERFORMANCE</span><h2>Audit overview</h2></div><div className="tester-ultra-result-actions"><span>{completedCount} / {rows.length} processed</span><button type="button" onClick={exportCsv} disabled={!rows.length}><Download size={15}/> Student CSV</button><button type="button" onClick={exportFindingsCsv} disabled={!globalFindings.length}><Download size={15}/> Findings CSV</button></div></div>
          <div className="tester-ultra-audit-clear-row"><span>Clear the enrollment numbers and reports from this audit batch.</span><button type="button" onClick={()=>{abortRef.current?.abort();setRunning(false);setEnrollmentText("");setGeneratedEnrollments([]);setRows([]);setFilter("");setNotice("Audit enrollment numbers and results were cleared.");setError("");setGeneratorError("");}}><span aria-hidden="true">×</span> Clear audit enrollments</button></div>
          <div className="tester-ultra-progress"><i style={{width:(rows.length?completedCount/rows.length*100:0)+"%"}}/></div>
          <div className="tester-ultra-metrics">
            <article><span>ENROLLMENTS</span><strong>{rows.length}</strong><small>In this batch</small></article>
            <article><span>COMPLETED</span><strong className="good">{successfulCount}</strong><small>All selected semesters verified</small></article>
            <article><span>AVERAGE CGPA</span><strong>{averageCgpa===null?"—":averageCgpa.toFixed(2)}</strong><small>{averageCgpa===null?"Select a single scheme and admission cohort":"Verified students in one cohort"}</small></article>
            <article><span>NEW / MISMATCHED</span><strong>{globalFindings.length}</strong><small>Unique subject findings</small></article>
            <article><span>FAILED / PARTIAL</span><strong className="bad">{failedCount} / {rows.filter(row=>row.status==="partial").length}</strong><small>{issueCount} findings and errors</small></article>
          </div>
          <nav className="tester-ultra-tabs"><button className={activeTab==="students"?"active":""} onClick={()=>setActiveTab("students")}><Users size={15}/> Student reports</button><button className={activeTab==="subjects"?"active":""} onClick={()=>setActiveTab("subjects")}><BookOpen size={15}/> Global subject registry <b>{globalFindings.length}</b></button><button className={activeTab==="branches"?"active":""} onClick={()=>setActiveTab("branches")}><BarChart3 size={15}/> Branch analytics</button><button className={activeTab==="issues"?"active":""} onClick={()=>setActiveTab("issues")}><Activity size={15}/> System issues <b>{issueRows.length}</b></button></nav>
          {activeTab==="students"&&<div className="tester-ultra-table-wrap"><div className="tester-ultra-table-toolbar"><strong>Individual enrollment reports</strong><div><Search size={14}/><input value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Search enrollment, branch, scheme or admission type"/></div></div><table className="tester-ultra-table"><thead><tr><th>ENROLLMENT</th><th>BRANCH / SCHEME</th><th>SEMESTER SGPA</th><th>CGPA</th><th>FINDINGS</th><th>STATUS</th><th>REPORT</th></tr></thead><tbody>{visibleRows.map(row=><tr key={row.enrollment}><td><strong>{row.enrollment}</strong><small>{row.admissionMode}</small></td><td>{row.branch||"—"}<small>{row.scheme}</small></td><td><div className="tester-ultra-semester-pills">{row.semesters.map(sem=><span key={sem.semester} className={sem.failedRemark?"failed-remark":""} title={sem.status+(sem.failedRemark?" · FAILED REMARK (F/AB/D grade)":"")+" · CGPA "+(sem.cgpa===null?"—":sem.cgpa.toFixed(2))}>S{sem.semester}: {sem.sgpa===null?"—":sem.sgpa.toFixed(2)}{sem.failedRemark?" · FAIL":""}</span>)}</div></td><td><strong>{row.cgpa===null?"—":row.cgpa.toFixed(2)}</strong></td><td><span className="tester-ultra-finding-count">{row.semesters.reduce((total, sem) => total + sem.subjects, 0)} subjects · {row.findings.length} findings · {row.errors.length} errors</span>{row.errors.slice(0,1).map((item,index)=><small key={index} className="tester-ultra-row-error">{item}</small>)}</td><td><span className={"tester-ultra-status "+row.status}>{row.status}</span></td><td><details className="tester-ultra-row-details"><summary>Open report</summary><div>{row.semesters.map(sem=><p key={sem.semester}><b>Semester {sem.semester}</b> · SGPA {sem.sgpa===null?"—":sem.sgpa.toFixed(3)} · CGPA {sem.cgpa===null?"—":sem.cgpa.toFixed(3)} · {sem.credits} credits · {sem.status}{sem.failedRemark?" · FAILED REMARK (F/AB/D grade)":""}{sem.error?" — "+sem.error:""}</p>)}{row.findings.map((item,index)=><p key={item.code+item.kind+index}><b>{item.kind.replace("_"," ")}</b> · {item.name} ({item.code})</p>)}{row.errors.map((item,index)=><p className="tester-ultra-row-error" key={index}>{item}</p>)}</div></details></td></tr>)}</tbody></table>{visibleRows.length===0&&<p className="tester-ultra-empty">No enrollments match this search.</p>}</div>}
          {activeTab==="subjects"&&<div className="tester-ultra-table-wrap"><div className="tester-ultra-table-toolbar"><strong>Consolidated new subjects & mismatches</strong><span>{globalFindings.length} unique findings · duplicates merged</span></div><table className="tester-ultra-table"><thead><tr><th>SUBJECT / CODE</th><th>FINDING</th><th>SEMESTERS</th><th>OCCURRENCES</th><th>BRANCHES</th><th>AFFECTED ENROLLMENTS</th></tr></thead><tbody>{globalFindings.map((item,index)=><tr key={item.code+item.kind+item.semesters.join("-")+index}><td><strong>{item.name}</strong><small>{item.code}</small></td><td><span className={"tester-ultra-finding-kind "+item.kind.toLowerCase()}>{item.kind.replace("_"," ")}</span></td><td>{item.semesters.join(", ")}</td><td><strong>{item.occurrences}</strong></td><td>{item.branchNames.join(", ")||"—"}</td><td><small>{item.enrollments.join(", ")}</small></td></tr>)}</tbody></table>{globalFindings.length===0&&<p className="tester-ultra-empty">No new subjects or catalogue mismatches have been discovered in this batch.</p>}</div>}
          {activeTab==="issues"&&<div className="tester-ultra-table-wrap"><div className="tester-ultra-table-toolbar"><strong>System issue explorer</strong><span>{issueRows.length} diagnostics across {new Set(issueRows.map(item=>item.enrollment)).size} enrollments</span></div><table className="tester-ultra-table"><thead><tr><th>SEVERITY</th><th>ENROLLMENT</th><th>BRANCH</th><th>SEMESTER</th><th>DIAGNOSTIC</th></tr></thead><tbody>{issueRows.map((item,index)=><tr key={item.enrollment+item.semester+index}><td><span className={"tester-ultra-severity "+item.severity.toLowerCase()}>{item.severity}</span></td><td><strong>{item.enrollment}</strong></td><td>{item.branch||"—"}</td><td>{item.semester}</td><td>{item.detail}</td></tr>)}</tbody></table>{!issueRows.length&&<p className="tester-ultra-empty">No system issues were reported for this batch.</p>}</div>}
          {activeTab==="branches"&&<div className="tester-ultra-branch-panel"><div className="tester-ultra-analytics-controls"><label>SCHEME<select value={analyticsScheme} onChange={event=>setAnalyticsScheme(event.target.value)}><option value="ALL">All schemes</option>{schemeOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>ADMISSION TYPE<select value={analyticsAdmission} onChange={event=>setAnalyticsAdmission(event.target.value)}><option value="ALL">Regular + DSE</option><option value="REGULAR">Regular only</option><option value="DSE">DSE only</option></select></label><label>SEMESTER<select value={analyticsSemester} onChange={event=>setAnalyticsSemester(Number(event.target.value))}>{Array.from({length:8},(_,i)=>i+1).map(value=><option key={value} value={value}>Semester {value}</option>)}</select></label><label>METRIC<select value={analyticsMetric} onChange={event=>setAnalyticsMetric(event.target.value as "sgpa"|"cgpa")}><option value="sgpa">SGPA</option><option value="cgpa">Cumulative CGPA</option></select></label></div><div className="tester-ultra-table-toolbar"><strong>Batch-wide performance · all audited semesters</strong><span>{analyticsMetric.toUpperCase()} · verified results only</span></div><div className="tester-ultra-analytics-summary">{batchScoreStats?<><div><small>OVERALL AVERAGE</small><strong>{batchScoreStats.average.toFixed(2)}</strong></div><div><small>OVERALL MINIMUM</small><strong>{batchScoreStats.min.toFixed(2)}</strong></div><div><small>OVERALL MAXIMUM</small><strong>{batchScoreStats.max.toFixed(2)}</strong></div><div><small>VERIFIED SEMESTER RECORDS</small><strong>{batchScoreStats.count}</strong></div></>:<p className="tester-ultra-empty">No verified {analyticsMetric.toUpperCase()} values in this batch yet.</p>}</div><div className="tester-ultra-table-toolbar"><strong>Selected semester · {analyticsSemester}</strong><span>{analyticsMetric.toUpperCase()} distribution for the current filters</span></div><div className="tester-ultra-analytics-summary">{selectedSemesterStats?<><div><small>AVERAGE</small><strong>{selectedSemesterStats.average.toFixed(2)}</strong></div><div><small>MINIMUM</small><strong>{selectedSemesterStats.min.toFixed(2)}</strong></div><div><small>MAXIMUM</small><strong>{selectedSemesterStats.max.toFixed(2)}</strong></div><div><small>VALID STUDENTS</small><strong>{selectedSemesterStats.count}</strong></div></>:<p className="tester-ultra-empty">No verified {analyticsMetric.toUpperCase()} values for Semester {analyticsSemester} yet.</p>}</div><div className="tester-ultra-table-toolbar"><strong>Inter-branch comparison · {analyticsMetric.toUpperCase()}</strong><span>Branch average, minimum and maximum</span></div>{branchStats.length?branchStats.map(item=><div className="tester-ultra-branch-row" key={item.branch}><div><strong>{item.branch}</strong><small>{item.count} students · min {item.min.toFixed(2)} · max {item.max.toFixed(2)}</small></div><div className="tester-ultra-branch-track"><i style={{width:(item.average*10)+"%"}}/></div><b>{item.average.toFixed(2)}</b></div>):<p className="tester-ultra-empty">Branch analytics will appear as verified semester results arrive.</p>}<div className="tester-ultra-table-toolbar"><strong>All enrollment scorecards · Semester {analyticsSemester}</strong><button type="button" onClick={exportAnalyticsCsv}><Download size={14}/> Export student analytics CSV</button></div><div className="tester-ultra-table-wrap"><table className="tester-ultra-table"><thead><tr><th>ENROLLMENT</th><th>BRANCH / SCHEME</th><th>ADMISSION</th><th>SGPA</th><th>CGPA</th><th>CREDITS</th><th>SUBJECTS</th><th>STATUS / ISSUE</th></tr></thead><tbody>{studentScoreRows.map(item=><tr key={item.enrollment}><td><strong>{item.enrollment}</strong></td><td>{item.branch}<small>{item.scheme}</small></td><td>{item.admissionMode}</td><td>{item.sgpa===null?"—":item.sgpa.toFixed(2)}</td><td>{item.cgpa===null?"—":item.cgpa.toFixed(2)}</td><td>{item.credits}</td><td>{item.subjects}</td><td><span className={"tester-ultra-status "+(item.status==="VERIFIED"?"completed":item.status==="NOT FOUND"?"failed":"partial")}>{item.status}</span>{item.issue&&<small className="tester-ultra-row-error">{item.issue}</small>}</td></tr>)}</tbody></table>{!studentScoreRows.length&&<p className="tester-ultra-empty">No enrollments are available for the selected filters.</p>}</div><div className="tester-ultra-table-toolbar"><strong>Intra-branch student benchmark</strong><span>Score compared with own branch average</span></div><div className="tester-ultra-table-wrap"><table className="tester-ultra-table"><thead><tr><th>ENROLLMENT</th><th>BRANCH</th><th>{analyticsMetric.toUpperCase()}</th><th>BRANCH AVERAGE</th><th>DIFFERENCE</th></tr></thead><tbody>{intraRows.map(item=><tr key={item.enrollment}><td><strong>{item.enrollment}</strong></td><td>{item.branch}</td><td>{item.value.toFixed(2)}</td><td>{item.branchAverage.toFixed(2)}</td><td><strong className={item.delta>=0?"good":"bad"}>{item.delta>=0?"+":""}{item.delta.toFixed(2)}</strong></td></tr>)}</tbody></table>{!intraRows.length&&<p className="tester-ultra-empty">No students have verified scores for this cohort and semester.</p>}</div><p className="tester-ultra-branch-note">Intra-branch analysis compares each student with the average, minimum and maximum for their own branch. Inter-branch analysis compares branch averages for the selected semester and metric. Only verified results are included; missing results are never treated as zero.</p></div>}
        </section>
      </>}
      {notice&&<p className="tester-ultra-notice" role="status">{notice}</p>}
      {createPortal(<div className="tester-ultra-clear-bar" role="region" aria-label="Batch actions"><div className="tester-ultra-clear-summary"><strong>{enrollmentList.length} <span>enrollments</span></strong><i/> <span>{rows.length} audit results</span></div><button type="button" className="tester-ultra-clear-bottom" onClick={()=>{abortRef.current?.abort();setRunning(false);setEnrollmentText("");setGeneratedEnrollments([]);setRows([]);setNotice("All enrollment numbers and previous audit results were cleared.");setError("");setGeneratorError("");}}><span aria-hidden="true">×</span> Clear all numbers</button></div>, document.body)}
      <footer className="tester-ultra-footer">Gradly Ultra Testing · Official result PDFs are inspected read-only · Student accounts and production academic records remain untouched.</footer>
    </section>
  </main>;
}
