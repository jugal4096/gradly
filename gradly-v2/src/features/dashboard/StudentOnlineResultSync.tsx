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
  onApply: (semester: number, grades: ResultGrade[], sessionTitle: string, documentTitle: string, sourceUrl: string) => void;
};

export default function StudentOnlineResultSync({
  apiBase, curriculumId, getIdToken, enrollmentNumber, selectedSemester, subjects, onApply,
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
  const [selectedResultCourses, setSelectedResultCourses] = useState<Record<string, boolean>>({});

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
    setOpen(value => !value);
    if (open || sessions.length) return;
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
      const token = await getIdToken();
      const response = await fetch(apiBase + "/api/student/results/sessions/" + encodeURIComponent(session.id) + "/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ selectedSemester }),
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
    const applicable = document.grades
      .filter(row => row.courseCode.trim() && (selectedResultCourses[normalizeCourseCode(row.courseCode)] !== false || subjects.some(subject => normalizeCourseCode(subject.courseCode) === normalizeCourseCode(row.courseCode))) && ["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()))
      .map(row => {
        const code = normalizeCourseCode(row.courseCode);
        const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
        const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
        const useDefault = selectedResultCourses[code] === false && Boolean(existing);
        return { ...row, courseName: useDefault ? existing!.name : existing?.name || catalog?.name || row.courseName || "", credits: useDefault ? existing!.credits : Number(existing?.credits || catalog?.credits || row.credits || 0), useDefault };
      });
    if (!applicable.length) {
      setError("Select at least one valid course from the official result. No subjects were changed.");
      return;
    }
    onApply(document.semester, applicable, sessionTitle, document.title, document.url);
    setNotice("Prepared " + applicable.length + " selected official result courses. The result course list will replace default subjects absent from the PDF.");
    setError("");
  }

  const gradeMap = new Map<string, string>();
  scan?.matches.filter(document => document.semester === selectedSemester).forEach(document => document.grades.forEach(row => gradeMap.set(normalizeCourseCode(row.courseCode), row.grade.toUpperCase())));
  const previewSubjects = subjects.filter(subject => subject.name.trim() && Number(subject.credits) > 0);
  const previewRows = previewSubjects.map(subject => ({
    ...subject,
    nextGrade: gradeMap.get(normalizeCourseCode(subject.courseCode)) || subject.grade,
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
        <div><span>GECA · OFFICIAL RESULT ARCHIVE</span><h3>Choose an examination session</h3><p>Click a session to scan its linked department and semester PDFs for enrollment <b>{enrollmentNumber}</b>. Review the official GECA result before applying grades to your student workspace.</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close online result archive">×</button>
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
        {scan.matches.map(document => {
          const knownCodes = new Set(subjects.map(subject => normalizeCourseCode(subject.courseCode)).filter(Boolean));
          const resultRows = document.grades.map(row => {
            const code = normalizeCourseCode(row.courseCode);
            const existing = subjects.find(subject => normalizeCourseCode(subject.courseCode) === code);
            const catalog = catalogue.find(item => normalizeCourseCode(item.code) === code);
            return { ...row, code, courseName: existing?.name || catalog?.name || row.courseName || "Course name not found in the curriculum catalogue", credits: Number(existing?.credits || catalog?.credits || row.credits || 0), matched: knownCodes.has(code), selected: selectedResultCourses[code] !== false };
          });
          const matchingCount = resultRows.filter(row => row.matched).length;
          const selectedCount = resultRows.filter(row => row.selected).length;
          const canApply = document.semester === selectedSemester && resultRows.some(row => row.selected || row.matched);
          return <article className="sp-online-match" key={document.url}>
            <div className="sp-online-match-top"><div><b>{document.title}</b><small>{document.scheme || "Scheme not detected"} · {document.semester ? "Semester " + document.semester : "Semester not detected"} · {matchingCount} curriculum matches · {resultRows.length - matchingCount} mismatches</small></div><span>{document.grades.length} courses</span></div>
            <div className="sp-online-result-courses">
              <strong>Official result courses · {selectedCount} selected</strong>
              {resultRows.map(row => <div className="sp-online-course-row" key={row.courseCode}>
                <div className="sp-online-course-details">
                  <div className="sp-online-course-code"><b>{row.courseCode}</b><span className={row.matched ? "is-matched" : "is-mismatched"}>{row.matched ? "Curriculum match" : "Curriculum mismatch"}</span></div>
                  <strong>{row.courseName}</strong>
                  <small>Grade {row.grade}{row.credits > 0 ? " · " + row.credits + " credits" : " · Credits need confirmation"} · {row.selected ? "Official result selected" : row.matched ? "Default curriculum retained" : "Not selected"}</small>
                </div>
                <button type="button" className={row.selected ? "is-selected" : ""} onClick={() => setSelectedResultCourses(current => ({ ...current, [row.code]: current[row.code] === undefined ? false : !current[row.code] }))}>{row.selected ? (row.matched ? "Use default course" : "Remove course") : "Set as per Result"}</button>
              </div>)}
            </div>
            <button type="button" className="sp-online-apply" disabled={!canApply} onClick={() => applyDocument(document,scan.session.title)}>
              {canApply ? "Apply selected result courses to Semester " + selectedSemester : document.semester ? "Select at least one course" : "Cannot apply · semester not detected"}
            </button>
          </article>;
        })}
        {scan.matches.some(document => document.semester === selectedSemester) && <div className="sp-online-preview">
          <div><span>PREVIEW · EXISTING GRADES + MATCHED PDF</span><strong>{previewSgpa ? previewSgpa + " SGPA" : "SGPA not calculable yet"}</strong></div>
          <p>{gradedRows.length} of {previewRows.length} subjects have recognised grades. {complete ? "All loaded subjects are graded; the SGPA preview is complete." : "Missing grades will be retained from existing student grades where available. SGPA is not final until every loaded subject has a recognised grade."}</p>
        </div>}
      </div>}
      {notice && <p className="sp-online-result-notice" role="status">{notice}</p>}
      <div className="sp-online-result-foot"><span>Source: <a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">GECA Examination Result</a></span><span>Read-only portal scan · grades apply only after your review</span></div>
    </section>}
  </>;
}
