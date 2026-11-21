import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TesterSubject = { name: string; credits: number; grade: string; courseCode?: string; electiveKind?: string | null; electiveSlotCode?: string };
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
// GECA ESE PDFs use CEOE1010 for the Semester 6 Disaster Management
// elective, while the selected CBCS curriculum stores the same course as CE3008.
function canonicalResultCourseCode(value:unknown):string { const code=normalizeCourseCode(value); return code==="MEOE0031"?"ME4031":code==="CEOE1010"?"CE3008":code; }

type Props = {
  apiBase: string;
  curriculumId: string;
  testerToken: string;
  enrollmentNumber: string;
  selectedSemester: number;
  subjects: TesterSubject[];
  reExamTargetCourseCode?: string;
  onCancelReExam?: () => void;
  onApply: (semester: number, grades: ResultGrade[], sessionTitle: string, documentTitle: string, sourceUrl: string, attemptNumber: number) => boolean | void | Promise<boolean | void>;
};

export default function TesterOnlineResultSync({
  apiBase, curriculumId, testerToken, enrollmentNumber, selectedSemester, subjects, reExamTargetCourseCode, onCancelReExam, onApply,
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
  const [reviewGrades, setReviewGrades] = useState<Record<string,string>>({});
  const [savingReview, setSavingReview] = useState(false);
  const [creditEdits, setCreditEdits] = useState<Record<string,string>>({});
  
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

  async function openArchive() {
    setOpen(true);
    if (loadingSessions || sessions.length) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setShowCancelConfirm(false);
    setLoadingSessions(true);
    setError("");
    try {
      const response = await fetch(apiBase + "/api/tester/results/sessions", {
        headers: { Authorization: "Bearer " + testerToken },
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
    // Clicking the tester backlog action should load the archive immediately.
    void openArchive();
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
      const response = await fetch(apiBase + "/api/tester/results/sessions/" + encodeURIComponent(session.id) + "/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + testerToken },
        body: JSON.stringify({ enrollmentNumber, selectedSemester, reExamTargetCourseCode: reExamMode ? reExamTargetCourseCode : undefined }),
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

    const subjectCodes = subjects.map(subject => normalizeCourseCode(subject.courseCode)).filter(Boolean);
    // Reconcile against the tester's selected subjects, not every department's
    // elective catalogue. GECA's exam PDF may use the legacy MEOE1040 code.
    const expectedCodes = new Set([...subjectCodes, "CEHS1030", "INHS1020", "INMC2001"]);
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
    const testerRegistryKey = "gradly-tester-discovered-subjects:" + curriculumId;
    let discoveredRegistry: Record<string,{courseName:string;credits:number;courseCategory:string}> = {};
    try { discoveredRegistry = JSON.parse(localStorage.getItem(testerRegistryKey) || "{}"); } catch { discoveredRegistry = {}; }
    const mappedRows = sourceRows.map(row => {
      const sourceCode = normalizeCourseCode(row.courseCode);
      const canonicalCode = canonicalResultCourseCode(sourceCode);
      const code = canonicalCode === "INMC2010" ? "INMC2001" : canonicalCode;
      const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
      const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
      const knownNames: Record<string,string> = {
        "CEHS1030":"Constitution of India and Professional Ethics",
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
      const subjectName = row.courseName || knownNames[code] || existing?.name || catalog?.name || registryEntry?.courseName || row.courseCode;
      const inferredCategory = (() => {
        const match = code.match(/^[A-Z]{2}(BSC|ESC|PCC|PEC|MDM|OEC|VSE|AEC|EEM|IKS|VEC|RMC|CEP|PRJ|INT|CCC|HNC|RPR)/);
        if (match) return match[1] === "VSE" ? "VSEC" : match[1] === "OEC" ? "OE" : match[1];
        if (/^ITPC/.test(code)) return "PCC";
        if (/^ITES/.test(code)) return "ESC";
        if (/^MABS/.test(code)) return "BSC";
        if (/^ITOE/.test(code)) return "OE";
        if (/^ITMD/.test(code)) return "MDM";
        return "UNCLASSIFIED";
      })();
      const fallbackCredits = code === "INMC2001" ? 0 : officialSemesterSixCredits[code] ?? (code === "INHS1020" ? 3 : code === "CEHS1030" ? 3 : /LAB|PRACTICAL|WORKSHOP/i.test(subjectName) ? 1 : /PROJECT/i.test(subjectName) ? 2 : 3);
      const parsedGrade = String(row.grade || "").trim().toUpperCase();
      const grade = ["A++","A+","A","B+","B","C+","C","D"].includes(parsedGrade) ? parsedGrade : "";
      return { ...row, courseCode: code, grade, courseName: registryEntry?.courseName || subjectName, credits: Number(code === "INHS1020" ? 3 : existing?.credits ?? catalog?.credits ?? registryEntry?.credits ?? parsedCredits ?? fallbackCredits), isNewSubject: !existing && !catalog && !registryEntry, courseCategory: registryEntry?.courseCategory || inferredCategory, creditStatus: registryEntry ? "USER_CONFIRMED" : (!existing && !catalog ? "FIRST_USER_CONFIRMATION" : "CURRICULUM") };
    });
    // Preserve selected courses whose grades are absent from the online PDF.
    // Blank grades are entered by the student in the review step, never
    // converted into D or another failure grade.
    if (!reExamMode) {
      const present = new Set(mappedRows.map(row => normalizeCourseCode(row.courseCode)));
      for (const subject of subjects) {
        const code = normalizeCourseCode(subject.courseCode);
        const staleElectricalEntrepreneurship = hasMechanicalEntrepreneurshipExamCode && code === "EE3018" && /entrepreneurship development/i.test(subject.name);
        if (!code || staleElectricalEntrepreneurship || (subject.electiveSlotCode && normalizeCourseCode(subject.electiveSlotCode) === code) || !subject.name.trim() || !Number.isFinite(subject.credits) || subject.credits < 0 || (subject.credits === 0 && code !== "INMC2001") || present.has(code)) continue;
        mappedRows.push({ courseCode: subject.courseCode || code, courseName: subject.name, credits: subject.credits, grade: "", useDefault: true });
        present.add(code);
      }
    }
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
      setCreditEdits(Object.fromEntries(applicable.filter(row => row.isNewSubject).map(row => [normalizeCourseCode(row.courseCode), String(row.credits ?? 3)])));\n      setPendingReview({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester, attemptNumber: 2});
      setNotice("GECA has not announced a grade for this subject (shown as “-”). Enter the grade from your official grade card, then confirm and save.");
      return;
    }
    if (reExamMode) {
      try {
        const applyResult = await onApply(targetSemester, applicable, sessionTitle, document.title, document.url, 2);
        if (applyResult === false) { setNotice("The re-examination result could not be applied. Check the message and try again."); return; }
        // Re-examination success is presented by the parent tester grade dialog.
        // Avoid stacking two success modals, which made Done reveal another modal.
        if (reExamMode) {
          setAppliedResult(null);
          setPendingReview(null);
          setOpen(false);
          setScan(null);
          setSelectedSessionId("");
          setNotice("Re-examination grade applied successfully in this tester session.");
          return;
        }
        setAppliedResult({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester});
        setNotice("Re-examination grades added successfully.");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not save the re-examination grade. Please retry.");
      }
      return;
    }
    setReviewGrades(Object.fromEntries(applicable.map(row => [normalizeCourseCode(row.courseCode), row.grade || ""])));
    setCreditEdits(Object.fromEntries(applicable.filter(row => row.isNewSubject).map(row => [normalizeCourseCode(row.courseCode), String(row.credits ?? 3)])));\n    setPendingReview({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester, attemptNumber: 1});
    setNotice("Review fetched grades. Any subject without an online grade needs a manual grade from your grade card before saving." + (unmatchedOfficialCodes.length ? " Official PDF courses outside the selected curriculum are included as separate result subjects: " + unmatchedOfficialCodes.join(", ") + "." : ""));
  }



  async function confirmPendingReview() {
    if (!pendingReview) return;
    const grades = pendingReview.rows.map(row => ({
      ...row,
      grade: reviewGrades[normalizeCourseCode(row.courseCode)] || "",
    }));
    const missing = grades.filter(row => !["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));\n    const invalidCredits = grades.filter(row => row.isNewSubject && (!Number.isFinite(Number(row.credits)) || Number(row.credits) <= 0 || Number(row.credits) > 30));\n    if (invalidCredits.length) { setError("Enter a valid credit value (greater than 0 and no more than 30) for: " + invalidCredits.map(row => row.courseName || row.courseCode).join(", ")); return; }
    if (missing.length) {
      setError("Enter a grade for every subject before saving. Missing: " + missing.map(row => row.courseName || row.courseCode).join(", "));
      return;
    }
    setError("");
    setNotice("Saving reviewed grades…");
    setSavingReview(true);
    try {
      const key = "gradly-tester-discovered-subjects:" + curriculumId;
      let registry: Record<string,any> = {};
      try { registry = JSON.parse(localStorage.getItem(key) || "{}"); } catch { registry = {}; }
      for (const row of grades.filter(item => item.isNewSubject)) registry[normalizeCourseCode(row.courseCode)] = { courseName: row.courseName, credits: row.credits, courseCategory: row.courseCategory, creditStatus: "TESTER_CONFIRMED" };
      localStorage.setItem(key, JSON.stringify(registry));
      const result = await onApply(pendingReview.semester, grades, pendingReview.session, pendingReview.document, pendingReview.url, pendingReview.attemptNumber);
      if (result === false) {
        setNotice("The result could not be saved. Your academic profile was not changed.");
        return;
      }
      if (pendingReview.attemptNumber === 1) setAppliedResult({rows: grades, session: pendingReview.session, document: pendingReview.document, url: pendingReview.url, semester: pendingReview.semester});
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

  return <>
    <button type="button" className={"sp-entry-mode " + (open ? "selected" : "")} onClick={() => void openArchive()} aria-expanded={open}>
      <span>ONLINE FETCHING</span>
      <strong>Fetch official results</strong>
      <small>{loadingSessions ? "Loading GECA archive…" : sessions.length ? sessions.length + " examination sessions available" : "Fetch results for Semester {selectedSemester}"}</small>
    </button>
    {open && <section className="sp-online-result-panel sp-online-result-inline" role="dialog" aria-modal="true" aria-label={reExamMode?"Choose re-examination session":"Choose examination session"} aria-busy={loadingSessions || Boolean(loadingSessionId)}>
      <div className="sp-online-result-head">
        <div className="sp-online-result-heading"><span>GECA · RESULT IMPORT</span><h3>{reExamMode ? "Fetch your re-examination marks" : "Select an examination session"}</h3>{reExamMode&&reExamTargetCourseCode&&<div className="sp-reexam-subject-callout"><b>! Backlog subject selected</b><strong>{subjects.find(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(reExamTargetCourseCode))?.name||reExamTargetCourseCode}</strong><span>Choose the examination session in which you appeared for this subject. Gradly will update this subject’s grade only.</span></div>}<p>Choose the examination in which you appeared for Semester {selectedSemester}. We’ll scan its linked department result PDFs for enrollment <b>{enrollmentNumber}</b>. Review the official GECA result before applying grades to this isolated tester workspace.</p></div>
        <button type="button" onClick={() => { if (reExamMode) onCancelReExam?.(); setReExamMode(false); setOpen(false); }} aria-label="Close online result archive">×</button>
      </div>
      {(loadingSessions || Boolean(loadingSessionId)) && createPortal(<div className="sp-online-loading-backdrop" role="presentation">
        <div className="sp-online-loading-dialog" role="status" aria-live="polite" aria-label={loadingSessions ? "Loading GECA examination archive" : "Scanning GECA result PDFs"}>
          <div className="sp-online-loader-art" aria-hidden="true">
            <span className="sp-online-loader-orbit sp-online-loader-orbit-one" />
            <span className="sp-online-loader-orbit sp-online-loader-orbit-two" />
            <span className="sp-online-loader-core"><i /></span>
          </div>
          <span className="sp-online-loader-eyebrow">GRADLY · TESTER WORKSPACE</span>
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
{reExamMode && !reExamConfirmed && createPortal(<div className="sp-online-reexam-confirm" role="dialog" aria-modal="true" aria-label="Choose whether to fetch a re-examination result"><span className="sp-online-reexam-icon" aria-hidden="true">↗</span><strong>Are you fetching a re-examination result?</strong><p>Choose Yes only if you have applied for re-examination for this backlog subject. Gradly will then show the GECA re-exam sessions; your existing grade stays untouched unless a matching result is found.</p><div><button type="button" className="sp-online-reexam-no" onClick={() => { onCancelReExam?.(); setReExamMode(false); setReExamConfirmed(false); setOpen(false); }}>No, not now</button><button type="button" className="sp-online-reexam-yes" onClick={() => { setReExamConfirmed(true); void openArchive(); }}>Yes, fetch re-exam</button></div></div>, document.body)}{loadingSessions && <p className="sp-online-result-muted">Loading the current examination list from GECA…</p>}
      {!loadingSessions && reExamMode && sessions.length>0 && visibleSessions.length===0 && <p className="sp-online-result-muted">No re-examination sessions are currently listed in the GECA archive. Regular examination sessions are hidden in this view.</p>}
      {error && <p className="sp-online-result-error" role="alert">{error}</p>}
      {(!reExamMode || reExamConfirmed) && visibleSessions.length > 0 && <div className="sp-online-session-list">
        {visibleSessions.map(session => <button type="button" key={session.id} className={"sp-online-session " + (selectedSessionId === session.id ? "active" : "")} onClick={() => void inspectSession(session)} disabled={Boolean(loadingSessionId)}>
          <span><b>{session.title}</b><small>GECA examination result</small></span>
          <strong>{loadingSessionId === session.id ? "Scanning PDFs…" : selectedSessionId === session.id ? "Selected" : "Fetch grades →"}</strong>
        </button>)}
      </div>}
      {scan && <div className="sp-online-scan-result">
        
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
      {pendingReview && createPortal(<div style={{position:"fixed",inset:0,zIndex:100020,background:"rgba(8,15,24,.78)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Review official result grades"><section style={{background:"#fff",color:"#17231d",borderRadius:16,padding:22,width:"min(680px,100%)",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 25px 80px rgba(0,0,0,.35)"}}><small style={{fontWeight:800,color:"#167348"}}>GECA · RESULT REVIEW</small><h2 style={{margin:"8px 0"}}>Review your semester grades</h2><p style={{marginTop:0}}>Check the fetched grades against your official grade card. Newly detected subjects are added to the catalogue after you confirm their credits. If GECA has not published a grade online, select it manually here.</p>{pendingReview.rows.some(row=>!subjects.some(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(row.courseCode)))&&<p style={{margin:"10px 0",padding:"10px 12px",borderRadius:8,background:"#fff7e6",color:"#805400",fontSize:13}}>The official PDF includes course codes outside your selected curriculum. They are retained below as separate result subjects and will not be mapped to another course: <b>{[...new Set(pendingReview.rows.filter(row=>!subjects.some(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(row.courseCode))).map(row=>row.courseCode))].join(", ")}</b>.</p>}<div style={{borderTop:"1px solid #e4e9e5"}}>{pendingReview.rows.map((row,index)=>{const key=normalizeCourseCode(row.courseCode);const manual=!row.grade;return <div key={key+index} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 118px",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #e8ece9"}}><span><b>{row.courseName||row.courseCode}</b><small style={{display:"block",opacity:.65}}>{row.courseCode}{manual?" · Manual grade required":""}</small>{row.isNewSubject && <label style={{display:"block",marginTop:7,fontSize:12}}>New subject · detected credits (edit if needed)<input type="number" min="0.5" max="30" step="0.5" value={creditEdits[key] ?? String(row.credits ?? 3)} onChange={event=>setCreditEdits(current=>({...current,[key]:event.target.value}))} style={{display:"block",width:110,marginTop:4,padding:7,border:"1px solid #cbd5ce",borderRadius:7}} /></label>}</span><select aria-label={"Grade for "+(row.courseName||row.courseCode)} value={reviewGrades[key]||""} onChange={event=>setReviewGrades(current=>({...current,[key]:event.target.value}))} style={{width:"100%",padding:9,borderRadius:8,border:"1px solid #cbd5ce",background:"#fff",color:"#17231d"}}><option value="">Select grade</option>{["A++","A+","A","B+","B","C+","C","D"].map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></div>})}</div>{error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}><button type="button" onClick={()=>{setPendingReview(null);setError("");setNotice("Result review cancelled. No grades were saved.");}} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #cbd5ce",background:"#fff",color:"#17231d"}}>Cancel</button><button type="button" onClick={()=>void confirmPendingReview()} disabled={savingReview || !pendingReview.rows.every(row=>["A++","A+","A","B+","B","C+","C","D"].includes((reviewGrades[normalizeCourseCode(row.courseCode)]||"").toUpperCase()))} style={{padding:"10px 16px",border:0,borderRadius:8,background:"#172d21",color:"#fff",fontWeight:700,opacity:savingReview ? 0.72 : 1}}>{savingReview?"Saving grades…":"Confirm and save grades"}</button></div></section></div>,document.body)}
      {appliedResult && createPortal(<div style={{position:"fixed",inset:0,zIndex:100010,background:"rgba(8,15,24,.72)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Tester grades saved"><section style={{background:"#fff",color:"#14251c",borderRadius:16,padding:26,width:"min(420px,100%)",textAlign:"center",boxShadow:"0 25px 80px rgba(0,0,0,.35)"}}><div style={{fontSize:34,color:"#14804b"}}>✓</div><h2 style={{margin:"8px 0"}}>Grades applied successfully</h2><p>Semester {appliedResult.semester} grades have been saved in this temporary tester session.</p><button type="button" onClick={()=>setAppliedResult(null)} style={{display:"block",width:"100%",marginTop:14,padding:12,border:0,borderRadius:10,background:"#15271d",color:"#fff",fontWeight:800}}>Done</button></section></div>,document.body)}

      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Tester preview · saved only in this isolated browser session</span></div>
    </section>}
    
  </>;
}
