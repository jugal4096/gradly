import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, BarChart3, BookOpen, Download, FlaskConical, Play, RefreshCw, Search, ShieldCheck, Square, Users } from "lucide-react";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";

const API = API_BASE_URL.replace(/\/+$/, "");
const GRADE_POINTS: Record<string, number> = { "A++": 10, "A+": 9, A: 8, "B+": 7, B: 6, "C+": 5, C: 4, D: 0 };
type Institution = { id: string; name: string; branches?: unknown[] };
type Preview = { recognized: boolean; requiresConfirmation?: boolean; message?: string; programme?: string; programId?: string; branch?: string; branchId?: string; curriculumId?: string; curriculumName?: string; scheme?: string; admissionYear?: number; admissionMode?: string; entrySemester?: number; totalSemesters?: number };
type ResultSession = { id: string; title: string; url: string };
type CatalogueSubject = { code?: string; name?: string; courseCode?: string; courseName?: string; credits?: number | string; semesterNumber?: number | string; courseType?: string };
type ResultGrade = { courseCode: string; grade: string; courseName?: string; credits?: number };
type ResultDocument = { title: string; url: string; semester: number | null; grades: ResultGrade[] };
type SubjectFinding = { code: string; name: string; grade: string; credits: number | null; kind: "NEW" | "NAME_MISMATCH" | "CREDIT_MISMATCH" | "CODE_MISMATCH"; semester: number; document: string };
type SemesterAudit = { semester: number; sgpa: number | null; cgpa: number | null; credits: number; subjects: number; status: string; findings: SubjectFinding[]; error?: string };
type StudentAudit = { enrollment: string; status: "queued" | "processing" | "completed" | "partial" | "failed"; branch: string; scheme: string; admissionMode: string; curriculumId: string; semesters: SemesterAudit[]; errors: string[]; findings: SubjectFinding[]; cgpa: number | null };
type GlobalFinding = Omit<SubjectFinding, "semester"> & { semesters: number[]; occurrences: number; enrollments: string[]; branchNames: string[] };
const normalizeCode = (value: unknown) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeName = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const uniqueEnrollments = (value: string) => [...new Set(value.split(/[\s,;]+/).map(item => item.trim().toUpperCase()).filter(Boolean))];
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

