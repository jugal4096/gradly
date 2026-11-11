import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildExamTimeline, detectSchemeFamily, type ExamProfile } from "./exam-profile-intelligence";
import "./ExamProfileSetupPage.css";

type AcademicProfile = { institutionName?: string; programName?: string; branchName?: string; scheme?: string; semester?: string; admissionYear?: number | string; admissionMode?: string; totalSemesters?: number; entrySemester?: number; academicProfileConfirmed?: boolean };
type ReExamRecord = { id: number; semester: number; session: string; subjects: string; state: "AWAITING_RESULT" | "DECLARED" };
export default function ExamProfileSetupPage() {
  const navigate = useNavigate();
  const academic: AcademicProfile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("gradly_student_profile") || "{}"); } catch { return {}; }
  }, []);
  const total = Math.max(1, Number(academic.totalSemesters) || (/mca|m\.?tech/i.test(academic.programName || "") ? 4 : 8));
  const current = Number(academic.semester) || null;
  const admissionYear = Number(academic.admissionYear) || new Date().getFullYear();
  const entrySemester = Number(academic.entrySemester) || 1;
  const [backlogs, setBacklogs] = useState("");
  const [started, setStarted] = useState(Boolean(localStorage.getItem("gradly_student_exam_profile")) && localStorage.getItem("gradly_exam_profile_skipped") !== "true");
  const [reExamRecords, setReExamRecords] = useState<ReExamRecord[]>(() => { try { return JSON.parse(localStorage.getItem("gradly_student_reexam_records") || "[]"); } catch { return []; } });
  const [appeared, setAppeared] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const family = detectSchemeFamily(academic.scheme || "", academic.programName || "", total);
  const timeline = buildExamTimeline({ totalSemesters: total, currentSemester: current, admissionYear, entrySemester });
  function toggle(semester: number) { setAppeared(value => value.includes(String(semester)) ? value.filter(item => item !== String(semester)) : [...value, String(semester)]); }
  function addReExam(semester: number) { setReExamRecords(value => [...value, { id: Date.now() + Math.floor(Math.random() * 1000), semester, session: "Re-examination", subjects: "", state: "AWAITING_RESULT" }]); }
  function updateReExam(id: number, patch: Partial<ReExamRecord>) { setReExamRecords(value => value.map(record => record.id === id ? { ...record, ...patch } : record)); }
  function removeReExam(id: number) { setReExamRecords(value => value.filter(record => record.id !== id)); }
  function skipSetup() { localStorage.setItem("gradly_exam_profile_skipped", "true"); navigate("/dashboard", { replace: true }); }
  function confirm() {
    setBusy(true);
    const profile: ExamProfile = {
      version: 1, scheme: academic.scheme || "Unspecified", programme: academic.programName || "Programme",
      totalSemesters: total, currentSemester: current, admissionYear,
      admissionMode: academic.admissionMode || "Regular", entrySemester,
      confirmedAt: new Date().toISOString(),
      sessions: timeline.map(item => ({ ...item, state: appeared.includes(String(item.semester)) ? "AWAITING_RESULT" : item.semester < (current || 0) ? "UNKNOWN" : "NOT_APPEARED" })),
    };
    localStorage.setItem("gradly_student_exam_profile", JSON.stringify({ ...profile, pendingBacklogCount: backlogs === "" ? null : Number(backlogs), appearedSemesters: appeared.map(Number), reExamRecords }));
    localStorage.setItem("gradly_student_reexam_records", JSON.stringify(reExamRecords));
    localStorage.removeItem("gradly_exam_profile_skipped");
    setBusy(false);
    navigate("/dashboard", { replace: true });
  }
  return <main className="exam-setup"><div className="exam-setup-wrap">
    {!started ? <><div className="exam-setup-brand"><span>G</span> Gradly <small>EXAM INTELLIGENCE</small></div><p className="exam-setup-kicker">OPTIONAL · RECOMMENDED FOR SGPA FETCHING</p><h1>Set up your Exam Profile?</h1><p className="exam-setup-copy">This profile helps Gradly identify your examination sessions and fetch SGPA results online when supported by your institution. You can set it up now, edit your academic profile first, or skip and continue to your dashboard.</p><section className="exam-setup-card"><h2>Why set it up?</h2><p>Track semester-wise examination attempts, result status and re-examinations. You can complete this later from Academic Management.</p></section><div className="exam-setup-actions"><button className="exam-setup-primary" onClick={() => setStarted(true)}>Set up exam profile</button><button className="exam-setup-secondary" onClick={() => navigate("/academic-setup")}>Edit academic profile</button><button className="exam-setup-secondary" onClick={skipSetup}>Skip for now</button></div></> : <>
    <div className="exam-setup-brand"><span>G</span> Gradly <small>EXAM INTELLIGENCE</small></div>
    <p className="exam-setup-kicker">YOUR NEXT SETUP STEP</p><h1>Set up your Exam Profile</h1>
    <p className="exam-setup-copy">Gradly has prepared an examination timeline from your academic profile. Review it and confirm which semester examinations you have appeared for.</p>
    <section className="exam-setup-summary"><div><small>PROGRAMME</small><strong>{academic.programName || "Your programme"}</strong></div><div><small>SCHEME</small><strong>{academic.scheme || "Curriculum-defined"}</strong></div><div><small>STRUCTURE</small><strong>{total} semesters · {family}</strong></div><div><small>CURRENT SEMESTER</small><strong>{current ? `Semester ${current}` : "Please verify"}</strong></div></section>
    <section className="exam-setup-card"><h2>Examination timeline</h2><p>Session labels are estimates. Your institution's published academic calendar takes priority.</p><div className="exam-setup-timeline">{timeline.map(item => <label className="exam-setup-row" key={item.semester}><input type="checkbox" checked={appeared.includes(String(item.semester))} onChange={() => toggle(item.semester)} /><span className="exam-setup-sem">S{item.semester}</span><span className="exam-setup-session"><strong>{item.sessionLabel}</strong><small>{item.parity} semester · {item.semester === current ? "Current semester" : item.semester < (current || 0) ? "Previous semester" : "Upcoming semester"}</small></span><span className="exam-setup-tag">{appeared.includes(String(item.semester)) ? "Appeared" : item.semester > (current || 0) ? "Upcoming" : "Unverified"}</span></label>)}</div></section>
    <section className="exam-setup-card exam-setup-backlog"><label htmlFor="backlogs">How many pending backlog / re-examination subjects do you currently have?</label><input id="backlogs" type="number" min="0" max="100" value={backlogs} onChange={e => setBacklogs(e.target.value)} placeholder="Not sure? Leave blank" /><small>You can update this later. Gradly will keep each attempt separate.</small></section>
    <section className="exam-setup-card"><h2>Re-examination records</h2><p>Add separate attempts for any semester. These records are saved with your exam profile.</p>{timeline.map(item => <div className="exam-setup-reexam-sem" key={"re-"+item.semester}><strong>Semester {item.semester}</strong><button type="button" className="exam-setup-add" aria-label={"Add re-examination record for semester "+item.semester} onClick={() => addReExam(item.semester)}><span aria-hidden="true">＋</span> Add attempt</button>{reExamRecords.filter(record => record.semester === item.semester).map(record => <div className="exam-setup-reexam-record" key={record.id}><input aria-label="Exam session" value={record.session} onChange={e => updateReExam(record.id,{session:e.target.value})} placeholder="Exam session" /><input aria-label="Subjects" value={record.subjects} onChange={e => updateReExam(record.id,{subjects:e.target.value})} placeholder="Subjects (comma separated)" /><select aria-label="Result status" value={record.state} onChange={e => updateReExam(record.id,{state:e.target.value as ReExamRecord["state"]})}><option value="AWAITING_RESULT">Awaiting result</option><option value="DECLARED">Declared</option></select><button type="button" onClick={() => removeReExam(record.id)} aria-label="Remove re-examination record">Remove</button></div>)}</div>)}</section>
    <div className="exam-setup-actions"><button className="exam-setup-primary" onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Confirm exam profile & continue"}</button><button className="exam-setup-secondary" onClick={() => navigate("/academic-setup")}>Edit academic profile</button><button className="exam-setup-secondary" onClick={skipSetup}>Skip for now</button></div></>}
  </div></main>;
}
