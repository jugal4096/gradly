import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildExamTimeline, detectSchemeFamily, type ExamProfile } from "./exam-profile-intelligence";
import "./ExamProfileSetupPage.css";

type AcademicProfile = { institutionName?: string; programName?: string; branchName?: string; scheme?: string; semester?: string; admissionYear?: number | string; admissionMode?: string; totalSemesters?: number; entrySemester?: number; academicProfileConfirmed?: boolean };
type EseStatus = "NOT_APPEARED" | "AWAITING_RESULT" | "PASSED" | "BACKLOG";
type BacklogAttempt = { id: string; subject: string; session: string; status: "PLANNED" | "APPEARED" | "CLEARED" | "BACKLOG" };
type SemesterRecord = { eseStatus: EseStatus; backlogAttempts: BacklogAttempt[] };

const eseLabels: Record<EseStatus, string> = { NOT_APPEARED: "Not appeared yet", AWAITING_RESULT: "Result awaited", PASSED: "Passed", BACKLOG: "Backlog / failed" };
const makeAttempt = (): BacklogAttempt => ({ id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, subject: "", session: "After ESE", status: "PLANNED" });

export default function ExamProfileSetupPage() {
  const navigate = useNavigate();
  const academic: AcademicProfile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("gradly_student_profile") || "{}"); } catch { return {}; }
  }, []);
  const total = Math.max(1, Number(academic.totalSemesters) || (/mca|m\\.?tech/i.test(academic.programName || "") ? 4 : 8));
  const current = Number(academic.semester) || null;
  const maximumExamSemester = current === null ? 0 : Math.min(total, current);
  const admissionYear = Number(academic.admissionYear) || new Date().getFullYear();
  const entrySemester = Number(academic.entrySemester) || 1;
  const family = detectSchemeFamily(academic.scheme || "", academic.programName || "", total);
  const timeline = buildExamTimeline({ totalSemesters: total, currentSemester: current, admissionYear, entrySemester }).filter(item => item.semester <= maximumExamSemester);
  const [backlogs, setBacklogs] = useState("");
  const [appeared, setAppeared] = useState<string[]>([]);
  const [sessionChoices, setSessionChoices] = useState<Record<number,string>>({});
  const [semesterRecords, setSemesterRecords] = useState<Record<number, SemesterRecord>>(() => Object.fromEntries(timeline.map(item => [item.semester, { eseStatus: "NOT_APPEARED", backlogAttempts: [] }])));
  const [busy, setBusy] = useState(false);

  function sessionOptions(semester: number) {
    const base = timeline.find(item => item.semester === semester);
    if (!base) return [];
    const year = Number(base.sessionLabel.match(/\\d{4}/)?.[0]) || admissionYear;
    const season = semester % 2 ? "November–December" : "May–June";
    return [year-1,year,year+1,year+2].filter(y=>y>=admissionYear).map(y=>`${season} ${y}`);
  }
  function updateSemester(semester: number, patch: Partial<SemesterRecord>) {
    setSemesterRecords(previous => ({ ...previous, [semester]: { eseStatus: "NOT_APPEARED", backlogAttempts: [], ...previous[semester], ...patch } }));
  }
  function updateAttempt(semester: number, id: string, patch: Partial<BacklogAttempt>) {
    const record = semesterRecords[semester] || { eseStatus: "BACKLOG" as EseStatus, backlogAttempts: [] };
    updateSemester(semester, { backlogAttempts: record.backlogAttempts.map(item => item.id === id ? { ...item, ...patch } : item) });
  }
  const totalAttempts = Object.values(semesterRecords).reduce((sum, record) => sum + record.backlogAttempts.length, 0);
  const clearedAttempts = Object.values(semesterRecords).reduce((sum, record) => sum + record.backlogAttempts.filter(item => item.status === "CLEARED").length, 0);
  const progress = timeline.length ? Math.round((timeline.filter(item => ["PASSED","BACKLOG","AWAITING_RESULT"].includes(semesterRecords[item.semester]?.eseStatus || "")).length / timeline.length) * 100) : 0;

  function confirm() {
    setBusy(true);
    const profile: ExamProfile = {
      version: 1, scheme: academic.scheme || "Unspecified", programme: academic.programName || "Programme",
      totalSemesters: total, currentSemester: current, admissionYear,
      admissionMode: academic.admissionMode || "Regular", entrySemester,
      confirmedAt: new Date().toISOString(),
      sessions: timeline.map(item => ({ ...item, sessionLabel: sessionChoices[item.semester] || item.sessionLabel, estimated: !sessionChoices[item.semester], state: semesterRecords[item.semester]?.eseStatus === "PASSED" ? "DECLARED" : semesterRecords[item.semester]?.eseStatus === "AWAITING_RESULT" ? "AWAITING_RESULT" : appeared.includes(String(item.semester)) ? "AWAITING_RESULT" : item.semester < (current || 0) ? "UNKNOWN" : "NOT_APPEARED" })),
    };
    const backlogAttempts = timeline.flatMap(item => (semesterRecords[item.semester]?.backlogAttempts || []).map(attempt => ({ ...attempt, semester: item.semester })));
    localStorage.setItem("gradly_student_exam_profile", JSON.stringify({ ...profile, pendingBacklogCount: backlogs === "" ? null : Number(backlogs), appearedSemesters: appeared.map(Number), semesterRecords, backlogAttempts }));
    setBusy(false);
    navigate("/dashboard", { replace: true });
  }

  return <main className="exam-setup"><div className="exam-setup-wrap">
    <header className="exam-setup-header">
      <div className="exam-setup-brand"><span>G</span><strong>Gradly</strong><small>EXAM INTELLIGENCE</small></div>
      <div className="exam-setup-kicker">YOUR ACADEMIC JOURNEY</div>
      <h1>Exam profile<span>.</span></h1>
      <p className="exam-setup-copy">Track your ESE attempts semester by semester. If a subject remains uncleared, add each subsequent backlog examination appearance to keep its progress organised.</p>
    </header>

    <section className="exam-setup-hero">
      <div><small>YOUR PROGRAMME</small><h2>{academic.programName || "Your programme"}</h2><p>{academic.institutionName || "Institution"} · {academic.scheme || "Curriculum-defined scheme"}</p></div>
      <div className="exam-setup-level"><span>SEMESTER</span><strong>{current || "—"}<small> / {total}</small></strong><div className="exam-setup-level-track"><i style={{ width: `${Math.min(100, ((current || 0) / total) * 100)}%` }} /></div></div>
    </section>

    <section className="exam-setup-progress">
      <div className="exam-setup-progress-top"><div><small>JOURNEY PROGRESS</small><strong>{progress}% tracked</strong></div><span className="exam-setup-streak">✦ {clearedAttempts} backlog {clearedAttempts === 1 ? "subject" : "subjects"} cleared</span></div>
      <div className="exam-setup-progress-track"><i style={{ width: `${progress}%` }} /></div>
      <p>Keep your ESE and re-exam records up to date. Every cleared backlog is a step forward.</p>
    </section>

    <section className="exam-setup-summary">
      <div><small>PROGRAMME</small><strong>{academic.programName || "Your programme"}</strong></div>
      <div><small>SCHEME</small><strong>{academic.scheme || "Curriculum-defined"}</strong></div>
      <div><small>STRUCTURE</small><strong>{total} semesters · {family}</strong></div>
      <div><small>CURRENT SEMESTER</small><strong>{current ? `Semester ${current}` : "Please verify"}</strong></div>
    </section>

    <section className="exam-setup-section-head"><div><small>SEMESTER-WISE RECORD</small><h2>Your examination timeline</h2></div><span>{timeline.length} semesters</span></section>
    <div className="exam-setup-timeline">
      {timeline.map(item => {
        const record = semesterRecords[item.semester] || { eseStatus: "NOT_APPEARED" as EseStatus, backlogAttempts: [] };
        return <article className="exam-setup-semester" key={item.semester}>
          <div className="exam-setup-semester-head">
            <div className="exam-setup-sem-badge">S{item.semester.toString().padStart(2,"0")}</div>
            <div className="exam-setup-sem-title"><h3>Semester {item.semester}</h3><p>{item.parity} semester · {item.semester === current ? "Current semester" : "Previous semester"}</p></div>
            <span className={`exam-setup-status exam-status-${record.eseStatus.toLowerCase()}`}>{eseLabels[record.eseStatus]}</span>
          </div>
          <div className="exam-setup-semester-fields">
            <label className="exam-setup-field"><span>ESE session</span><select value={sessionChoices[item.semester] || item.sessionLabel} onChange={event=>setSessionChoices(previous=>({...previous,[item.semester]:event.target.value}))}>{!sessionOptions(item.semester).includes(item.sessionLabel)&&<option value={item.sessionLabel}>{item.sessionLabel} (estimated)</option>}{sessionOptions(item.semester).map(option=><option key={option} value={option}>{option}</option>)}</select></label>
            <label className="exam-setup-field"><span>ESE outcome</span><select value={record.eseStatus} onChange={event=>updateSemester(item.semester,{eseStatus:event.target.value as EseStatus})}>{Object.entries(eseLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="exam-setup-backlog-panel">
            <div className="exam-setup-backlog-head"><div><small>BACKLOG CLEARANCE</small><h4>Re-examination appearances</h4><p>Record every subject you reappear for after an ESE, including attempts from earlier sessions.</p></div><button type="button" onClick={()=>updateSemester(item.semester,{backlogAttempts:[...record.backlogAttempts,makeAttempt()]})}>＋ Add appearance</button></div>
            {record.backlogAttempts.length === 0 && <div className="exam-setup-empty">No backlog appearances recorded for this semester. Add one whenever a subject needs a re-exam.</div>}
            {record.backlogAttempts.map((attempt,index)=><div className="exam-setup-attempt" key={attempt.id}>
              <div className="exam-setup-attempt-number">{index+1}</div>
              <label className="exam-setup-field"><span>Subject / course</span><input value={attempt.subject} onChange={event=>updateAttempt(item.semester,attempt.id,{subject:event.target.value})} placeholder="e.g. Engineering Mathematics" /></label>
              <label className="exam-setup-field"><span>Re-exam session</span><select value={attempt.session} onChange={event=>updateAttempt(item.semester,attempt.id,{session:event.target.value})}><option>After ESE</option><option>Winter re-exam</option><option>Summer re-exam</option><option>Special examination</option><option>Other</option></select></label>
              <label className="exam-setup-field"><span>Attempt status</span><select value={attempt.status} onChange={event=>updateAttempt(item.semester,attempt.id,{status:event.target.value as BacklogAttempt["status"]})}><option value="PLANNED">Planned</option><option value="APPEARED">Appeared</option><option value="CLEARED">Cleared</option><option value="BACKLOG">Not cleared</option></select></label>
              <button className="exam-setup-remove" type="button" aria-label="Remove appearance" onClick={()=>updateSemester(item.semester,{backlogAttempts:record.backlogAttempts.filter(entry=>entry.id!==attempt.id)})}>×</button>
            </div>)}
          </div>
        </article>;
      })}
    </div>

    <section className="exam-setup-card exam-setup-backlog-count"><label htmlFor="backlogs">Approximate total pending backlog subjects (optional)</label><input id="backlogs" type="number" min="0" max="100" value={backlogs} onChange={event=>setBacklogs(event.target.value)} placeholder="Enter count if known" /><small>This is a summary count. Add individual subjects and attempts in the relevant semester above.</small></section>
    <div className="exam-setup-actions"><button className="exam-setup-primary" onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Save exam profile"} <span>→</span></button><button className="exam-setup-secondary" onClick={() => navigate("/academic-setup")}>Back to academic profile</button></div>
    <p className="exam-setup-footnote">Your session dates are estimates. Always follow your college's official examination timetable and re-exam rules.</p>
  </div></main>;
}
