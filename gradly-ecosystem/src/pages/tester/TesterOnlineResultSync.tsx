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
  onApply: (semester: number, grades: ResultGrade[], sessionTitle: string, documentTitle: string, sourceUrl: string, attemptNumber: number) => void | Promise<void>;
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
    if (open || sessions.length) return;
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
    setOpen(true);
    setScan(null);
    setSelectedSessionId("");
    if (!sessions.length && !loadingSessions) void openArchive();
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
        body: JSON.stringify({ enrollmentNumber, selectedSemester }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to inspect this examination session.");
      setScan(body as MatchResponse);
      if (!body.matches?.length && Number(body.enrollmentHits) > 0) setNotice("The enrollment number appears in " + body.enrollmentHits + " PDF(s), but the grade columns could not be read reliably. The parser diagnostics are shown below; no grades were applied.");
      else if (!body.matches?.length) setNotice("Enrollment not found in the scanned PDFs. " + body.documentsScanned + " PDFs were checked.");
      else setNotice("Found " + body.matches.length + " result PDF(s). Enrollment text was detected in " + body.enrollmentHits + " PDF(s). Select the matching semester PDF to preview and apply.");
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Unable to inspect this examination session.");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoadingSessionId("");
    }
  }

  function applyDocument(document: ResultDocument, sessionTitle: string) {
    if (!document.semester || document.semester !== selectedSemester) {
      setNotice("This PDF belongs to Semester " + (document.semester || "unknown") + ". Change the workspace semester to match before applying the grades.");
      return;
    }
    const targetCode = normalizeCourseCode(reExamTargetCourseCode);
    const applicable = document.grades
      .filter(row => row.courseCode.trim() && ["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()))
      .filter(row => !reExamMode || !targetCode || normalizeCourseCode(row.courseCode) === targetCode)
      .map(row => {
        const code = normalizeCourseCode(row.courseCode);
        const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
        const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
        return { ...row, courseName: existing?.name || catalog?.name || row.courseName || row.courseCode, credits: Number(existing?.credits || catalog?.credits || row.credits || 0) };
      });
    if (!applicable.length || applicable.some(row => !row.credits || !row.courseName.trim())) {
      setError(reExamMode && reExamTargetCourseCode ? "This re-examination PDF does not contain the selected backlog subject. No grades were changed." : "The official PDF did not provide enough course details to save this result. No academic data was changed.");
      return;
    }
    void onApply(document.semester, applicable, sessionTitle, document.title, document.url, reExamMode ? 2 : 1);
    setNotice(reExamMode ? "Re-examination result is being applied to your active backlog subjects…" : "Official result is being saved directly to your academic profile…");
    setError("");
  }



  return <>
    <button type="button" className={"sp-entry-mode " + (open ? "selected" : "")} onClick={() => void openArchive()} aria-expanded={open}>
      <span>ONLINE FETCHING</span>
      <strong>Fetch official results</strong>
      <small>{loadingSessions ? "Loading GECA archive…" : sessions.length ? sessions.length + " examination sessions available" : "Browse GECA result archive"}</small>
    </button>
    {open && createPortal(<div className="sp-online-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="sp-online-result-panel sp-online-result-modal" role="dialog" aria-modal="true" aria-label={reExamMode?"Choose re-examination session":"Choose examination session"} aria-busy={loadingSessions || Boolean(loadingSessionId)}>
      <div className="sp-online-result-head">
        <div><span>GECA · OFFICIAL RESULT ARCHIVE</span><h3>{reExamMode ? "Fetch your re-examination marks" : "Choose an examination session"}</h3>{reExamMode&&reExamTargetCourseCode&&<div className="sp-reexam-subject-callout"><b>★ Backlog subject selected</b><strong>{subjects.find(subject=>normalizeCourseCode(subject.courseCode)===normalizeCourseCode(reExamTargetCourseCode))?.name||reExamTargetCourseCode}</strong><span>Choose the examination session in which you appeared for this subject. Gradly will update this subject’s grade only.</span></div>}<p>Click a session to scan its linked department and semester PDFs for enrollment <b>{enrollmentNumber}</b>. This Tester workflow changes only the isolated test profile.</p></div>
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
{loadingSessions && <p className="sp-online-result-muted">Loading the current examination list from GECA…</p>}
      {!loadingSessions && reExamMode && sessions.length>0 && visibleSessions.length===0 && <p className="sp-online-result-muted">No re-examination sessions are currently listed in the GECA archive. Regular examination sessions are hidden in this view.</p>}
      {error && <p className="sp-online-result-error" role="alert">{error}</p>}
      {visibleSessions.length > 0 && <div className="sp-online-session-list">
        {visibleSessions.map(session => <button type="button" key={session.id} className={"sp-online-session " + (selectedSessionId === session.id ? "active" : "")} onClick={() => void inspectSession(session)} disabled={Boolean(loadingSessionId)}>
          <span><b>{session.title}</b><small>GECA examination result</small></span>
          <strong>{loadingSessionId === session.id ? "Scanning PDFs…" : selectedSessionId === session.id ? "Selected" : "Scan →"}</strong>
        </button>)}
      </div>}
      {scan && <div className="sp-online-scan-result">
        <div className="sp-online-scan-meta"><b>{scan.session.title}</b><span>{scan.documentsScanned} PDFs scanned · {scan.enrollmentHits} enrollment hits · {scan.matches.length} result found · {scan.parseFailures} parse issues</span></div>
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
            <button type="button" className="sp-online-apply" disabled={!canApply} onClick={() => applyDocument(document,scan.session.title)}>
              {canApply ? (reExamMode ? "Apply re-exam result to profile" : "Update academic profile") : "Semester does not match"}
            </button>

            {reExamMode && <p className="sp-online-reexam-mode">Re-examination mode · fetched grades will update the existing backlog attempt without replacing unrelated subjects.</p>}
          </article>;
        })}

      </div>}
      {notice && <p className="sp-online-result-notice" role="status">{notice}</p>}
      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Tester preview · saved to this isolated browser session</span></div>
    </section></div>, document.body)}
  </>;
}
