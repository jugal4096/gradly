import { useMemo, useState, type FormEvent, type CSSProperties } from "react";
import { useAuth } from "../auth/AuthContext";

type Subject = { id: string; name: string; code: string; credits: number; gradePoint: number };
type Semester = { id: string; name: string; sgpa: number; credits: number };
type Profile = { name: string; institution: string; program: string; branch: string; semester: string };

const defaultSubjects: Subject[] = [
  { id: "s1", name: "Data Structures & Algorithms", code: "IT301", credits: 4, gradePoint: 9 },
  { id: "s2", name: "Database Management Systems", code: "IT302", credits: 3, gradePoint: 8 },
  { id: "s3", name: "Operating Systems", code: "IT303", credits: 3, gradePoint: 8 },
  { id: "s4", name: "Artificial Intelligence", code: "IT304", credits: 3, gradePoint: 9 },
];
const defaultSemesters: Semester[] = [
  { id: "sem1", name: "Semester 1", sgpa: 7.1, credits: 20 },
  { id: "sem2", name: "Semester 2", sgpa: 7.4, credits: 21 },
  { id: "sem3", name: "Semester 3", sgpa: 7.8, credits: 22 },
  { id: "sem4", name: "Semester 4", sgpa: 8.1, credits: 22 },
];
const storageKey = "gradly_student_workspace_v1";

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(storageKey + "_" + key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store<T>(key: string, value: T) {
  try {
    localStorage.setItem(storageKey + "_" + key, JSON.stringify(value));
  } catch {
    // The workspace remains usable when browser storage is unavailable.
  }
}
function average(subjects: Subject[]) {
  const credits = subjects.reduce((sum, subject) => sum + Number(subject.credits || 0), 0);
  const points = subjects.reduce((sum, subject) => sum + Number(subject.credits || 0) * Number(subject.gradePoint || 0), 0);
  return { credits, value: credits ? points / credits : 0 };
}
function formatGrade(value: number) {
  return value.toFixed(2);
}

const navItems = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "subjects", icon: "▤", label: "My subjects" },
  { id: "sgpa", icon: "◉", label: "SGPA calculator" },
  { id: "cgpa", icon: "↗", label: "CGPA planner" },
  { id: "profile", icon: "◎", label: "Academic profile" },
] as const;
type Section = (typeof navItems)[number]["id"];

