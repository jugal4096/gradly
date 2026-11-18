import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TesterSubject = { name: string; credits: number; grade: string; courseCode?: string; electiveKind?: string | null };
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
  }, [reExamTargetCourseCode]);

  async function inspectSession(session: ResultSession) {
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
      const matchingDocument = (body.matches || []).find((document: ResultDocument) => document.semester === selectedSemester);
      if (matchingDocument) await applyDocument(matchingDocument, session.title);
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
    if (!document.semester || document.semester !== selectedSemester) {
      setNotice("This PDF belongs to Semester " + (document.semester || "unknown") + ". Change the workspace semester to match before applying the grades.");
      return;
    }
    const targetCode = normalizeCourseCode(reExamTargetCourseCode);
    const sourceRows = document.grades
      .filter(row => row.courseCode.trim() && ["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()))
      .filter(row => !reExamMode || !targetCode || normalizeCourseCode(row.courseCode) === targetCode);

    const subjectCodes = subjects.map(subject => normalizeCourseCode(subject.courseCode)).filter(Boolean);
    const catalogueCodes = new Set(catalogue.map(item => normalizeCourseCode(item.code)).filter(Boolean));
    const expectedCodes = new Set(subjectCodes.length ? subjectCodes : [...catalogueCodes]);
    const counts = new Map<string, number>();
    sourceRows.forEach(row => {
      const code = normalizeCourseCode(row.courseCode);
      counts.set(code, (counts.get(code) || 0) + 1);
    });
    const duplicateCodes = new Set([...counts].filter(([, count]) => count > 1).map(([code]) => code));
    // Never discard rows because their course codes are absent from the current curriculum.
    // Official result PDFs are the source of truth; curriculum is only a mismatch reference.
    const unknownRows = sourceRows.filter(row => expectedCodes.size && !expectedCodes.has(normalizeCourseCode(row.courseCode)));
    const missingCodes = reExamMode ? [] : [...expectedCodes].filter(code => !counts.has(code));
    const mismatchParts = [
      unknownRows.length ? "official courses not in current curriculum: " + [...new Set(unknownRows.map(row => row.courseCode))].join(", ") : "",
      missingCodes.length ? "curriculum courses not detected in PDF: " + missingCodes.join(", ") : "",
    ].filter(Boolean);
    if (duplicateCodes.size) {
      setError("The result parser detected duplicate course codes (" + [...duplicateCodes].join(", ") + "). No grades were applied to avoid overwriting the wrong subject.");
      setNotice("");
      return;
    }

    const applicable = sourceRows.map(row => {
      const code = normalizeCourseCode(row.courseCode);
      const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
      const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
      const parsedCredits = Number(row.credits || 0);
      const fallbackCredits = /LAB|PRACTICAL/i.test(code) ? 1 : 3;
      return { ...row, courseName: existing?.name || catalog?.name || row.courseName || row.courseCode, credits: Number(existing?.credits || catalog?.credits || parsedCredits || fallbackCredits) };
    });
    if (!applicable.length || applicable.some(row => !row.credits || !row.courseName.trim())) {
      setError(reExamMode && reExamTargetCourseCode ? "This re-examination PDF does not contain the selected backlog subject. No grades were changed." : "No valid, matching subjects were found in this result. No grades were changed.");
      return;
    }

    setError("");
    setNotice("Saving verified grades…");
    try {
      const applyResult = await onApply(document.semester, applicable, sessionTitle, document.title, document.url, reExamMode ? 2 : 1);
      if (applyResult === false) {
        setNotice("The result could not be applied to your profile. Check the message and try again.");
        return;
      }
      const appliedCount = applicable.length;
      const warning = mismatchParts.length ? " Review needed — " + mismatchParts.join("; ") : "";
      setNotice((reExamMode ? "Re-examination grades added successfully." : "Grades added successfully.") + " " + appliedCount + " subject" + (appliedCount === 1 ? " was" : "s were") + " applied and checked for mismatches." + warning);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the fetched grades. Please retry.");
      setNotice("");
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
        <div><span>GECA · RESULT IMPORT</span><h3>{reExamMode ? "Fetch your re-examination marks" : "Select an examination session"}</h3>{reExamMode&&reExamTargetCourseCode&&<div className="sp-reexam-subject-callout"><b>! Backlog subject selected</b><strong>{subjects.find(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(reExamTargetCourseCode))?.name||reExamTargetCourseCode}</strong><span>Choose the examination session in which you appeared for this subject. Gradly will update this subject’s grade only.</span></div>}<p>Choose the examination in which you appeared for Semester {selectedSemester}. We’ll scan its linked department result PDFs for enrollment <b>{enrollmentNumber}</b>. This Tester workflow changes only the isolated test profile.</p></div>
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
      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Tester preview · saved to this isolated browser session</span></div>
    </section>}
  </>;
}