export default function TesterUltraTesting() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [testerId, setTesterId] = useState("Tester");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [enrollmentText, setEnrollmentText] = useState("");
  const [sessions, setSessions] = useState<ResultSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([1,2,3,4,5,6,7,8]);
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
      .then(body => setSessions(Array.isArray(body.sessions) ? body.sessions : []))
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
        setInstitutions(Array.isArray(body.data) ? body.data : []);
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Institution search failed."); }
      finally { if (!controller.signal.aborted) setSearchingInstitutions(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [institutionQuery, institution]);

  const enrollmentList = useMemo(() => uniqueEnrollments(enrollmentText), [enrollmentText]);
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
    const response = await fetch(url, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "The audit request failed.");
    return body;
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
          const applicableSemesters = [...selectedSemesters].filter(value=>value>=entrySemester).sort((a,b)=>a-b);
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
                if (match) { found = match; if (semesterError) allErrors.push("Semester " + semester + ": " + semesterError); break; }
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
              allErrors.push("Semester " + semester + ": central discovered-subject catalogue could not be checked; curriculum-only comparison was used.");
            }
            const findings: SubjectFinding[] = [];
            let weighted = 0, credits = 0, incomplete = false;
            for (const resultRow of found.grades) {
              const code = normalizeCode(resultRow.courseCode);
              if (!code) continue;
              const curriculumCodeRow = catalogue.find(item=>normalizeCode(item.code)===code);
              const sharedCodeRow = sharedRegistry.find(item=>normalizeCode(item.code ?? item.courseCode)===code);
              const nameMatchedRow = !curriculumCodeRow && !sharedCodeRow && resultRow.courseName ? catalogue.find(item=>normalizeName(item.name)===normalizeName(resultRow.courseName)) : undefined;
              const catalogueRow = curriculumCodeRow || sharedCodeRow || nameMatchedRow;
              const rowCredits = Number(resultRow.credits ?? catalogueRow?.credits ?? 0);
              const grade = String(resultRow.grade || "").trim().toUpperCase();
              if (!catalogueRow) findings.push({ code:resultRow.courseCode, name:resultRow.courseName || resultRow.courseCode, grade, credits:rowCredits>0?rowCredits:null, kind:"NEW", semester, document:found.title });
              else {
                if (nameMatchedRow) findings.push({ code:resultRow.courseCode, name:resultRow.courseName || String(nameMatchedRow.name || resultRow.courseCode), grade, credits:rowCredits>0?rowCredits:null, kind:"CODE_MISMATCH", semester, document:found.title });
                if ((curriculumCodeRow || sharedCodeRow) && resultRow.courseName && (catalogueRow.name || catalogueRow.courseName) && normalizeName(resultRow.courseName)!==normalizeName(catalogueRow.name ?? catalogueRow.courseName)) findings.push({ code:resultRow.courseCode, name:resultRow.courseName, grade, credits:rowCredits>0?rowCredits:null, kind:"NAME_MISMATCH", semester, document:found.title });
                if (Number.isFinite(Number(resultRow.credits)) && Number(resultRow.credits)>0 && Number(catalogueRow.credits)>0 && Number(resultRow.credits)!==Number(catalogueRow.credits)) findings.push({ code:resultRow.courseCode, name:resultRow.courseName || catalogueRow.name || catalogueRow.courseName || resultRow.courseCode, grade, credits:rowCredits, kind:"CREDIT_MISMATCH", semester, document:found.title });
                if (curriculumCodeRow && sharedCodeRow && Number(curriculumCodeRow.credits)>0 && Number(sharedCodeRow.credits)>0 && Number(curriculumCodeRow.credits)!==Number(sharedCodeRow.credits)) findings.push({ code:resultRow.courseCode, name:String(curriculumCodeRow.name || resultRow.courseName || resultRow.courseCode), grade, credits:Number(sharedCodeRow.credits), kind:"CREDIT_MISMATCH", semester, document:found.title });
              }
              const points = GRADE_POINTS[grade];
              if (!rowCredits || !Number.isFinite(rowCredits) || rowCredits<=0 || points===undefined) { incomplete=true; continue; }
              credits += rowCredits; weighted += rowCredits*points;
            }
            const sgpa = !incomplete && credits>0 ? weighted/credits : null;
            if (sgpa!==null) { cumulativeWeighted+=weighted; cumulativeCredits+=credits; } else cumulativeComplete=false;
            const cgpa = cumulativeComplete && cumulativeCredits>0 ? cumulativeWeighted/cumulativeCredits : null;
            allFindings.push(...findings);
            semesterAudits.push({ semester, sgpa, cgpa, credits, subjects:found.grades.length, status:sgpa===null?"INCOMPLETE":"VERIFIED", findings, error:sgpa===null?"At least one grade or credit could not be mapped confidently. SGPA is withheld rather than estimated.":undefined });
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
      await Promise.all(Array.from({length:Math.min(3,enrollmentList.length)},()=>worker()));
      if (controller.signal.aborted) { setRows(current=>current.map(row=>row.status==="processing"?{...row,status:"queued"}:row)); setNotice("Batch stopped. Completed student reports have been retained in this workspace; unprocessed enrollments remain queued."); }
      else setNotice("Batch audit finished. Review incomplete records and the consolidated discovery registry below.");
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
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
  const selectedSemesterValues=analyticsRows.map(row=>{const sem=row.semesters.find(item=>item.semester===analyticsSemester);return analyticsMetric==="sgpa"?sem?.sgpa:sem?.cgpa;}).filter((value):value is number=>value!==null&&value!==undefined&&Number.isFinite(value));
  const selectedSemesterStats=selectedSemesterValues.length?{average:selectedSemesterValues.reduce((sum,value)=>sum+value,0)/selectedSemesterValues.length,min:Math.min(...selectedSemesterValues),max:Math.max(...selectedSemesterValues),count:selectedSemesterValues.length}:null;
  const intraRows=analyticsRows.map(row=>{const sem=row.semesters.find(item=>item.semester===analyticsSemester);const value=analyticsMetric==="sgpa"?sem?.sgpa:sem?.cgpa;const branchAverage=branchStats.find(item=>item.branch===row.branch)?.average;return {enrollment:row.enrollment,branch:row.branch,value,branchAverage,delta:value===null||value===undefined||branchAverage===undefined?null:value-branchAverage};}).filter((item):item is {enrollment:string;branch:string;value:number;branchAverage:number;delta:number}=>item.value!==null&&item.value!==undefined&&item.branchAverage!==undefined&&item.delta!==null).sort((a,b)=>a.branch.localeCompare(b.branch)||b.value-a.value);
  const exportFindingsCsv=()=>{const lines=[["Subject","Course code","Finding","Semesters","Occurrences","Branches","Affected enrollments","Source document"]];globalFindings.forEach(item=>lines.push([item.name,item.code,item.kind,item.semesters.join("; "),String(item.occurrences),item.branchNames.join("; "),item.enrollments.join("; "),item.document]));const blob=new Blob([lines.map(line=>line.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="gradly-ultra-subject-findings.csv";anchor.click();URL.revokeObjectURL(url);};
  const issueCount = rows.reduce((sum,row)=>sum+row.errors.length+row.findings.length,0);
  const issueRows=rows.flatMap(student=>[...student.errors.map(detail=>({enrollment:student.enrollment,branch:student.branch,semester:"—",severity:/failed|incomplete|parse|could not/i.test(detail)?"HIGH":"MEDIUM",detail})),...student.semesters.filter(sem=>Boolean(sem.error)).map(sem=>({enrollment:student.enrollment,branch:student.branch,semester:String(sem.semester),severity:sem.status==="MANUAL ONLY"?"INFO":"MEDIUM",detail:sem.error||sem.status}))]);

  return <main className="tester-ultra-page">
    <header className="tester-ultra-header"><button type="button" onClick={()=>navigate("/tester/mode")}><ArrowLeft size={17}/> Testing modes</button><div className="tester-ultra-brand"><span>G</span><div>GRADLY <small>ULTRA TESTING</small></div></div><div className="tester-ultra-user"><span><i/> {testerId}</span><button type="button" onClick={()=>{localStorage.removeItem("gradly_tester_access_token");sessionStorage.removeItem("gradly_tester_access_token");navigate("/tester/login");}}>Sign out</button></div></header>
    <section className="tester-ultra-main">
      <div className="tester-ultra-hero"><div><span className="tester-ultra-eyebrow"><FlaskConical size={14}/> ACADEMIC QUALITY & ASSURANCE</span><h1>One batch. A complete academic audit.</h1><p>Validate up to 100 enrollments against official result PDFs, the curriculum catalogue and Gradly's academic calculations. Every scan is read-only.</p></div><div className="tester-ultra-hero-mark"><BarChart3 size={42}/><strong>100</strong><small>ENROLLMENTS / BATCH</small></div></div>

      <section className="tester-ultra-setup">
        <div className="tester-ultra-section-heading"><div><span>01 · CONFIGURE YOUR BATCH</span><h2>Start with your student list</h2></div><span className="tester-ultra-limit">MAX 100 UNIQUE ENROLLMENTS</span></div>
        <div className="tester-ultra-setup-grid">
          <div className="tester-ultra-field"><label htmlFor="ultra-institution">INSTITUTION / UNIVERSITY</label><div className="tester-ultra-search"><Search size={16}/><input id="ultra-institution" value={institutionQuery} onChange={event=>{setInstitutionQuery(event.target.value);setInstitution(null);}} placeholder="Search institution…"/></div>{searchingInstitutions&&<small>Searching institutions…</small>}{!institution&&institutions.length>0&&<div className="tester-ultra-institution-results">{institutions.slice(0,8).map(item=><button type="button" key={item.id} onClick={()=>{setInstitution(item);setInstitutionQuery(item.name);setInstitutions([]);}}>{item.name}</button>)}</div>}{institution&&<div className="tester-ultra-selected-institution"><span>{institution.name}</span><button type="button" onClick={()=>{setInstitution(null);setInstitutionQuery("");}}>Change</button></div>}{institution&&!supportedInstitution&&<small className="tester-ultra-inline-warning">Official result-PDF auditing is currently connected to GECA only. Choose Government College of Engineering, Chhatrapati Sambhajinagar to run this batch.</small>}{institution&&supportedInstitution&&<small className="tester-ultra-muted">GECA official result archive connected · read-only scanning</small>}</div>
          <div className="tester-ultra-field"><label htmlFor="ultra-enrollments">ENROLLMENT NUMBERS · ONE PER LINE</label><textarea id="ultra-enrollments" value={enrollmentText} onChange={(event:ChangeEvent<HTMLTextAreaElement>)=>setEnrollmentText(event.target.value)} placeholder={"BT23F001001\nBT23F001002\nBT23F001003"} rows={6}/><div className="tester-ultra-input-footer"><span>{enrollmentList.length} / 100 unique enrollments</span><span>{duplicateCount>0?duplicateCount+" duplicates will be removed automatically":"Duplicates are automatically removed"}</span></div></div>
        </div>
        {enrollmentList.length>100&&<p className="tester-ultra-error">This batch contains more than 100 unique enrollment numbers. Split it into smaller batches.</p>}
        <div className="tester-ultra-config-grid">
          <div className="tester-ultra-field"><label>EXAMINATION SESSIONS</label><div className="tester-ultra-session-actions"><button type="button" onClick={()=>setSelectedSessions(sessions.map(item=>item.id))} disabled={!sessions.length}>Select all</button><button type="button" onClick={()=>setSelectedSessions([])}>Clear</button><span>{selectedSessions.length} selected</span></div><div className="tester-ultra-session-list">{loadingSessions?<span className="tester-ultra-muted">Loading official GECA sessions…</span>:sessions.length?sessions.map(session=><label key={session.id} className="tester-ultra-check"><input type="checkbox" checked={selectedSessions.includes(session.id)} onChange={()=>toggleSession(session.id)}/><span>{session.title}</span></label>):<span className="tester-ultra-muted">No examination sessions loaded.</span>}</div><button className="tester-ultra-text-button" type="button" onClick={()=>{setLoadingSessions(true);fetchJson(API+"/api/tester/results/sessions").then(body=>setSessions(Array.isArray(body.sessions)?body.sessions:[])).catch(reason=>setError(reason instanceof Error?reason.message:"Unable to refresh sessions.")).finally(()=>setLoadingSessions(false));}}><RefreshCw size={13}/> Refresh sessions</button></div>
          <div className="tester-ultra-field"><label>SEMESTERS TO AUDIT</label><div className="tester-ultra-semester-grid">{Array.from({length:8},(_,index)=>index+1).map(semester=><label key={semester} className={"tester-ultra-semester "+(selectedSemesters.includes(semester)?"selected":"")}><input type="checkbox" checked={selectedSemesters.includes(semester)} onChange={()=>toggleSemester(semester)}/><span>SEM {semester}</span></label>)}</div><small>Semesters with no official result in the selected sessions are reported as not found. DSE enrollment recognition is handled by the academic identity service.</small></div>
        </div>
        {error&&<p className="tester-ultra-error" role="alert">{error}</p>}
        <div className="tester-ultra-actions">{running?<button className="tester-ultra-stop" type="button" onClick={stopAudit}><Square size={15}/> Stop batch</button>:<button className="tester-ultra-run" type="button" onClick={()=>void runAudit()} disabled={!institution||!supportedInstitution||!enrollmentList.length||enrollmentList.length>100||!selectedSessions.length||!selectedSemesters.length||!token}><Play size={16}/> Run Ultra Audit <span>→</span></button>}<span><ShieldCheck size={14}/> Read-only · No student records or catalogue entries are changed</span></div>
      </section>

      {(rows.length>0)&&<>
        <section className="tester-ultra-results">
          <div className="tester-ultra-section-heading"><div><span>02 · BATCH PERFORMANCE</span><h2>Audit overview</h2></div><div className="tester-ultra-result-actions"><span>{completedCount} / {rows.length} processed</span><button type="button" onClick={exportCsv} disabled={!rows.length}><Download size={15}/> Student CSV</button><button type="button" onClick={exportFindingsCsv} disabled={!globalFindings.length}><Download size={15}/> Findings CSV</button></div></div>
          <div className="tester-ultra-progress"><i style={{width:(rows.length?completedCount/rows.length*100:0)+"%"}}/></div>
          <div className="tester-ultra-metrics">
            <article><span>ENROLLMENTS</span><strong>{rows.length}</strong><small>In this batch</small></article>
            <article><span>COMPLETED</span><strong className="good">{successfulCount}</strong><small>All selected semesters verified</small></article>
            <article><span>AVERAGE CGPA</span><strong>{averageCgpa===null?"—":averageCgpa.toFixed(2)}</strong><small>{averageCgpa===null?"Select a single scheme and admission cohort":"Verified students in one cohort"}</small></article>
            <article><span>NEW / MISMATCHED</span><strong>{globalFindings.length}</strong><small>Unique subject findings</small></article>
            <article><span>FAILED / PARTIAL</span><strong className="bad">{failedCount} / {rows.filter(row=>row.status==="partial").length}</strong><small>{issueCount} findings and errors</small></article>
          </div>
          <nav className="tester-ultra-tabs"><button className={activeTab==="students"?"active":""} onClick={()=>setActiveTab("students")}><Users size={15}/> Student reports</button><button className={activeTab==="subjects"?"active":""} onClick={()=>setActiveTab("subjects")}><BookOpen size={15}/> Global subject registry <b>{globalFindings.length}</b></button><button className={activeTab==="branches"?"active":""} onClick={()=>setActiveTab("branches")}><BarChart3 size={15}/> Branch analytics</button><button className={activeTab==="issues"?"active":""} onClick={()=>setActiveTab("issues")}><Activity size={15}/> System issues <b>{issueRows.length}</b></button></nav>
          {activeTab==="students"&&<div className="tester-ultra-table-wrap"><div className="tester-ultra-table-toolbar"><strong>Individual enrollment reports</strong><div><Search size={14}/><input value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Find enrollment or branch"/></div></div><table className="tester-ultra-table"><thead><tr><th>ENROLLMENT</th><th>BRANCH / SCHEME</th><th>SEMESTER SGPA</th><th>CGPA</th><th>FINDINGS</th><th>STATUS</th><th>REPORT</th></tr></thead><tbody>{visibleRows.map(row=><tr key={row.enrollment}><td><strong>{row.enrollment}</strong><small>{row.admissionMode}</small></td><td>{row.branch||"—"}<small>{row.scheme}</small></td><td><div className="tester-ultra-semester-pills">{row.semesters.map(sem=><span key={sem.semester} title={sem.status+" · CGPA "+(sem.cgpa===null?"—":sem.cgpa.toFixed(2))}>S{sem.semester}: {sem.sgpa===null?"—":sem.sgpa.toFixed(2)}</span>)}</div></td><td><strong>{row.cgpa===null?"—":row.cgpa.toFixed(2)}</strong></td><td><span className="tester-ultra-finding-count">{row.findings.length} subjects · {row.errors.length} errors</span>{row.errors.slice(0,1).map((item,index)=><small key={index} className="tester-ultra-row-error">{item}</small>)}</td><td><span className={"tester-ultra-status "+row.status}>{row.status}</span></td><td><details className="tester-ultra-row-details"><summary>Open report</summary><div>{row.semesters.map(sem=><p key={sem.semester}><b>Semester {sem.semester}</b> · SGPA {sem.sgpa===null?"—":sem.sgpa.toFixed(3)} · CGPA {sem.cgpa===null?"—":sem.cgpa.toFixed(3)} · {sem.credits} credits · {sem.status}{sem.error?" — "+sem.error:""}</p>)}{row.findings.map((item,index)=><p key={item.code+item.kind+index}><b>{item.kind.replace("_"," ")}</b> · {item.name} ({item.code})</p>)}{row.errors.map((item,index)=><p className="tester-ultra-row-error" key={index}>{item}</p>)}</div></details></td></tr>)}</tbody></table>{visibleRows.length===0&&<p className="tester-ultra-empty">No enrollments match this search.</p>}</div>}
          {activeTab==="subjects"&&<div className="tester-ultra-table-wrap"><div className="tester-ultra-table-toolbar"><strong>Consolidated new subjects & mismatches</strong><span>{globalFindings.length} unique findings · duplicates merged</span></div><table className="tester-ultra-table"><thead><tr><th>SUBJECT / CODE</th><th>FINDING</th><th>SEMESTERS</th><th>OCCURRENCES</th><th>BRANCHES</th><th>AFFECTED ENROLLMENTS</th></tr></thead><tbody>{globalFindings.map((item,index)=><tr key={item.code+item.kind+item.semesters.join("-")+index}><td><strong>{item.name}</strong><small>{item.code}</small></td><td><span className={"tester-ultra-finding-kind "+item.kind.toLowerCase()}>{item.kind.replace("_"," ")}</span></td><td>{item.semesters.join(", ")}</td><td><strong>{item.occurrences}</strong></td><td>{item.branchNames.join(", ")||"—"}</td><td><small>{item.enrollments.join(", ")}</small></td></tr>)}</tbody></table>{globalFindings.length===0&&<p className="tester-ultra-empty">No new subjects or catalogue mismatches have been discovered in this batch.</p>}</div>}
          {activeTab==="issues"&&<div className="tester-ultra-table-wrap"><div className="tester-ultra-table-toolbar"><strong>System issue explorer</strong><span>{issueRows.length} diagnostics across {new Set(issueRows.map(item=>item.enrollment)).size} enrollments</span></div><table className="tester-ultra-table"><thead><tr><th>SEVERITY</th><th>ENROLLMENT</th><th>BRANCH</th><th>SEMESTER</th><th>DIAGNOSTIC</th></tr></thead><tbody>{issueRows.map((item,index)=><tr key={item.enrollment+item.semester+index}><td><span className={"tester-ultra-severity "+item.severity.toLowerCase()}>{item.severity}</span></td><td><strong>{item.enrollment}</strong></td><td>{item.branch||"—"}</td><td>{item.semester}</td><td>{item.detail}</td></tr>)}</tbody></table>{!issueRows.length&&<p className="tester-ultra-empty">No system issues were reported for this batch.</p>}</div>}
          {activeTab==="branches"&&<div className="tester-ultra-branch-panel"><div className="tester-ultra-analytics-controls"><label>SCHEME<select value={analyticsScheme} onChange={event=>setAnalyticsScheme(event.target.value)}><option value="ALL">All schemes</option>{schemeOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>ADMISSION TYPE<select value={analyticsAdmission} onChange={event=>setAnalyticsAdmission(event.target.value)}><option value="ALL">Regular + DSE</option><option value="REGULAR">Regular only</option><option value="DSE">DSE only</option></select></label><label>SEMESTER<select value={analyticsSemester} onChange={event=>setAnalyticsSemester(Number(event.target.value))}>{Array.from({length:8},(_,i)=>i+1).map(value=><option key={value} value={value}>Semester {value}</option>)}</select></label><label>METRIC<select value={analyticsMetric} onChange={event=>setAnalyticsMetric(event.target.value as "sgpa"|"cgpa")}><option value="sgpa">SGPA</option><option value="cgpa">Cumulative CGPA</option></select></label></div><div className="tester-ultra-analytics-summary">{selectedSemesterStats?<><div><small>BATCH AVERAGE</small><strong>{selectedSemesterStats.average.toFixed(2)}</strong></div><div><small>MINIMUM</small><strong>{selectedSemesterStats.min.toFixed(2)}</strong></div><div><small>MAXIMUM</small><strong>{selectedSemesterStats.max.toFixed(2)}</strong></div><div><small>VALID STUDENTS</small><strong>{selectedSemesterStats.count}</strong></div></>:<p className="tester-ultra-empty">No verified {analyticsMetric.toUpperCase()} values for Semester {analyticsSemester} yet.</p>}</div><div className="tester-ultra-table-toolbar"><strong>Inter-branch comparison · {analyticsMetric.toUpperCase()}</strong><span>Branch average, minimum and maximum</span></div>{branchStats.length?branchStats.map(item=><div className="tester-ultra-branch-row" key={item.branch}><div><strong>{item.branch}</strong><small>{item.count} students · min {item.min.toFixed(2)} · max {item.max.toFixed(2)}</small></div><div className="tester-ultra-branch-track"><i style={{width:(item.average*10)+"%"}}/></div><b>{item.average.toFixed(2)}</b></div>):<p className="tester-ultra-empty">Branch analytics will appear as verified semester results arrive.</p>}<div className="tester-ultra-table-toolbar"><strong>Intra-branch student benchmark</strong><span>Student score compared with their own branch average</span></div><div className="tester-ultra-table-wrap"><table className="tester-ultra-table"><thead><tr><th>ENROLLMENT</th><th>BRANCH</th><th>{analyticsMetric.toUpperCase()}</th><th>BRANCH AVERAGE</th><th>DIFFERENCE</th></tr></thead><tbody>{intraRows.map(item=><tr key={item.enrollment}><td><strong>{item.enrollment}</strong></td><td>{item.branch}</td><td>{item.value.toFixed(2)}</td><td>{item.branchAverage.toFixed(2)}</td><td><strong className={item.delta>=0?"good":"bad"}>{item.delta>=0?"+":""}{item.delta.toFixed(2)}</strong></td></tr>)}</tbody></table>{!intraRows.length&&<p className="tester-ultra-empty">No students have verified scores for this cohort and semester.</p>}</div><p className="tester-ultra-branch-note">Intra-branch analysis compares each student with the average, minimum and maximum for their own branch. Inter-branch analysis compares branch averages for the selected semester and metric. Only verified results are included; missing results are never treated as zero.</p></div>}
        </section>
      </>}
      {notice&&<p className="tester-ultra-notice" role="status">{notice}</p>}
      <footer className="tester-ultra-footer">Gradly Ultra Testing · Official result PDFs are inspected read-only · Student accounts and production academic records remain untouched.</footer>
    </section>
  </main>;
}
