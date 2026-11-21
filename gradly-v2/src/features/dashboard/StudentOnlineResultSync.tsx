import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./StudentOnlineResultSync.css";

type StudentSubject = { name: string; credits: number; grade: string; courseCode?: string; electiveKind?: string | null; electiveSlotCode?: string };
type ResultGrade = { courseCode: string; grade: string; courseName?: string; credits?: number; useDefault?: boolean; isNewSubject?: boolean; courseCategory?: string; creditStatus?: string };
type ResultSession = { id: string; title: string; url: string };
type ResultDocument = {
  title: string;
  url: string;
  programme: string | null;
  scheme: string | null;
  semester: number | null;
  grades: ResultGrade[];
};
type MatchResponse = {
  session: ResultSession;
  documentsScanned: number;
  enrollmentHits: number;
  parseFailures: number;
  matches: ResultDocument[];
};
function normalizeCourseCode(value:unknown):string { return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
function usableParsedCourseName(value:unknown):string { const name=String(value||"").replace(/\s+/g," ").trim(); if(!name || name.length>90 || /\bFOREIGN\b|\bCOURSE\s*CODE\b|\bRESULT\s*SUMMARY\b/i.test(name)) return ""; return name; }
function formatCourseCategory(value?:string):string { const labels:Record<string,string>={BSC:"Basic Science",ESC:"Engineering Science",PCC:"Professional Core Course",PEC:"Professional Elective",OE:"Open Elective",MDM:"Multidisciplinary Course",AEC:"Ability Enhancement Course",VEC:"Value Education Course",VSEC:"Value Skill Enhancement Course",INT:"Internship",PRJ:"Project",HSSM:"Humanities & Social Sciences",UNCLASSIFIED:"Needs classification"}; return labels[String(value||"").toUpperCase()] || String(value||"Other"); }
// GECA ESE PDFs use CEOE1010 for the Semester 6 Disaster Management
// elective, while the selected CBCS curriculum stores the same course as CE3008.
function canonicalResultCourseCode(value:unknown):string { const code=normalizeCourseCode(value); return code==="MEOE0031"?"ME4031":code==="CEOE1010"?"CE3008":code; }

type Props = {
  apiBase: string;
  curriculumId: string;
  getIdToken: () => Promise<string>;
  enrollmentNumber: string;
  selectedSemester: number;
  subjects: StudentSubject[];
  reExamTargetCourseCode?: string;
  onCancelReExam?: () => void;
  onApply: (semester: number, grades: ResultGrade[], sessionTitle: string, documentTitle: string, sourceUrl: string, attemptNumber: number) => boolean | void | Promise<boolean | void>;
};

export default function StudentOnlineResultSync({
  apiBase, curriculumId, getIdToken, enrollmentNumber, selectedSemester, subjects, reExamTargetCourseCode, onCancelReExam, onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ResultSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [scan, setScan] = useState<MatchResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const loadingSession = sessions.find(session => session.id === loadingSessionId);
  const [catalogue, setCatalogue] = useState<{ code: string; name: string; credits: number }[]>([]);
  const [appliedResult, setAppliedResult] = useState<{rows: ResultGrade[]; session: string; document: string; url: string; semester: number} | null>(null);
  const [pendingReview, setPendingReview] = useState<{rows: ResultGrade[]; session: string; document: string; url: string; semester: number; attemptNumber: number} | null>(null);
  const [appliedResult, setAppliedResult] = useState<{semester:number; count:number; session:string} | null>(null);
  const [reviewGrades, setReviewGrades] = useState<Record<string,string>>({});
  const [savingReview, setSavingReview] = useState(false);
  const [creditEdits, setCreditEdits] = useState<Record<string,string>>({});
  const [courseNameEdits, setCourseNameEdits] = useState<Record<string,string>>({});
  const [reportRow, setReportRow] = useState<ResultGrade | null>(null);
  const [reportKind, setReportKind] = useState("Incorrect grade");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  // Browser-local recovery mirror; the authenticated backend remains canonical.
  const localRegistryKey = "gradly_discovered_result_subjects_" + curriculumId + "_" + normalizeCourseCode(enrollmentNumber);
  const [reExamMode, setReExamMode] = useState(false);
  const [reExamConfirmed, setReExamConfirmed] = useState(false);
  const visibleSessions = reExamMode ? sessions.filter(session => /re[\s-]*(?:exam|ese)|re[\\s-]*examination|supplementary|backlog|atkt|additional examination/i.test(session.title)) : sessions;

  useEffect(() => {
    if (!curriculumId || !selectedSemester) { setCatalogue([]); return; }
    let cancelled = false;
    void fetch(apiBase + "/api/academic/curricula/" + encodeURIComponent(curriculumId) + "/semesters/" + selectedSemester + "/subjects?includeAllBranches=true")
      .then(response => response.json().then(body => ({ response, body })))
      .then(({ response, body }) => {
        if (!cancelled && response.ok && Array.isArray(body.data)) {
          setCatalogue(body.data.map((item: { code?: string | number | null; name?: string | null; credits?: string | number | null }) => ({ code: String(item.code || ""), name: String(item.name || ""), credits: Number(item.credits || 0) })));
        }
      }).catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, [apiBase, curriculumId, selectedSemester]);

  async function openArchive(forceRefresh = false) {
    setOpen(true);
    if (loadingSessions || (!forceRefresh && sessions.length)) return;
    if (forceRefresh) { setSessions([]); setScan(null); setSelectedSessionId(""); }
    const controller = new AbortController();
    activeRequest.current = controller;
    setShowCancelConfirm(false);
    setLoadingSessions(true);
    setError("");
    try {
      const token = await getIdToken();
      const response = await fetch(apiBase + "/api/student/results/sessions", {
        headers: { Authorization: "Bearer " + token },
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load GECA examination sessions.");
      setSessions(Array.isArray(body.sessions) ? body.sessions : []);
      if (!Array.isArray(body.sessions) || !body.sessions.length) setError("No examination sessions were listed by the GECA portal.");
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Unable to load GECA examination sessions.");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    if (!reExamTargetCourseCode) { setReExamMode(false); return; }
    setReExamMode(true);
    setReExamConfirmed(false);
    setOpen(true);
    setScan(null);
    setSelectedSessionId("");
    setNotice("");
    setError("");
    // Show the re-examination confirmation first. Do not fetch or expose
    // archive sessions until the student confirms they applied for re-exam.
  }, [reExamTargetCourseCode]);

  async function inspectSession(session: ResultSession) {
    // Enforce one examination-session scan at a time, even if rapid clicks bypass
    // React's disabled-button render before state updates.
    if (activeRequest.current || loadingSessionId) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setShowCancelConfirm(false);
    setSelectedSessionId(session.id);
    setLoadingSessionId(session.id);
    setScan(null);
    setNotice("");
    setError("");
    try {
      const token = await getIdToken();
      const response = await fetch(apiBase + "/api/student/results/sessions/" + encodeURIComponent(session.id) + "/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ selectedSemester, reExamTargetCourseCode: reExamMode ? reExamTargetCourseCode : undefined }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to inspect this examination session.");
      setScan(body as MatchResponse);
      const matchedDocuments = (body.matches || []) as ResultDocument[];
      const matchingDocument = matchedDocuments.find(document => document.semester === selectedSemester);
      if (matchingDocument) await applyDocument(matchingDocument, session.title);
      else if (matchedDocuments.length === 1) await applyDocument(matchedDocuments[0], session.title);

      else if (!body.matches?.length && Number(body.enrollmentHits) > 0) setNotice("Your enrollment was found, but the result could not be read. No grades were applied.");
      else if (!body.matches?.length) setNotice("Your enrollment was not found in this examination session.");
      else setNotice("A matching result PDF was found, but it belongs to a different semester. No grades were applied.");
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Unable to inspect this examination session.");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoadingSessionId("");
    }
  }

  async function applyDocument(document: ResultDocument, sessionTitle: string) {
    // The enrollment is matched within the selected examination session. If the
    // PDF parser misreads semester metadata, use the student's selected semester
    // as a fallback only when the scan returned a single enrollment match.
    const targetSemester = selectedSemester;

    const targetCode = canonicalResultCourseCode(reExamTargetCourseCode);
    const sourceRows = document.grades
      .filter(row => row.courseCode.trim())
      .filter(row => !reExamMode || !targetCode || canonicalResultCourseCode(row.courseCode) === targetCode);
    const manualGradeCodes = new Set(["MEOE1040","INMC2010","INMC2001","CEHS1030","INHS1020"]);
    const invalidGradeRows = sourceRows.filter(row => row.grade.trim() !== "" && !manualGradeCodes.has(normalizeCourseCode(row.courseCode)) && !["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));
    if (invalidGradeRows.length) {
      setError("The PDF contains course rows with grades Gradly could not recognise (" + invalidGradeRows.map(row => row.courseCode + ": " + row.grade).join(", ") + "). No grades were applied; the result needs parser review.");
      setNotice("");
      return;
    }

    // Only curriculum/selected elective rows count as in-curriculum. A subject
    // already registered in the discovered-result database is still outside the
    // student's selected curriculum and must remain explicitly identified as such.
    const subjectCodes = subjects.filter(subject => !subject.isCustom || Boolean(subject.curriculumSubjectId))
      .map(subject => normalizeCourseCode(subject.courseCode)).filter(Boolean);
    const expectedCodes = new Set([...subjectCodes, ...catalogue.map(item => normalizeCourseCode(item.code)).filter(Boolean), "CEHS1030", "INHS1020", "INMC2001"]);
    const counts = new Map<string, number>();
    sourceRows.forEach(row => {
      const code = canonicalResultCourseCode(row.courseCode);
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    const duplicateCodes = new Set([...counts].filter(([, count]) => count > 1).map(([code]) => code));
    const knownLegacyCodes = new Set(["MEOE1040", "MEOE0031", "MEOE0050", "ME4031", "INMC2010", "CEOE1010", "ITHS1030", "ITPE3005", "ITPE3006", "ITPE3007", "ITPE3008", "ITPE3032", "ITPC3010", "ITPR3002"]);
    const unknownRows = sourceRows.filter(row => {
      const code = canonicalResultCourseCode(row.courseCode);
      return expectedCodes.size && !expectedCodes.has(code) && !knownLegacyCodes.has(code);
    });
    // An official result row must not be discarded just because its course code
    // is absent from this student's curriculum catalogue. Keep it as an
    // independent result subject and surface the code during review.
    const unmatchedOfficialCodes = [...new Set(unknownRows.map(row => row.courseCode))];
    if (duplicateCodes.size) {
      setError("The result parser detected duplicate course codes (" + [...duplicateCodes].join(", ") + "). No grades were applied to avoid overwriting the wrong subject.");
      setNotice("");
      return;
    }
    // Keep the official GECA MEOE1040 row and its parsed subject name/grade.
    const hasMechanicalEntrepreneurshipExamCode = sourceRows.some(row => normalizeCourseCode(row.courseCode) === "MEOE1040");
    let discoveredRegistry: Record<string,{courseName:string;credits:number;courseCategory:string}> = {};
    try {
      const cached = JSON.parse(localStorage.getItem(localRegistryKey) || "{}");
      if (cached && typeof cached === "object" && !Array.isArray(cached)) discoveredRegistry = cached;
    } catch { /* Ignore malformed recovery cache and continue with the backend registry. */ }
    try {
      const token = await getIdToken();
      const codes = [...new Set(sourceRows.map(row => canonicalResultCourseCode(row.courseCode)))].join(",");
      const response = await fetch(apiBase + "/api/student/results/discovered-subjects?curriculumId=" + encodeURIComponent(curriculumId) + "&codes=" + encodeURIComponent(codes), { headers: { Authorization: "Bearer " + token } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "The saved subject catalogue could not be checked.");
      if (!Array.isArray(body.data)) throw new Error("The saved subject catalogue returned an invalid response.");
      discoveredRegistry = { ...discoveredRegistry, ...Object.fromEntries(body.data.map((item:any) => [normalizeCourseCode(item.courseCode), { courseName:String(item.courseName||""), credits:Number(item.credits), courseCategory:String(item.courseCategory||"") }])) };
      try { localStorage.setItem(localRegistryKey, JSON.stringify(discoveredRegistry)); } catch { /* The backend registry remains the durable source. */ }
    } catch (error) {
      setError(error instanceof Error ? "Gradly could not verify previously identified subjects: " + error.message : "Gradly could not verify previously identified subjects. No result was applied.");
      setNotice("");
      return;
    }
    const mappedRows = sourceRows.map(row => {
      const sourceCode = normalizeCourseCode(row.courseCode);
      const canonicalCode = canonicalResultCourseCode(sourceCode);
      const code = canonicalCode === "INMC2010" ? "INMC2001" : canonicalCode;
      const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
      const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
      const knownNames: Record<string,string> = {
        "CEHS1030":"Constitution of India and Professional Ethics",
        "ETHS0020":"Foreign Language - German",
        "CEOE0020":"Watershed Management",
        "INHS1020":"Universal Human Values-II: Understanding Harmony",
        "INMC2001":"Environmental Science",
        "MEOE1040":"Entrepreneurship Development",
        "ME4031":"Renewable Energy Engineering",
        "MEOE0050":"Additive Manufacturing",
        "CE3008":"Disaster Management",
        "CEOE1010":"Disaster Management",
        "ITHS1030":"Business Intelligence",
        "ITPE3005":"Advanced Database Management Systems",
        "ITPE3006":"Lab-Advanced Database Management Systems",
        "ITPE3007":"Data Mining",
        "ITPE3008":"Lab-Data Mining",
        "ITPE3032":"Deep Learning",
        "ITPC3010":"Computer Programming Lab II",
        "ITPR3002":"Mini Project II",
      };
      const parsedCredits = row.credits == null ? null : Number(row.credits);
      const officialSemesterSixCredits: Record<string,number> = { ITHS1030:3, ITPE3005:3, ITPE3006:1, ITPE3007:3, ITPE3008:1, ITPE3032:3, ITPC3010:1, ITPR3002:2 };
      const registryEntry = discoveredRegistry[code];
      const subjectName = registryEntry?.courseName || existing?.name || catalog?.name || knownNames[code] || usableParsedCourseName(row.courseName) || "Subject name not reliably detected in PDF";
      const inferredCategory = (() => {
        const match = code.match(/^[A-Z]{2}(BSC|ESC|PCC|PEC|MDM|OEC|VSE|AEC|EEM|IKS|VEC|RMC|CEP|PRJ|INT|CCC|HNC|RPR)/);
        if (match) return match[1] === "VSE" ? "VSEC" : match[1] === "OEC" ? "OE" : match[1];
        if (/^ETHS/.test(code)) return "HSSM";
        if (/^CEOE/.test(code)) return "OE";
        if (/^ITPC/.test(code)) return "PCC";
        if (/^ITPE/.test(code)) return "PEC";
        if (/^ITHS/.test(code)) return "AEC";
        if (/^INHS/.test(code)) return "VEC";
        if (/^ITES/.test(code)) return "ESC";
        if (/^MABS/.test(code)) return "BSC";
        if (/^[A-Z]{2}OE/.test(code)) return "OE";
        if (/^ITMD/.test(code)) return "MDM";
        return "UNCLASSIFIED";
      })();
      const fallbackCredits = code === "INMC2001" ? 0 : officialSemesterSixCredits[code] ?? (code === "INHS1020" ? 3 : code === "CEHS1030" ? 3 : /LAB|PRACTICAL|WORKSHOP/i.test(subjectName) ? 1 : inferredCategory === "INT" ? 12 : ["VSEC","AEC","EEM","IKS","VEC","RMC","CEP","CCC"].includes(inferredCategory) ? 2 : /PROJECT/i.test(subjectName) ? 2 : 3);
      const parsedGrade = String(row.grade || "").trim().toUpperCase();
      const grade = ["A++","A+","A","B+","B","C+","C","D"].includes(parsedGrade) ? parsedGrade : "";
      return { ...row, courseCode: code, grade, courseName: registryEntry?.courseName || subjectName, credits: Number(code === "INHS1020" ? 3 : existing?.credits ?? catalog?.credits ?? registryEntry?.credits ?? parsedCredits ?? fallbackCredits), isNewSubject: !existing && !registryEntry, courseCategory: registryEntry?.courseCategory || inferredCategory, creditStatus: registryEntry ? "USER_CONFIRMED" : (!existing ? "FIRST_USER_CONFIRMATION" : "CURRICULUM") };
    });
    // Course code is the only deduplication key. Retain the first valid row
    // for each normalized course code, even when names differ; distinct codes
    // remain separate courses even when their names are identical.
    const seenCourseCodes = new Set<string>();
    const applicable = mappedRows.filter(row => {
      const codeKey = normalizeCourseCode(row.courseCode);
      if (!codeKey || seenCourseCodes.has(codeKey)) return false;
      seenCourseCodes.add(codeKey);
      return true;
    });
    if (!applicable.length || applicable.some(row => !Number.isFinite(row.credits) || row.credits < 0 || (row.credits === 0 && normalizeCourseCode(row.courseCode) !== "INMC2001") || !row.courseName.trim())) {
      setError(reExamMode && reExamTargetCourseCode ? "This re-examination PDF does not contain the selected backlog subject. No grades were changed." : "No valid, matching subjects were found in this result. No grades were changed.");
      return;
    }

    setError("");
    setNotice("");
    if (reExamMode && applicable.some(row => !["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()))) {
      setReviewGrades(Object.fromEntries(applicable.map(row => [normalizeCourseCode(row.courseCode), row.grade || ""])));
      setCreditEdits(Object.fromEntries(applicable.filter(row => row.isNewSubject).map(row => [normalizeCourseCode(row.courseCode), String(row.credits ?? 3)])));
      setCourseNameEdits(Object.fromEntries(applicable.filter(row => row.isNewSubject).map(row => [normalizeCourseCode(row.courseCode), row.courseName || ""])));
      setPendingReview({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester, attemptNumber: 2});
      setNotice("GECA has not announced a grade for this subject (shown as “-”). Enter the grade from your official grade card, then confirm and save.");
      return;
    }
    // Regular and re-examination results must both wait for explicit review.
    // Fetching a PDF is never permission to mutate grades or show a success dialog.
    setReviewGrades(Object.fromEntries(applicable.map(row => [normalizeCourseCode(row.courseCode), row.grade || ""])));
    setCreditEdits(Object.fromEntries(applicable.filter(row => row.isNewSubject).map(row => [normalizeCourseCode(row.courseCode), String(row.credits ?? 3)])));
      setCourseNameEdits(Object.fromEntries(applicable.filter(row => row.isNewSubject).map(row => [normalizeCourseCode(row.courseCode), row.courseName || ""])));
    setPendingReview({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester, attemptNumber: reExamMode ? 2 : 1});
    setNotice("Review fetched grades. Any subject without an online grade needs a manual grade from your grade card before saving." + (unmatchedOfficialCodes.length ? " Official PDF courses outside the selected curriculum are included as separate result subjects: " + unmatchedOfficialCodes.join(", ") + "." : ""));
  }



  async function confirmPendingReview() {
    if (!pendingReview) return;
    const grades = pendingReview.rows.map(row => ({
      ...row,
      courseName: row.isNewSubject ? String(courseNameEdits[normalizeCourseCode(row.courseCode)] ?? row.courseName ?? "").trim() : row.courseName,
      grade: reviewGrades[normalizeCourseCode(row.courseCode)] || "",
      ...(row.isNewSubject ? { credits: Number(creditEdits[normalizeCourseCode(row.courseCode)] ?? row.credits ?? 3) } : {}),
    }));
    const invalidNames = grades.filter(row => row.isNewSubject && (!row.courseName || /Subject name not reliably detected/i.test(row.courseName)));
    if (invalidNames.length) { setError("Enter or correct the subject name for: " + invalidNames.map(row => row.courseCode).join(", ")); return; }
    const missing = grades.filter(row => !["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));
    const invalidCredits = grades.filter(row => row.isNewSubject && (!String(creditEdits[normalizeCourseCode(row.courseCode)] ?? "").trim() || !Number.isFinite(Number(row.credits)) || Number(row.credits) < 0 || Number(row.credits) > 30));
    if (invalidCredits.length) { setError("Enter a valid credit value (zero or more, up to 30) for: " + invalidCredits.map(row => row.courseName || row.courseCode).join(", ")); return; }
    if (missing.length) {
      setError("Enter a grade for every subject before saving. Missing: " + missing.map(row => row.courseName || row.courseCode).join(", "));
      return;
    }
    setError("");
    setNotice("Saving reviewed grades…");
    setSavingReview(true);
    try {
      const token = await getIdToken();
      // Register newly identified courses first: the academic-result API validates
      // official GECA rows against this shared registry in the same transaction.
      // Saving after onApply caused valid new codes to be rejected as unknown.
      for (const row of grades.filter(item => item.isNewSubject)) {
        const response = await fetch(apiBase + "/api/student/results/discovered-subjects", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ curriculumId, semesterNumber: pendingReview.semester, courseCode: row.courseCode, courseName: row.courseName, courseCategory: row.courseCategory, credits: row.credits, source: "GECA_OFFICIAL_RESULT_PDF" }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Unable to register the newly discovered subject.");
        if (body.data?.credits != null) row.credits = Number(body.data.credits);
        row.creditStatus = "USER_CONFIRMED";
        // Mirror each successful confirmation immediately. If a later course
        // or grade save fails, this code must still be recognised next fetch.
        try {
          const cache = JSON.parse(localStorage.getItem(localRegistryKey) || "{}");
          const safeCache = cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
          safeCache[normalizeCourseCode(row.courseCode)] = { courseName: row.courseName, credits: Number(row.credits), courseCategory: row.courseCategory || "UNCLASSIFIED" };
          localStorage.setItem(localRegistryKey, JSON.stringify(safeCache));
        } catch { /* Backend confirmation remains durable if local storage is unavailable. */ }
      }
      const result = await onApply(pendingReview.semester, grades, pendingReview.session, pendingReview.document, pendingReview.url, pendingReview.attemptNumber);
      if (result === false) {
        setNotice("The subject catalogue was updated, but the semester result was not saved. Retry the result save; the courses will now be recognised.");
        return;
      }
      setAppliedResult({ semester: pendingReview.semester, count: grades.length, session: pendingReview.session });
      setPendingReview(null);
      setError("");
      setNotice("");
      setOpen(false);
      setScan(null);
      setSelectedSessionId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the reviewed grades. Please retry.");
      setNotice("");
    } finally {
      setSavingReview(false);
    }
  }

  async function submitMismatchReport() {
    if (!reportRow || reportDetails.trim().length < 10) { setReportMessage("Please add at least 10 characters explaining the mismatch."); return; }
    setReportBusy(true); setReportMessage("");
    try {
      const token = await getIdToken();
      const message = ["OFFICIAL RESULT MISMATCH REPORT","Issue: " + reportKind,"Semester: " + (appliedResult?.semester || selectedSemester),"Course code: " + (reportRow.courseCode || "Not detected"),"Subject: " + (reportRow.courseName || reportRow.courseCode || "Unknown subject"),"Fetched grade: " + reportRow.grade,"Examination session: " + (appliedResult?.session || "Unknown"),"Result PDF: " + (appliedResult?.document || "Unknown"),"Source: " + (appliedResult?.url || "GECA"),"Current registered credits: " + String(reportRow.credits ?? "Unknown"),"Student explanation: " + reportDetails.trim()].join("\n");
      const response = await fetch(apiBase + "/api/student/syllabus-feedback", {method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({requestType:reportKind==="Incorrect subject credits"?"CREDIT_CORRECTION":"SYLLABUS_FEEDBACK",semesterNumber:appliedResult?.semester||selectedSemester,subjectName:(reportKind==="Incorrect subject credits"?"Credit grievance · ":"Result mismatch · ")+(reportRow.courseName||reportRow.courseCode||"Subject"),message})});
      const body=await response.json();
      if(!response.ok) throw new Error(body.message||"Unable to submit your report.");
      setReportMessage(reportKind==="Incorrect subject credits"?"Credit correction grievance sent directly to Super Admin.":"Report submitted to department review. The department can forward it to Super Admin.");
      setReportRow(null);setReportDetails("");setReportKind("Incorrect grade");
    }catch(err){setReportMessage(err instanceof Error?err.message:"Unable to submit your report. Please try again.");}
    finally{setReportBusy(false);}
  }

  return <>
    <button type="button" className={"sp-entry-mode " + (open ? "selected" : "")} onClick={() => void openArchive()} aria-expanded={open}>
      <span>ONLINE FETCHING</span>
      <strong>Fetch official results</strong>
      <small>{loadingSessions ? "Loading GECA archive…" : sessions.length ? sessions.length + " examination sessions available" : "Fetch results for Semester {selectedSemester}"}</small>
    </button>
    {open && <section className="sp-online-result-panel sp-online-result-inline" role="dialog" aria-modal="true" aria-label={reExamMode?"Choose re-examination session":"Choose examination session"} aria-busy={loadingSessions || Boolean(loadingSessionId)}>
      <div className="sp-online-result-head">
        <div className="sp-online-result-heading"><span>GECA · RESULT IMPORT</span><h3>{reExamMode ? "Fetch your re-examination marks" : "Select an examination session"}</h3>{reExamMode&&reExamTargetCourseCode&&<div className="sp-reexam-subject-callout"><b>! Backlog subject selected</b><strong>{subjects.find(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(reExamTargetCourseCode))?.name||reExamTargetCourseCode}</strong><span>Choose the examination session in which you appeared for this subject. Gradly will update this subject’s grade only.</span></div>}<p>Choose the examination in which you appeared for Semester {selectedSemester}. We’ll scan its linked department result PDFs for enrollment <b>{enrollmentNumber}</b>. Review the official GECA result before applying grades to your student workspace.</p></div>
        <button type="button" onClick={() => { if (reExamMode) onCancelReExam?.(); setReExamMode(false); setOpen(false); }} aria-label="Close online result archive">×</button>
      </div>
      {(loadingSessions || Boolean(loadingSessionId)) && createPortal(<div className="sp-online-loading-backdrop" role="presentation">
        <div className="sp-online-loading-dialog" role="status" aria-live="polite" aria-label={loadingSessions ? "Loading GECA examination archive" : "Scanning GECA result PDFs"}>
          <div className="sp-online-loader-art" aria-hidden="true">
            <span className="sp-online-loader-orbit sp-online-loader-orbit-one" />
            <span className="sp-online-loader-orbit sp-online-loader-orbit-two" />
            <span className="sp-online-loader-core"><i /></span>
          </div>
          <span className="sp-online-loader-eyebrow">GRADLY · STUDENT WORKSPACE</span>
          <h3>{loadingSessions ? "Loading GECA examinations" : "Fetching your grades"}</h3>
          {!loadingSessions && loadingSession && <div className="sp-online-loader-session">
            <span>SELECTED EXAMINATION</span>
            <strong>{loadingSession.title}</strong>
            <small>Semester {selectedSemester} · Enrollment {enrollmentNumber}</small>
          </div>}
          <p>{loadingSessions ? "Retrieving the latest examination sessions from the official GECA archive." : "Gradly is checking the relevant department result PDFs and reading the matching result row. Your grades will remain unchanged until you review and apply them."}</p>
          <div className="sp-online-loader-progress" aria-hidden="true"><span /></div>
          <div className="sp-online-loader-foot"><span className="sp-online-loader-dot" />{loadingSessions ? "Loading examination list" : "Fetching and analysing your result PDFs"}<span className="sp-online-loader-pulse">Please wait</span></div>
          {!showCancelConfirm ? <button type="button" className="sp-online-cancel-fetch" onClick={() => setShowCancelConfirm(true)}>Cancel fetching</button> : <div className="sp-online-cancel-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sp-online-cancel-title"><strong id="sp-online-cancel-title">Stop fetching?</strong><p>The current request will be cancelled. Any results already loaded will remain unchanged.</p><div><button type="button" onClick={() => setShowCancelConfirm(false)}>Continue fetching</button><button type="button" onClick={() => { activeRequest.current?.abort(); activeRequest.current = null; setShowCancelConfirm(false); setLoadingSessions(false); setLoadingSessionId(""); setNotice("Fetching was cancelled. No grades were applied."); }}>Stop fetching</button></div></div>}
        </div>
      </div>, document.body)}
{reExamMode && !reExamConfirmed && createPortal(<div className="sp-online-reexam-confirm" role="dialog" aria-modal="true" aria-label="Choose whether to fetch a re-examination result"><span className="sp-online-reexam-icon" aria-hidden="true">↗</span><strong>Are you fetching a re-examination result?</strong><p>Choose Yes only if you have applied for re-examination for this backlog subject. Gradly will then show the GECA re-exam sessions; your existing grade stays untouched unless a matching result is found.</p><div><button type="button" className="sp-online-reexam-no" onClick={() => { onCancelReExam?.(); setReExamMode(false); setReExamConfirmed(false); setOpen(false); }}>No, not now</button><button type="button" className="sp-online-reexam-yes" onClick={() => { setReExamConfirmed(true); void openArchive(true); }}>Yes, fetch re-exam</button></div></div>, document.body)}{loadingSessions && <p className="sp-online-result-muted">Loading the current examination list from GECA…</p>}
      {!loadingSessions && reExamMode && sessions.length>0 && visibleSessions.length===0 && <p className="sp-online-result-muted">No re-examination sessions are currently listed in the GECA archive. Regular examination sessions are hidden in this view.</p>}
      {error && <p className="sp-online-result-error" role="alert">{error}</p>}
      {(!reExamMode || reExamConfirmed) && visibleSessions.length > 0 && <div className="sp-online-session-list">
        {visibleSessions.map(session => <button type="button" key={session.id} className={"sp-online-session " + (selectedSessionId === session.id ? "active" : "")} onClick={() => void inspectSession(session)} disabled={Boolean(loadingSessionId)}>
          <span><b>{session.title}</b><small>GECA examination result</small></span>
          <strong>{loadingSessionId === session.id ? "Scanning PDFs…" : selectedSessionId === session.id ? "Selected" : "Fetch grades →"}</strong>
        </button>)}
      </div>}
      {scan && !scan.matches?.length && <div className="sp-online-scan-result">
        
        {!scan.matches.length && <p className="sp-online-result-muted">{scan.enrollmentHits > 0 ? "The enrollment was found, but the result table could not be parsed. No grades have been applied." : "No exact enrollment match was found in this examination session."}</p>}
        {scan.matches.map(document => {
          const validRows = document.grades.filter(row => row.courseCode.trim() && ["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));
          const backlogRows = validRows.filter(row => row.grade.toUpperCase() === "D");
          const canApply = document.semester === selectedSemester && validRows.length > 0;
          return <article className="sp-online-match" key={document.url}>
            <div className="sp-online-match-top"><div><b>{document.title}</b><small>{document.scheme || "Scheme not detected"} · {document.semester ? "Semester " + document.semester : "Semester not detected"}</small></div><span>{validRows.length} subjects</span></div>
            <div className="sp-online-result-summary">
              <div><strong>{validRows.length}</strong><span>Official subjects</span></div>
              <div><strong>{validRows.length - backlogRows.length}</strong><span>Cleared</span></div>
              <div className={backlogRows.length ? "has-backlog" : ""}><strong>{backlogRows.length}</strong><span>Active backlogs</span></div>
            </div>
            {backlogRows.length > 0 && !reExamMode && <div className="sp-online-backlog-alert"><b>！ {backlogRows.length} active backlog{backlogRows.length===1?"":"s"}</b><span>{backlogRows.map(row=>row.courseName || row.courseCode).slice(0,3).join(" · ")}{backlogRows.length>3?" · +"+(backlogRows.length-3)+" more":""}</span></div>}
            <div className="sp-online-auto-apply-note">{canApply ? "Result found. Review and confirm grades before saving." : "Semester does not match your selected workspace."}</div>

            {reExamMode && <p className="sp-online-reexam-mode">Re-examination mode · fetched grades will update the existing backlog attempt without replacing unrelated subjects.</p>}
          </article>;
        })}

      </div>}
      {notice && <p className="sp-online-result-notice" role="status">{notice}</p>}
      {pendingReview && createPortal(<div style={{position:"fixed",inset:0,zIndex:100020,background:"rgba(8,15,24,.78)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Review official result grades"><section style={{background:"#fff",color:"#17231d",borderRadius:16,padding:22,width:"min(680px,100%)",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 25px 80px rgba(0,0,0,.35)"}}><small style={{fontWeight:800,color:"#167348"}}>GECA · RESULT REVIEW</small><h2 style={{margin:"8px 0"}}>Review your semester grades</h2><p style={{marginTop:0}}>Check the fetched grades against your official grade card. Newly detected subjects are added to the catalogue after you confirm their credits. If GECA has not published a grade online, select it manually here.</p>{pendingReview.rows.some(row=>!subjects.some(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(row.courseCode)))&&<p style={{margin:"10px 0",padding:"10px 12px",borderRadius:8,background:"#fff7e6",color:"#805400",fontSize:13}}>The official PDF includes course codes outside your selected curriculum. They are retained below as separate result subjects and will not be mapped to another course: <b>{[...new Set(pendingReview.rows.filter(row=>!subjects.some(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(row.courseCode))&&!catalogue.some(item=>normalizeCourseCode(item.code)===normalizeCourseCode(row.courseCode))).map(row=>row.courseCode))].join(", ")}</b>.</p>}<div style={{borderTop:"1px solid #e4e9e5"}}>{pendingReview.rows.map((row,index)=>{const key=normalizeCourseCode(row.courseCode);const manual=!row.grade;return <div key={key+index} data-new-subject={row.isNewSubject ? "true" : undefined} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 118px",gap:12,alignItems:"center",padding:"10px 10px 10px 12px",borderBottom:"1px solid #e8ece9",background:row.isNewSubject?"#eef2ff":"transparent",borderLeft:row.isNewSubject?"4px solid #5965d8":"4px solid transparent",borderRadius:row.isNewSubject?8:0}}><span><b>{row.courseName||row.courseCode}</b><small style={{display:"block",opacity:.65}}>{row.courseCode}{manual?" · Manual grade required":""}</small>{row.isNewSubject && <span style={{display:"inline-block",marginTop:6,padding:"3px 7px",borderRadius:5,background:"#5965d8",color:"#fff",fontSize:10,fontWeight:800,letterSpacing:".06em"}}>NEW SUBJECT</span>}{row.isNewSubject && <label style={{display:"block",marginTop:6,fontSize:12,color:"#373f86"}}>Subject name · verify or edit<input type="text" value={courseNameEdits[key] ?? row.courseName ?? ""} onChange={event=>setCourseNameEdits(current=>({...current,[key]:event.target.value}))} style={{display:"block",width:"min(100%,320px)",marginTop:4,padding:7,border:"1px solid #a5b4fc",borderRadius:7}} /></label>}{row.isNewSubject && <label style={{display:"block",marginTop:5,fontSize:12,color:"#373f86"}}>Newly detected · suggested credits · {formatCourseCategory(row.courseCategory)} (confirm or edit)<input type="number" min="0" max="30" step="0.5" value={creditEdits[key] ?? String(row.credits ?? 3)} onChange={event=>setCreditEdits(current=>({...current,[key]:event.target.value}))} style={{display:"block",width:110,marginTop:4,padding:7,border:"1px solid #cbd5ce",borderRadius:7}} /></label>}{!row.isNewSubject && <button type="button" onClick={()=>{setReportRow(row);setReportKind("Incorrect subject credits");setReportDetails("");setReportMessage("");}} style={{display:"block",marginTop:6,padding:0,border:0,background:"transparent",color:"#9b3d24",fontSize:12,textDecoration:"underline",cursor:"pointer"}}>Report incorrect credits</button>}</span><select aria-label={"Grade for "+(row.courseName||row.courseCode)} value={reviewGrades[key]||""} onChange={event=>setReviewGrades(current=>({...current,[key]:event.target.value}))} style={{width:"100%",padding:9,borderRadius:8,border:"1px solid #cbd5ce",background:"#fff",color:"#17231d"}}><option value="">Select grade</option>{["A++","A+","A","B+","B","C+","C","D"].map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></div>})}</div>{error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}><button type="button" onClick={()=>{setPendingReview(null);setError("");setNotice("Result review cancelled. No grades were saved.");}} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #cbd5ce",background:"#fff",color:"#17231d"}}>Cancel</button><button type="button" onClick={()=>void confirmPendingReview()} disabled={savingReview || !pendingReview.rows.every(row=>["A++","A+","A","B+","B","C+","C","D"].includes((reviewGrades[normalizeCourseCode(row.courseCode)]||"").toUpperCase()))} style={{padding:"10px 16px",border:0,borderRadius:8,background:"#172d21",color:"#fff",fontWeight:700,opacity:savingReview ? 0.72 : 1}}>{savingReview?"Saving grades…":"Confirm and save grades"}</button></div></section></div>,document.body)}
      {/* Success is shown once by the parent student workspace. */}

      {reportRow && <div style={{position:"fixed",inset:0,zIndex:100030,background:"rgba(15,20,25,.45)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Report result mismatch"><div style={{background:"white",color:"#20242a",borderRadius:16,padding:20,width:"min(480px,100%)",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><small>GECA · RESULT REVIEW</small><h3 style={{margin:"6px 0"}}>{reportKind==="Incorrect subject credits"?"Report incorrect credits":"Report a mismatch"}</h3></div><button type="button" onClick={()=>{setReportRow(null);setReportMessage("");}} aria-label="Close">×</button></div>
        <p><b>{reportRow.courseName||reportRow.courseCode}</b> · {reportRow.courseCode} · Fetched grade: <b>{reportRow.grade}</b></p>
        <label style={{display:"block",margin:"10px 0"}}>What is incorrect?<select value={reportKind} onChange={e=>setReportKind(e.target.value)} style={{display:"block",width:"100%",marginTop:5,padding:10,borderRadius:8}}><option>Incorrect grade</option><option>Wrong subject mapping</option><option>Incorrect course code</option><option>Unexpected result</option><option>Other</option></select></label>
        <label style={{display:"block"}}>Details (minimum 10 characters)<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={4} placeholder="Explain what should be corrected…" style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:5,padding:10,borderRadius:8}}/></label>
        {reportMessage&&<p role="status" style={{fontSize:13}}>{reportMessage}</p>}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button type="button" onClick={()=>{setReportRow(null);setReportMessage("");}}>Cancel</button><button type="button" disabled={reportBusy||reportDetails.trim().length<10} onClick={()=>void submitMismatchReport()}>{reportBusy?"Submitting…":"Submit report"}</button></div>
      </div></div>}
      {appliedResult && createPortal(<div style={{position:"fixed",inset:0,zIndex:100030,background:"rgba(8,15,24,.76)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Official grades saved successfully"><section style={{background:"#fff",color:"#14251c",borderRadius:18,padding:26,width:"min(420px,100%)",textAlign:"center",boxShadow:"0 25px 80px rgba(0,0,0,.35)"}}><div style={{fontSize:36,color:"#14804b"}}>✓</div><h2 style={{margin:"8px 0"}}>Grades applied successfully</h2><p>Your Semester {appliedResult.semester} grades ({appliedResult.count} subjects) have been saved from {appliedResult.session}.</p><button type="button" onClick={()=>setAppliedResult(null)} style={{display:"block",width:"100%",marginTop:14,padding:12,border:0,borderRadius:10,background:"#15271d",color:"#fff",fontWeight:800}}>Done</button></section></div>,document.body)}
      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Official result · one-step profile update</span></div>
    </section>}
    
  </>;
}
