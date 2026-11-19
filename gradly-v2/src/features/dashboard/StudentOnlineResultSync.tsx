import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./StudentOnlineResultSync.css";

type StudentSubject = { name: string; credits: number; grade: string; courseCode?: string; electiveKind?: string | null };
type ResultGrade = { courseCode: string; grade: string; courseName?: string; credits?: number; useDefault?: boolean };
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
  const [reviewGrades, setReviewGrades] = useState<Record<string,string>>({});
  const [reportRow, setReportRow] = useState<ResultGrade | null>(null);
  const [reportKind, setReportKind] = useState("Incorrect grade");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const [reExamMode, setReExamMode] = useState(false);
  const [reExamConfirmed, setReExamConfirmed] = useState(false);
  const visibleSessions = reExamMode ? sessions.filter(session => /re[\s-]*exam|supplementary|backlog|atkt|additional examination/i.test(session.title)) : sessions;

  useEffect(() => {
    if (!curriculumId || !selectedSemester) { setCatalogue([]); return; }
    let cancelled = false;
    void fetch(apiBase + "/api/academic/curricula/" + encodeURIComponent(curriculumId) + "/semesters/" + selectedSemester + "/subjects?includeAllBranches=true")
      .then(response => response.json().then(body => ({ response, body })))
      .then(({ response, body }) => {
        if (!cancelled && response.ok && Array.isArray(body.data)) {
          setCatalogue(body.data.map((item: any) => ({ code: String(item.code || ""), name: String(item.name || ""), credits: Number(item.credits || 0) })));
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

    const targetCode = normalizeCourseCode(reExamTargetCourseCode);
    const sourceRows = document.grades
      .filter(row => row.courseCode.trim())
      .filter(row => !reExamMode || !targetCode || normalizeCourseCode(row.courseCode) === targetCode);
    const invalidGradeRows = sourceRows.filter(row => !["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));
    if (invalidGradeRows.length) {
      setError("The PDF contains course rows with grades Gradly could not recognise (" + invalidGradeRows.map(row => row.courseCode + ": " + row.grade).join(", ") + "). No grades were applied; the result needs parser review.");
      setNotice("");
      return;
    }

    const subjectCodes = subjects.map(subject => normalizeCourseCode(subject.courseCode)).filter(Boolean);
    // Reconcile against the student's selected subjects, not every department's
    // elective catalogue. GECA's exam PDF may use the legacy MEOE1040 code.
    const expectedCodes = new Set([...subjectCodes, "CEHS1030", "INHS1020", "INMC2010"]);
    const counts = new Map<string, number>();
    sourceRows.forEach(row => {
      const code = normalizeCourseCode(row.courseCode);
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    const duplicateCodes = new Set([...counts].filter(([, count]) => count > 1).map(([code]) => code));
    const knownLegacyCodes = new Set(["MEOE1040"]);
    const unknownRows = sourceRows.filter(row => {
      const code = normalizeCourseCode(row.courseCode);
      return expectedCodes.size && !expectedCodes.has(code) && !knownLegacyCodes.has(code);
    });
    const mismatchParts = unknownRows.length
      ? ["official courses not in the selected curriculum: " + [...new Set(unknownRows.map(row => row.courseCode))].join(", ")]
      : [];
    if (!reExamMode && mismatchParts.length) {
      setError("Result review required. No grades were applied because the PDF contains unexpected course codes: " + mismatchParts.join("; ") + ". Please verify the official result PDF.");
      setNotice("");
      return;
    }
    if (duplicateCodes.size) {
      setError("The result parser detected duplicate course codes (" + [...duplicateCodes].join(", ") + "). No grades were applied to avoid overwriting the wrong subject.");
      setNotice("");
      return;
    }
    // MEOE1040 is the legacy exam code for Entrepreneurship Development.
    // The student selected the Mechanical option (ME2023), so do not import a
    // parser-inferred grade from this row; require manual grade-card entry.
    const mappedRows = sourceRows.filter(row => normalizeCourseCode(row.courseCode) !== "MEOE1040").map(row => {
      const code = normalizeCourseCode(row.courseCode);
      const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
      const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
      const knownNames: Record<string,string> = {
        "CEHS1030":"Constitution of India and Professional Ethics",
        "INHS1020":"Universal Human Values",
        "INMC2010":"Environmental Studies",
      };
      const parsedCredits = Number(row.credits || 0);
      const fallbackCredits = /LAB|PRACTICAL/i.test(code) ? 1 : 3;
      return { ...row, courseName: existing?.name || catalog?.name || knownNames[code] || row.courseName || row.courseCode, credits: Number(existing?.credits || catalog?.credits || parsedCredits || fallbackCredits) };
    });
    // Preserve selected courses whose grades are absent from the online PDF.
    // Blank grades are entered by the student in the review step, never
    // converted into D or another failure grade.
    if (!reExamMode) {
      const present = new Set(mappedRows.map(row => normalizeCourseCode(row.courseCode)));
      for (const subject of subjects) {
        const code = normalizeCourseCode(subject.courseCode);
        if (!code || !subject.name.trim() || !Number.isFinite(subject.credits) || subject.credits <= 0 || present.has(code)) continue;
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
    if (!applicable.length || applicable.some(row => !row.credits || !row.courseName.trim())) {
      setError(reExamMode && reExamTargetCourseCode ? "This re-examination PDF does not contain the selected backlog subject. No grades were changed." : "No valid, matching subjects were found in this result. No grades were changed.");
      return;
    }

    setError("");
    setNotice("");
    if (reExamMode) {
      try {
        const applyResult = await onApply(targetSemester, applicable, sessionTitle, document.title, document.url, 2);
        if (applyResult === false) { setNotice("The re-examination result could not be applied. Check the message and try again."); return; }
        setAppliedResult({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester});
        setNotice("Re-examination grades added successfully.");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not save the re-examination grade. Please retry.");
      }
      return;
    }
    setReviewGrades(Object.fromEntries(applicable.map(row => [normalizeCourseCode(row.courseCode), row.grade || ""])));
    setPendingReview({rows: applicable, session: sessionTitle, document: document.title, url: document.url, semester: targetSemester, attemptNumber: 1});
    setNotice("Review fetched grades. Any subject without an online grade needs a manual grade from your grade card before saving.");
  }



  async function confirmPendingReview() {
    if (!pendingReview) return;
    const grades = pendingReview.rows.map(row => ({
      ...row,
      grade: reviewGrades[normalizeCourseCode(row.courseCode)] || "",
    }));
    const missing = grades.filter(row => !["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));
    if (missing.length) {
      setError("Enter a grade for every subject before saving. Missing: " + missing.map(row => row.courseName || row.courseCode).join(", "));
      return;
    }
    setError("");
    setNotice("Saving reviewed grades…");
    try {
      const result = await onApply(pendingReview.semester, grades, pendingReview.session, pendingReview.document, pendingReview.url, pendingReview.attemptNumber);
      if (result === false) {
        setNotice("The result could not be saved. Your academic profile was not changed.");
        return;
      }
      setAppliedResult({rows: grades, session: pendingReview.session, document: pendingReview.document, url: pendingReview.url, semester: pendingReview.semester});
      setPendingReview(null);
      setNotice("Reviewed grades saved successfully. " + grades.length + " subjects were applied.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the reviewed grades. Please retry.");
      setNotice("");
    }
  }

  async function submitMismatchReport() {
    if (!reportRow || reportDetails.trim().length < 10) { setReportMessage("Please add at least 10 characters explaining the mismatch."); return; }
    setReportBusy(true); setReportMessage("");
    try {
      const token = await getIdToken();
      const message = ["OFFICIAL RESULT MISMATCH REPORT","Issue: " + reportKind,"Semester: " + (appliedResult?.semester || selectedSemester),"Course code: " + (reportRow.courseCode || "Not detected"),"Subject: " + (reportRow.courseName || reportRow.courseCode || "Unknown subject"),"Fetched grade: " + reportRow.grade,"Examination session: " + (appliedResult?.session || "Unknown"),"Result PDF: " + (appliedResult?.document || "Unknown"),"Source: " + (appliedResult?.url || "GECA"),"Student explanation: " + reportDetails.trim()].join("\n");
      const response = await fetch(apiBase + "/api/student/syllabus-feedback", {method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({requestType:"SYLLABUS_FEEDBACK",semesterNumber:appliedResult?.semester||selectedSemester,subjectName:"Result mismatch · "+(reportRow.courseName||reportRow.courseCode||"Subject"),message})});
      const body=await response.json();
      if(!response.ok) throw new Error(body.message||"Unable to submit your report.");
      setReportMessage("Report submitted to department review. The department can forward it to Super Admin.");
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
{reExamMode && !reExamConfirmed && <div className="sp-online-reexam-confirm" role="group" aria-label="Re-examination confirmation"><strong>Have you applied for re-examination?</strong><p>Confirm before choosing an examination session for this backlog subject.</p><div><button type="button" className="sp-online-reexam-no" onClick={() => { onCancelReExam?.(); setReExamMode(false); setReExamConfirmed(false); setOpen(false); }}>No</button><button type="button" className="sp-online-reexam-yes" onClick={() => { setReExamConfirmed(true); void openArchive(); }}>Yes, show sessions</button></div></div>}{loadingSessions && <p className="sp-online-result-muted">Loading the current examination list from GECA…</p>}
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
            <div className="sp-online-auto-apply-note">{canApply ? "Result auto-imported into your grade entry." : "Semester does not match your selected workspace."}</div>

            {reExamMode && <p className="sp-online-reexam-mode">Re-examination mode · fetched grades will update the existing backlog attempt without replacing unrelated subjects.</p>}
          </article>;
        })}

      </div>}
      {notice && <p className="sp-online-result-notice" role="status">{notice}</p>}
      {pendingReview && createPortal(<div style={{position:"fixed",inset:0,zIndex:100020,background:"rgba(8,15,24,.78)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Review official result grades"><section style={{background:"#fff",color:"#17231d",borderRadius:16,padding:22,width:"min(680px,100%)",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 25px 80px rgba(0,0,0,.35)"}}><small style={{fontWeight:800,color:"#167348"}}>GECA · RESULT REVIEW</small><h2 style={{margin:"8px 0"}}>Review your semester grades</h2><p style={{marginTop:0}}>Check the fetched grades against your official grade card. If GECA has not published a grade online, select it manually here. A missing online grade is not treated as a failure.</p><div style={{borderTop:"1px solid #e4e9e5"}}>{pendingReview.rows.map((row,index)=>{const key=normalizeCourseCode(row.courseCode);const manual=!row.grade;return <div key={key+index} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 118px",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #e8ece9"}}><span><b>{row.courseName||row.courseCode}</b><small style={{display:"block",opacity:.65}}>{row.courseCode}{manual?" · Manual grade required":""}</small></span><select aria-label={"Grade for "+(row.courseName||row.courseCode)} value={reviewGrades[key]||""} onChange={event=>setReviewGrades(current=>({...current,[key]:event.target.value}))} style={{width:"100%",padding:9,borderRadius:8,border:"1px solid #cbd5ce",background:"#fff",color:"#17231d"}}><option value="">Select grade</option>{["A++","A+","A","B+","B","C+","C","D"].map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></div>})}</div>{error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}><button type="button" onClick={()=>{setPendingReview(null);setError("");setNotice("Result review cancelled. No grades were saved.");}} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #cbd5ce",background:"#fff",color:"#17231d"}}>Cancel</button><button type="button" onClick={()=>void confirmPendingReview()} disabled={!pendingReview.rows.every(row=>["A++","A+","A","B+","B","C+","C","D"].includes((reviewGrades[normalizeCourseCode(row.courseCode)]||"").toUpperCase()))} style={{padding:"10px 16px",border:0,borderRadius:8,background:"#172d21",color:"#fff",fontWeight:700}}>Confirm and save grades</button></div></section></div>,document.body)}
      {appliedResult && createPortal(<div style={{position:"fixed",inset:0,zIndex:100010,background:"rgba(8,15,24,.72)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Official grades saved"><section style={{background:"#fff",color:"#14251c",borderRadius:16,padding:22,width:"min(560px,100%)",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 25px 80px rgba(0,0,0,.35)"}}><small style={{color:"#14804b",fontWeight:800}}>GRADLY · OFFICIAL RESULT SAVED</small><h2 style={{margin:"8px 0"}}>Grades applied successfully ✓</h2><p>Saved {appliedResult.rows.length} subject grades for Semester {appliedResult.semester}.</p><div style={{borderTop:"1px solid #e0e7e3"}}>{appliedResult.rows.map((row,index)=><div key={(row.courseCode||row.courseName||"row")+index} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"9px 0",borderBottom:"1px solid #e5eae7"}}><span><b>{row.courseName||row.courseCode}</b><small style={{display:"block",opacity:.65}}>{row.courseCode}</small></span><strong>{row.grade}</strong></div>)}</div><button type="button" onClick={()=>setAppliedResult(null)} style={{display:"block",width:"100%",marginTop:14,padding:12,border:0,borderRadius:10,background:"#15271d",color:"#fff",fontWeight:800}}>Done</button></section></div>,document.body)}

      {reportRow && <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(15,20,25,.45)",display:"grid",placeItems:"center",padding:16}} role="dialog" aria-modal="true" aria-label="Report result mismatch"><div style={{background:"white",color:"#20242a",borderRadius:16,padding:20,width:"min(480px,100%)",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><small>GECA · RESULT REVIEW</small><h3 style={{margin:"6px 0"}}>Report a mismatch</h3></div><button type="button" onClick={()=>{setReportRow(null);setReportMessage("");}} aria-label="Close">×</button></div>
        <p><b>{reportRow.courseName||reportRow.courseCode}</b> · {reportRow.courseCode} · Fetched grade: <b>{reportRow.grade}</b></p>
        <label style={{display:"block",margin:"10px 0"}}>What is incorrect?<select value={reportKind} onChange={e=>setReportKind(e.target.value)} style={{display:"block",width:"100%",marginTop:5,padding:10,borderRadius:8}}><option>Incorrect grade</option><option>Wrong subject mapping</option><option>Incorrect course code</option><option>Unexpected result</option><option>Other</option></select></label>
        <label style={{display:"block"}}>Details (minimum 10 characters)<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={4} placeholder="Explain what should be corrected…" style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:5,padding:10,borderRadius:8}}/></label>
        {reportMessage&&<p role="status" style={{fontSize:13}}>{reportMessage}</p>}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button type="button" onClick={()=>{setReportRow(null);setReportMessage("");}}>Cancel</button><button type="button" disabled={reportBusy||reportDetails.trim().length<10} onClick={()=>void submitMismatchReport()}>{reportBusy?"Submitting…":"Submit report"}</button></div>
      </div></div>}
      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Official result · one-step profile update</span></div>
    </section>}
    
  </>;
}
