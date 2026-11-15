import { useState } from "react";
import { createPortal } from "react-dom";

type TesterSubject = { name: string; credits: number; grade: string; courseCode?: string; electiveKind?: string | null };
type ResultGrade = { courseCode: string; grade: string };
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
type Props = {
  apiBase: string;
  testerToken: string;
  enrollmentNumber: string;
  selectedSemester: number;
  subjects: TesterSubject[];
  onApply: (semester: number, grades: ResultGrade[], sessionTitle: string, documentTitle: string, sourceUrl: string) => void;
};

export default function TesterOnlineResultSync({
  apiBase, testerToken, enrollmentNumber, selectedSemester, subjects, onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ResultSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [scan, setScan] = useState<MatchResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadingSession = sessions.find(session => session.id === loadingSessionId);

  async function openArchive() {
    setOpen(value => !value);
    if (open || sessions.length) return;
    setLoadingSessions(true);
    setError("");
    try {
      const response = await fetch(apiBase + "/api/tester/results/sessions", {
        headers: { Authorization: "Bearer " + testerToken },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load GECA examination sessions.");
      setSessions(Array.isArray(body.sessions) ? body.sessions : []);
      if (!Array.isArray(body.sessions) || !body.sessions.length) setError("No examination sessions were listed by the GECA portal.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load GECA examination sessions.");
    } finally {
      setLoadingSessions(false);
    }
  }

  async function inspectSession(session: ResultSession) {
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
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to inspect this examination session.");
      setScan(body as MatchResponse);
      if (!body.matches?.length && Number(body.enrollmentHits) > 0) setNotice("The enrollment number appears in " + body.enrollmentHits + " PDF(s), but the grade columns could not be read reliably. The parser diagnostics are shown below; no grades were applied.");
      else if (!body.matches?.length) setNotice("Enrollment not found in the scanned PDFs. " + body.documentsScanned + " PDFs were checked.");
      else setNotice("Found " + body.matches.length + " result PDF(s). Enrollment text was detected in " + body.enrollmentHits + " PDF(s). Select the matching semester PDF to preview and apply.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to inspect this examination session.");
    } finally {
      setLoadingSessionId("");
    }
  }

  function applyDocument(document: ResultDocument, sessionTitle: string) {
    if (!document.semester || document.semester !== selectedSemester) {
      setNotice("This PDF belongs to Semester " + (document.semester || "unknown") + ". Change the workspace semester to match before applying the grades.");
      return;
    }
    const knownCodes = new Set(subjects.map(subject => String(subject.courseCode || "").trim().toUpperCase()).filter(Boolean));
    const applicable = document.grades.filter(row => knownCodes.has(row.courseCode.toUpperCase()));
    if (!applicable.length) {
      setError("The PDF contains grades, but none of its course codes match the subjects loaded for Semester " + selectedSemester + ".");
      return;
    }
    onApply(document.semester, applicable, sessionTitle, document.title, document.url);
    setNotice("Applied " + applicable.length + " matched subject grade(s) to the isolated Tester workspace. Review the SGPA completeness status below.");
    setError("");
  }

  const gradeMap = new Map<string, string>();
  scan?.matches.filter(document => document.semester === selectedSemester).forEach(document => document.grades.forEach(row => gradeMap.set(row.courseCode.toUpperCase(), row.grade)));
  const previewSubjects = subjects.filter(subject => subject.name.trim() && Number(subject.credits) > 0);
  const previewRows = previewSubjects.map(subject => ({
    ...subject,
    nextGrade: gradeMap.get(String(subject.courseCode || "").trim().toUpperCase()) || subject.grade,
  }));
  const gradedRows = previewRows.filter(subject => ["A++", "A+", "A", "B+", "B", "C+", "C", "D"].includes(subject.nextGrade));
  const previewCredits = gradedRows.reduce((sum, subject) => sum + Number(subject.credits), 0);
  const previewPoints = gradedRows.reduce((sum, subject) => {
    const points: Record<string, number> = { "A++":10, "A+":9, A:8, "B+":7, B:6, "C+":5, C:4, D:0 };
    return sum + Number(subject.credits) * points[subject.nextGrade];
  }, 0);
  const previewSgpa = previewCredits > 0 ? (previewPoints / previewCredits).toFixed(2) : null;
  const hasUnselectedElective = subjects.some(subject => Boolean(subject.electiveKind) && !subject.name.trim());
  const complete = previewRows.length > 0 && !hasUnselectedElective && gradedRows.length === previewRows.length;

  return <>
    <button type="button" className={"sp-entry-mode " + (open ? "selected" : "")} onClick={() => void openArchive()} aria-expanded={open}>
      <span>ONLINE FETCHING</span>
      <strong>Fetch official results</strong>
      <small>{loadingSessions ? "Loading GECA archive…" : sessions.length ? sessions.length + " examination sessions available" : "Browse GECA result archive"}</small>
    </button>
    {open && <section className="sp-online-result-panel" aria-busy={loadingSessions || Boolean(loadingSessionId)}>
      <div className="sp-online-result-head">
        <div><span>GECA · OFFICIAL RESULT ARCHIVE</span><h3>Choose an examination session</h3><p>Click a session to scan its linked department and semester PDFs for enrollment <b>{enrollmentNumber}</b>. This Tester workflow changes only the isolated test profile.</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close online result archive">×</button>
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
        </div>
      </div>, document.body)}
{loadingSessions && <p className="sp-online-result-muted">Loading the current examination list from GECA…</p>}
      {error && <p className="sp-online-result-error" role="alert">{error}</p>}
      {sessions.length > 0 && <div className="sp-online-session-list">
        {sessions.map(session => <button type="button" key={session.id} className={"sp-online-session " + (selectedSessionId === session.id ? "active" : "")} onClick={() => void inspectSession(session)} disabled={Boolean(loadingSessionId)}>
          <span><b>{session.title}</b><small>GECA examination result</small></span>
          <strong>{loadingSessionId === session.id ? "Scanning PDFs…" : selectedSessionId === session.id ? "Selected" : "Scan →"}</strong>
        </button>)}
      </div>}
      {scan && <div className="sp-online-scan-result">
        <div className="sp-online-scan-meta"><b>{scan.session.title}</b><span>{scan.documentsScanned} PDFs scanned · {scan.enrollmentHits} enrollment hits · {scan.matches.length} parsed · {scan.parseFailures} parse issues</span></div>
        {!scan.matches.length && <p className="sp-online-result-muted">{scan.enrollmentHits > 0 ? "The enrollment was found, but the result table could not be parsed. No grades have been applied." : "No exact enrollment match was found in this examination session."}</p>}
        {scan.matches.map((document,index) => {
          const matchingSubjects = document.grades.filter(row => subjects.some(subject => String(subject.courseCode || "").trim().toUpperCase() === row.courseCode.toUpperCase()));
          const canApply = document.semester === selectedSemester && matchingSubjects.length > 0;
          return <article className="sp-online-match" key={document.url}>
            <div className="sp-online-match-top"><div><b>{document.title}</b><small>{document.scheme || "Scheme not detected"} · {document.semester ? "Semester " + document.semester : "Semester not detected"} · {matchingSubjects.length} curriculum code matches</small></div><span>{document.grades.length} grades</span></div>
            <div className="sp-online-grade-list">{document.grades.slice(0,12).map(row=><span key={row.courseCode}><b>{row.courseCode}</b>{row.grade}</span>)}{document.grades.length>12&&<small>+{document.grades.length-12} more</small>}</div>
            <button type="button" className="sp-online-apply" disabled={!canApply} onClick={() => applyDocument(document,scan.session.title)}>
              {canApply ? "Apply grades to Semester " + selectedSemester : document.semester ? "Switch to Semester " + document.semester + " to apply" : "Cannot apply · semester not detected"}
            </button>
          </article>;
        })}
        {scan.matches.some(document => document.semester === selectedSemester) && <div className="sp-online-preview">
          <div><span>PREVIEW · EXISTING GRADES + MATCHED PDF</span><strong>{previewSgpa ? previewSgpa + " SGPA" : "SGPA not calculable yet"}</strong></div>
          <p>{gradedRows.length} of {previewRows.length} subjects have recognised grades. {complete ? "All loaded subjects are graded; the SGPA preview is complete." : "Missing grades will be retained from existing tester data where available. SGPA is not final until every loaded subject has a recognised grade."}</p>
        </div>}
      </div>}
      {notice && <p className="sp-online-result-notice" role="status">{notice}</p>}
      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Read-only portal scan · local Tester profile update only</span></div>
    </section>}
  </>;
}
