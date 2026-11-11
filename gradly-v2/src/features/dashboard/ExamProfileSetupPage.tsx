import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildExamTimeline, detectSchemeFamily, type ExamProfile } from "./exam-profile-intelligence";
import "./ExamProfileSetupPage.css";

type AcademicProfile = { institutionName?: string; programName?: string; branchName?: string; scheme?: string; semester?: string; admissionYear?: number | string; admissionMode?: string; totalSemesters?: number; entrySemester?: number; academicProfileConfirmed?: boolean };
export default function ExamProfileSetupPage() {
  const navigate = useNavigate();
  const academic: AcademicProfile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("gradly_student_profile") || "{}"); } catch { return {}; }
  }, []);
  const total = Math.max(1, Number(academic.totalSemesters) || (/mca|m\.?tech/i.test(academic.programName || "") ? 4 : 8));
  const current = Number(academic.semester) || null;
  const maximumExamSemester = current === null ? 0 : Math.min(total, current);
  const admissionYear = Number(academic.admissionYear) || new Date().getFullYear();
  const entrySemester = Number(academic.entrySemester) || 1;
  const [backlogs, setBacklogs] = useState("");
  const [appeared, setAppeared] = useState<string[]>([]);
  const [sessionChoices, setSessionChoices] = useState<Record<number,string>>({});
  const [busy, setBusy] = useState(false);
  const family = detectSchemeFamily(academic.scheme || "", academic.programName || "", total);
  const timeline = buildExamTimeline({ totalSemesters: total, currentSemester: current, admissionYear, entrySemester }).filter(item => item.semester <= maximumExamSemester);
  function sessionOptions(semester: number) {
    const base = timeline.find(item => item.semester === semester);
    if (!base) return [];
    const year = Number(base.sessionLabel.match(/\d{4}/)?.[0]) || admissionYear;
    const season = semester % 2 ? "November–December" : "May–June";
    return [year-1,year,year+1,year+2].filter(y=>y>=admissionYear).map(y=>`${season} ${y}`);
  }
  function toggle(semester: number) { if (semester > maximumExamSemester) return; setAppeared(value => value.includes(String(semester)) ? value.filter(item => item !== String(semester)) : [...value, String(semester)]); }
  function confirm() {
    setBusy(true);
    const profile: ExamProfile = {
      version: 1, scheme: academic.scheme || "Unspecified", programme: academic.programName || "Programme",
      totalSemesters: total, currentSemester: current, admissionYear,
      admissionMode: academic.admissionMode || "Regular", entrySemester,
      confirmedAt: new Date().toISOString(),
      sessions: timeline.map(item => ({ ...item, sessionLabel: sessionChoices[item.semester] || item.sessionLabel, estimated: !sessionChoices[item.semester], state: appeared.includes(String(item.semester)) ? "AWAITING_RESULT" : item.semester < (current || 0) ? "UNKNOWN" : "NOT_APPEARED" })),
    };
    localStorage.setItem("gradly_student_exam_profile", JSON.stringify({ ...profile, pendingBacklogCount: backlogs === "" ? null : Number(backlogs), appearedSemesters: appeared.map(Number) }));
    setBusy(false);
    navigate("/dashboard", { replace: true });
  }
  return <main className="exam-setup"><div className="exam-setup-wrap">
    <div className="exam-setup-brand"><span>G</span> Gradly <small>EXAM INTELLIGENCE</small></div>
    <p className="exam-setup-kicker">YOUR NEXT SETUP STEP</p><h1>Set up your Exam Profile</h1>
    <p className="exam-setup-copy">Choose the examination session for each semester through your current semester. Higher semesters will appear after you advance your academic profile. Session estimates can be changed.</p>
    <section className="exam-setup-summary"><div><small>PROGRAMME</small><strong>{academic.programName || "Your programme"}</strong></div><div><small>SCHEME</small><strong>{academic.scheme || "Curriculum-defined"}</strong></div><div><small>STRUCTURE</small><strong>{total} semesters · {family}</strong></div><div><small>CURRENT SEMESTER</small><strong>{current ? `Semester ${current}` : "Please verify"}</strong></div></section>
    <section className="exam-setup-card"><h2>Examination timeline</h2><p>Only semesters up to your current semester are available. Choose the actual session for each semester.</p><div className="exam-setup-timeline">{timeline.map(item => <div className="exam-setup-row" key={item.semester}><label><input type="checkbox" checked={appeared.includes(String(item.semester))} onChange={() => toggle(item.semester)} /> Appeared</label><span className="exam-setup-sem">S{item.semester}</span><span className="exam-setup-session"><strong>Semester {item.semester}</strong><select aria-label={`Exam session for semester ${item.semester}`} value={sessionChoices[item.semester] || item.sessionLabel} onChange={event=>setSessionChoices(previous=>({...previous,[item.semester]:event.target.value}))}>{!sessionOptions(item.semester).includes(item.sessionLabel)&&<option value={item.sessionLabel}>{item.sessionLabel} (estimated)</option>}{sessionOptions(item.semester).map(option=><option key={option} value={option}>{option}</option>)}</select></span><span className="exam-setup-tag">{appeared.includes(String(item.semester)) ? "Appeared" : "Not appeared / unverified"}</span></div>)}</div></section>
    <section className="exam-setup-card exam-setup-backlog"><label htmlFor="backlogs">How many pending backlog / re-examination subjects do you currently have?</label><input id="backlogs" type="number" min="0" max="100" value={backlogs} onChange={e => setBacklogs(e.target.value)} placeholder="Not sure? Leave blank" /><small>You can update this later. Gradly will keep each attempt separate.</small></section>
    <div className="exam-setup-actions"><button className="exam-setup-primary" onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Confirm exam profile & continue"}</button><button className="exam-setup-secondary" onClick={() => navigate("/academic-setup")}>Edit academic profile</button></div>
  </div></main>;
}