export default function DashboardPage() {
  const { user, isGuest, logout } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [subjects, setSubjects] = useState<Subject[]>(() => readStored("subjects", defaultSubjects));
  const [semesters, setSemesters] = useState<Semester[]>(() => readStored("semesters", defaultSemesters));
  const [profile, setProfile] = useState<Profile>(() => readStored("profile", {
    name: user?.displayName || "",
    institution: "",
    program: "B.Tech",
    branch: "Information Technology",
    semester: "Semester 7",
  }));
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectCredits, setSubjectCredits] = useState("3");
  const [subjectGrade, setSubjectGrade] = useState("8");
  const [semesterName, setSemesterName] = useState("");
  const [semesterSgpa, setSemesterSgpa] = useState("");
  const [semesterCredits, setSemesterCredits] = useState("20");
  const [notice, setNotice] = useState("");

  const current = useMemo(() => average(subjects), [subjects]);
  const cgpa = useMemo(() => {
    const credits = semesters.reduce((sum, semester) => sum + semester.credits, 0);
    const points = semesters.reduce((sum, semester) => sum + semester.sgpa * semester.credits, 0);
    return { credits, value: credits ? points / credits : 0 };
  }, [semesters]);

  function saveSubjects(next: Subject[]) {
    setSubjects(next);
    store("subjects", next);
    setNotice("Subject changes saved in this browser.");
  }
  function saveSemesters(next: Semester[]) {
    setSemesters(next);
    store("semesters", next);
    setNotice("Semester plan saved in this browser.");
  }
  function saveProfile(next: Profile) {
    setProfile(next);
    store("profile", next);
    setNotice("Academic profile saved.");
  }
  function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectName.trim()) return;
    const next = [...subjects, {
      id: "subject-" + Date.now(),
      name: subjectName.trim(),
      code: subjectCode.trim() || "CUSTOM",
      credits: Math.max(1, Number(subjectCredits) || 1),
      gradePoint: Math.min(10, Math.max(0, Number(subjectGrade) || 0)),
    }];
    saveSubjects(next);
    setSubjectName("");
    setSubjectCode("");
    setSubjectCredits("3");
    setSubjectGrade("8");
  }
  function addSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!semesterName.trim() || semesterSgpa === "") return;
    const next = [...semesters, {
      id: "semester-" + Date.now(),
      name: semesterName.trim(),
      sgpa: Math.min(10, Math.max(0, Number(semesterSgpa) || 0)),
      credits: Math.max(1, Number(semesterCredits) || 1),
    }];
    saveSemesters(next);
    setSemesterName("");
    setSemesterSgpa("");
    setSemesterCredits("20");
  }
  function updateSubject(id: string, field: "credits" | "gradePoint", value: number) {
    saveSubjects(subjects.map((subject) => subject.id === id ? { ...subject, [field]: value } : subject));
  }

  const greetingName = profile.name || user?.displayName?.split(" ")[0] || "there";

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <a className="brand-lockup workspace-brand" href="/dashboard">
          <span className="brand-symbol">G</span>
          <span><strong>gradly</strong><small>STUDENT SPACE</small></span>
        </a>
        <div className="sidebar-caption">YOUR WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Student workspace">
          {navItems.map((item) => (
            <button key={item.id} className={"workspace-nav-item " + (section === item.id ? "active" : "")} onClick={() => { setSection(item.id); setNotice(""); }} type="button">
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>{section === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-spark">✳</span>
            <strong>Small steps add up.</strong>
            <p>Keep your academic plan current and make progress visible.</p>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{(greetingName[0] || "G").toUpperCase()}</div>
            <div className="sidebar-user-copy"><strong>{greetingName}</strong><small>{isGuest ? "Guest workspace" : user?.email || "Student account"}</small></div>
            <button type="button" className="icon-button" aria-label="Sign out" onClick={() => void logout()}>↗</button>
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{navItems.find((item) => item.id === section)?.label}</strong></div>
          <div className="topbar-right">
            <span className={"sync-status " + (isGuest ? "guest" : "")}><span />{isGuest ? "Guest mode" : "Account connected"}</span>
            <div className="topbar-avatar">{(greetingName[0] || "G").toUpperCase()}</div>
          </div>
        </header>

        {isGuest && <div className="guest-banner"><span>✦</span><div><strong>You're exploring Gradly as a guest.</strong><small>Your edits are stored only in this browser. Sign in when you're ready to sync your academic space.</small></div><button type="button" onClick={() => { setSection("profile"); setNotice("Sign in is available from the account entry page."); }}>Set up profile <span>→</span></button></div>}
        {notice && <div className="notice-banner" role="status"><span>✓</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}

        {section === "overview" && (
          <section className="page-content">
            <div className="page-heading">
              <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR ACADEMIC OVERVIEW</div><h1>Good to see you, {greetingName} <span className="wave">✳</span></h1><p>Here's where your academic journey stands right now.</p></div>
              <button type="button" className="primary-button" onClick={() => setSection("sgpa")}>Calculate my SGPA <span>↗</span></button>
            </div>
            <div className="metric-grid">
              <article className="metric-card metric-featured"><div className="metric-top"><span>ESTIMATED CURRENT SGPA</span><span className="metric-icon">◉</span></div><div className="metric-value">{formatGrade(current.value)}<span>/ 10</span></div><div className="metric-bottom"><span className="metric-pill">Based on {subjects.length} subjects</span><span>{current.credits} credits</span></div><div className="metric-progress"><span style={{ width: Math.min(100, current.value * 10) + "%" }} /></div></article>
              <article className="metric-card"><div className="metric-top"><span>PLANNED CGPA</span><span className="metric-icon purple">↗</span></div><div className="metric-value">{formatGrade(cgpa.value)}<span>/ 10</span></div><p className="metric-description">Across {semesters.length} semesters in your plan</p><button type="button" className="text-action" onClick={() => setSection("cgpa")}>Open CGPA planner <span>→</span></button></article>
              <article className="metric-card"><div className="metric-top"><span>SUBJECTS TRACKED</span><span className="metric-icon mint">▤</span></div><div className="metric-value">{subjects.length}<span> subjects</span></div><p className="metric-description">{current.credits} total credits in this semester</p><button type="button" className="text-action" onClick={() => setSection("subjects")}>Manage subjects <span>→</span></button></article>
            </div>

            <div className="content-grid">
              <section className="panel subject-panel"><div className="panel-heading"><div><span className="panel-overline">CURRENT SEMESTER</span><h2>Subject performance</h2></div><button type="button" className="subtle-button" onClick={() => setSection("subjects")}>View all <span>→</span></button></div>
                {subjects.length === 0 ? <div className="empty-state"><span>▤</span><strong>No subjects added yet</strong><p>Add subjects to start calculating your SGPA.</p><button className="primary-button" onClick={() => setSection("subjects")} type="button">Add subjects</button></div> : <div className="subject-list">{subjects.slice(0, 5).map((subject, index) => <div className="subject-row" key={subject.id}><span className={"subject-index index-" + (index % 4)}>{String(index + 1).padStart(2, "0")}</span><div className="subject-row-copy"><strong>{subject.name}</strong><small>{subject.code} <span>·</span> {subject.credits} credits</small></div><div className="subject-grade"><strong>{subject.gradePoint.toFixed(1)}</strong><small>grade point</small></div><div className="grade-bar"><span style={{ width: Math.min(100, subject.gradePoint * 10) + "%" }} /></div></div>)}</div>}
              </section>
              <section className="panel plan-panel"><div className="panel-heading"><div><span className="panel-overline">YOUR JOURNEY</span><h2>Semester timeline</h2></div><button type="button" className="icon-button" onClick={() => setSection("cgpa")} aria-label="Edit semester plan">↗</button></div>
                <div className="semester-timeline">{semesters.slice(-4).map((semester, index) => <div className="timeline-row" key={semester.id}><span className={"timeline-marker " + (index === semesters.slice(-4).length - 1 ? "current" : "")}>{index === semesters.slice(-4).length - 1 ? "•" : "✓"}</span><div className="timeline-copy"><strong>{semester.name}</strong><small>{semester.credits} credits</small></div><span className="timeline-score">{semester.sgpa.toFixed(2)} <small>SGPA</small></span></div>)}</div>
                <button type="button" className="wide-outline-button" onClick={() => setSection("cgpa")}>View semester history <span>→</span></button>
              </section>
            </div>
            <section className="next-step-card"><div className="next-step-art">✳</div><div><span className="panel-overline">A GOOD NEXT STEP</span><h2>Make a plan for your next result.</h2><p>Update your subject grades or add a semester to see how your academic goals are shaping up.</p></div><button type="button" className="primary-button" onClick={() => setSection("cgpa")}>Plan my CGPA <span>↗</span></button></section>
          </section>
        )}

        {section === "subjects" && <section className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ACADEMIC RECORD</div><h1>My subjects</h1><p>Keep credits and grade points up to date for a reliable SGPA estimate.</p></div><span className="count-chip">{subjects.length} subjects · {current.credits} credits</span></div>
          <section className="panel"><div className="panel-heading"><div><span className="panel-overline">SUBJECT REGISTER</span><h2>Current semester</h2></div><span className="metric-pill">Weighted SGPA: {formatGrade(current.value)}</span></div>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>SUBJECT</th><th>CREDITS</th><th>GRADE POINT (0–10)</th><th>WEIGHTED POINTS</th><th /></tr></thead><tbody>{subjects.map((subject) => <tr key={subject.id}><td><strong>{subject.name}</strong><small>{subject.code}</small></td><td><input aria-label={subject.name + " credits"} type="number" min="1" max="10" value={subject.credits} onChange={(event) => updateSubject(subject.id, "credits", Math.max(1, Number(event.target.value) || 1))} /></td><td><input aria-label={subject.name + " grade point"} type="number" min="0" max="10" step="0.5" value={subject.gradePoint} onChange={(event) => updateSubject(subject.id, "gradePoint", Math.min(10, Math.max(0, Number(event.target.value) || 0)))} /></td><td className="weighted-value">{(subject.credits * subject.gradePoint).toFixed(1)}</td><td><button type="button" className="remove-button" aria-label={"Remove " + subject.name} onClick={() => saveSubjects(subjects.filter((item) => item.id !== subject.id))}>×</button></td></tr>)}</tbody></table></div>
            <form className="add-form" onSubmit={addSubject}><div className="form-title"><span className="form-plus">+</span><div><strong>Add a subject</strong><small>Customise the subject list for your semester.</small></div></div><label>Subject name<input required value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="e.g. Machine Learning" /></label><label>Subject code<input value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} placeholder="e.g. IT401" /></label><label>Credits<input type="number" min="1" max="10" required value={subjectCredits} onChange={(event) => setSubjectCredits(event.target.value)} /></label><label>Grade point<input type="number" min="0" max="10" step="0.5" required value={subjectGrade} onChange={(event) => setSubjectGrade(event.target.value)} /></label><button type="submit" className="primary-button">Add subject <span>+</span></button></form>
          </section>
        </section>}

        {section === "sgpa" && <section className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> GRADE CALCULATOR</div><h1>SGPA calculator</h1><p>See how each subject contributes to your semester performance.</p></div><span className="count-chip">10-point grading scale</span></div>
          <div className="calculator-layout"><section className="panel calculator-panel"><div className="panel-heading"><div><span className="panel-overline">YOUR INPUTS</span><h2>Subject grades</h2></div><span className="metric-pill">{subjects.length} entries</span></div><p className="panel-intro">Edit credits and grade points in My subjects. Your result updates instantly.</p><div className="calc-subject-list">{subjects.map((subject) => <div className="calc-subject-row" key={subject.id}><div className="calc-subject-name"><strong>{subject.name}</strong><small>{subject.code}</small></div><span>{subject.credits} cr</span><strong>{subject.gradePoint.toFixed(1)}</strong><span className="calc-weight">{(subject.credits * subject.gradePoint).toFixed(1)} pts</span></div>)}</div><button type="button" className="wide-outline-button" onClick={() => setSection("subjects")}>Edit subjects and grades <span>→</span></button></section>
            <section className="result-card"><span className="result-kicker">YOUR ESTIMATED RESULT</span><div className="result-ring" style={{ "--progress": (current.value * 10) + "%" } as CSSProperties}><div><strong>{formatGrade(current.value)}</strong><small>SGPA / 10</small></div></div><div className="result-summary"><div><span>Total credits</span><strong>{current.credits}</strong></div><div><span>Weighted points</span><strong>{(current.value * current.credits).toFixed(1)}</strong></div><div><span>Subjects included</span><strong>{subjects.length}</strong></div></div><p className="result-disclaimer">Estimate only. Your official result and institution grading rules take precedence.</p></section></div>
        </section>}

        {section === "cgpa" && <section className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> LONG-TERM PLANNING</div><h1>CGPA planner</h1><p>Build a semester-by-semester picture of your academic progress.</p></div><span className="count-chip">{semesters.length} semesters tracked</span></div>
          <div className="cgpa-hero"><div><span className="result-kicker">WEIGHTED CGPA ESTIMATE</span><div className="cgpa-value">{formatGrade(cgpa.value)}<span>/ 10</span></div><p>Weighted across {cgpa.credits} total credits</p></div><div className="cgpa-hero-decoration">↗</div><div className="cgpa-meter"><span style={{ width: Math.min(100, cgpa.value * 10) + "%" }} /></div></div>
          <section className="panel semester-panel"><div className="panel-heading"><div><span className="panel-overline">SEMESTER HISTORY</span><h2>Your academic timeline</h2></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>SEMESTER</th><th>SGPA</th><th>CREDITS</th><th>WEIGHTED POINTS</th><th /></tr></thead><tbody>{semesters.map((semester) => <tr key={semester.id}><td><strong>{semester.name}</strong></td><td><span className="score-chip">{semester.sgpa.toFixed(2)}</span></td><td>{semester.credits}</td><td className="weighted-value">{(semester.sgpa * semester.credits).toFixed(1)}</td><td><button type="button" className="remove-button" aria-label={"Remove " + semester.name} onClick={() => saveSemesters(semesters.filter((item) => item.id !== semester.id))}>×</button></td></tr>)}</tbody></table></div>
            <form className="add-form semester-add-form" onSubmit={addSemester}><div className="form-title"><span className="form-plus">+</span><div><strong>Add semester</strong><small>Add a completed or planned semester.</small></div></div><label>Semester name<input required value={semesterName} onChange={(event) => setSemesterName(event.target.value)} placeholder="e.g. Semester 5" /></label><label>SGPA<input type="number" min="0" max="10" step="0.01" required value={semesterSgpa} onChange={(event) => setSemesterSgpa(event.target.value)} placeholder="8.25" /></label><label>Credits<input type="number" min="1" max="40" required value={semesterCredits} onChange={(event) => setSemesterCredits(event.target.value)} /></label><button type="submit" className="primary-button">Add semester <span>+</span></button></form>
          </section>
          <p className="calculation-note"><strong>How this is calculated:</strong> total of (semester SGPA × semester credits) divided by total credits. Use the method prescribed by your institution if it differs.</p>
        </section>}

        {section === "profile" && <section className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR DETAILS</div><h1>Academic profile</h1><p>Keep your course details organised in one place.</p></div><span className="count-chip">{isGuest ? "Guest profile" : "Student profile"}</span></div>
          <section className="panel profile-panel"><div className="profile-intro"><div className="profile-avatar">{(greetingName[0] || "G").toUpperCase()}</div><div><span className="panel-overline">ACADEMIC IDENTITY</span><h2>{profile.name || "Your profile"}</h2><p>{profile.program || "Program not set"} · {profile.branch || "Branch not set"}</p></div></div>
            <form className="profile-form" onSubmit={(event) => { event.preventDefault(); saveProfile(profile); }}><label>Full name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Your full name" /></label><label>Institution<input value={profile.institution} onChange={(event) => setProfile({ ...profile, institution: event.target.value })} placeholder="College or university" /></label><label>Program<input value={profile.program} onChange={(event) => setProfile({ ...profile, program: event.target.value })} placeholder="e.g. B.Tech" /></label><label>Branch / department<input value={profile.branch} onChange={(event) => setProfile({ ...profile, branch: event.target.value })} placeholder="e.g. Information Technology" /></label><label>Current semester<input value={profile.semester} onChange={(event) => setProfile({ ...profile, semester: event.target.value })} placeholder="e.g. Semester 7" /></label><div className="profile-save-row"><p>These details are saved locally in this browser.</p><button type="submit" className="primary-button">Save profile <span>✓</span></button></div></form>
          </section>
        </section>}
        <footer className="workspace-footer"><span>GRADLY <span className="footer-separator">/</span> YOUR ACADEMIC JOURNEY</span><span>Progress over perfection.</span></footer>
      </main>
    </div>
  );
}