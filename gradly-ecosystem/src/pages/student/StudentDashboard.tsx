import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, BookOpen, Calculator, CalendarDays, ChartNoAxesCombined, CheckCircle2, Clock3, GraduationCap, LogOut, Plus, RefreshCw, ShieldCheck, Sparkles, Target, UserRound, X } from "lucide-react";
import { auth, signOutUser, waitForFirebaseUser } from "../../config/firebase";
import { studentApi, synchronizeStudent } from "../../lib/studentApi";
import "./StudentPortal.css";

type Profile = { id: string; curriculum_id: string; institution_name: string; program_name: string; branch_name: string; scheme_name: string; student_identifier: string; current_semester_number: number; admission_year: number; gap_years: number; target_cgpa: number | null; current_cgpa: number | null; current_earned_credits: number | null };
type Course = { id: string; course_code_snapshot: string | null; course_name_snapshot: string | null; credits: number | null; grade_symbol: string | null; grade_point: number | null; marks: number | null; result_status: string | null };
type Semester = { id: string; semester_number: number; semester_name: string; attempt_number: number; sgpa: number | null; credits_earned: number | null; status: string; courses: Course[] };
type DashboardData = { user: { display_name: string | null; email: string }; profile: Profile | null; semesters: Semester[] };
type ToolTab = "overview" | "sgpa" | "cgpa" | "planner" | "results" | "analytics";
type SubjectRow = { id: number; name: string; credits: string; gradePoint: string };
type StudyTask = { id: string; title: string; date: string; done: boolean };
type ApiTask = { id: string; title: string; due_date: string; done: boolean };
const gradePoints = [{ label: "O / 10", value: "10" }, { label: "A+ / 9", value: "9" }, { label: "A / 8", value: "8" }, { label: "B+ / 7", value: "7" }, { label: "B / 6", value: "6" }, { label: "C / 5", value: "5" }, { label: "P / 4", value: "4" }, { label: "F / 0", value: "0" }];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ToolTab>("overview");
  const [subjects, setSubjects] = useState<SubjectRow[]>([{ id: 1, name: "Subject 1", credits: "4", gradePoint: "9" }, { id: 2, name: "Subject 2", credits: "3", gradePoint: "8" }, { id: 3, name: "Subject 3", credits: "3", gradePoint: "10" }]);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [subjectsFromCurriculum, setSubjectsFromCurriculum] = useState(false);
  const [currentCgpa, setCurrentCgpa] = useState("7.2");
  const [completedSemesters, setCompletedSemesters] = useState("5");
  const [targetCgpa, setTargetCgpa] = useState("8.5");
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(new Date().toISOString().slice(0, 10));
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const user = await waitForFirebaseUser();
      if (!user) { navigate("/student/login", { replace: true }); return; }
      await synchronizeStudent(user);
      const [result, taskResult] = await Promise.all([
        studentApi<DashboardData>("/student/dashboard", {}, user),
        studentApi<{ tasks: ApiTask[] }>("/student/tasks", {}, user),
      ]);
      if (!result.profile) { navigate("/student/profile", { replace: true }); return; }
      setData(result);
      setTasks((taskResult.tasks || []).map(task => ({ id: task.id, title: task.title, date: String(task.due_date).slice(0, 10), done: task.done })));
      setCurrentCgpa(result.profile.current_cgpa == null ? "7.2" : String(result.profile.current_cgpa));
      setCompletedSemesters(String(Math.max(0, result.profile.current_semester_number - 1)));
      setTargetCgpa(result.profile.target_cgpa == null ? "8.5" : String(result.profile.target_cgpa));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load your student workspace."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [navigate]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    if (tab !== "sgpa" || !profile || subjectsLoaded) return;
    let cancelled = false;
    studentApi<{ subjects: Array<{ course_code: string | null; course_name: string; credits: number | string }> }>(
      "/academic/curricula/" + profile.curriculum_id + "/semesters/" + profile.current_semester_number + "/subjects"
    ).then(result => {
      if (cancelled) return;
      const rows = Array.isArray(result.subjects) ? result.subjects : [];
      if (rows.length) {
        setSubjects(rows.map((row, index) => ({ id: index + 1, name: row.course_name || row.course_code || "Subject " + (index + 1), credits: String(row.credits ?? 0), gradePoint: "8" })));
        setSubjectsFromCurriculum(true);
      } else setSubjectsFromCurriculum(false);
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load curriculum subjects."); })
      .finally(() => { if (!cancelled) setSubjectsLoaded(true); });
    return () => { cancelled = true; };
  }, [tab, profile?.curriculum_id, profile?.current_semester_number, subjectsLoaded]);

  const profile = data?.profile;
  const weightedTotal = subjects.reduce((sum, row) => sum + Math.max(0, Number(row.credits) || 0) * Math.max(0, Number(row.gradePoint) || 0), 0);
  const creditTotal = subjects.reduce((sum, row) => sum + Math.max(0, Number(row.credits) || 0), 0);
  const calculatedSgpa = creditTotal ? weightedTotal / creditTotal : 0;
  const totalSemesters = 8;
  const remainingSemesters = Math.max(0, totalSemesters - (Number(completedSemesters) || 0));
  const requiredAverage = remainingSemesters ? ((Number(targetCgpa) * totalSemesters) - ((Number(currentCgpa) || 0) * (Number(completedSemesters) || 0))) / remainingSemesters : 0;
  const doneTasks = tasks.filter(task => task.done).length;
  const upcomingTasks = useMemo(() => [...tasks].sort((a, b) => a.date.localeCompare(b.date)), [tasks]);
  const firstName = (data?.user.display_name || auth.currentUser?.displayName || "Student").trim().split(/\\s+/)[0];

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const result = await studentApi<{ task: ApiTask }>("/student/tasks", { method: "POST", body: JSON.stringify({ title: taskTitle.trim(), dueDate: taskDate }) });
      setTasks(old => [...old, { id: result.task.id, title: result.task.title, date: String(result.task.due_date).slice(0, 10), done: result.task.done }]);
      setTaskTitle(""); setShowTaskForm(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save study task."); }
  }
  async function toggleTask(task: StudyTask, done: boolean) {
    try {
      const result = await studentApi<{ task: ApiTask }>("/student/tasks/" + task.id, { method: "PATCH", body: JSON.stringify({ done }) });
      setTasks(old => old.map(item => item.id === task.id ? { ...item, done: result.task.done } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update study task."); }
  }
  async function removeTask(task: StudyTask) {
    try {
      await studentApi("/student/tasks/" + task.id, { method: "DELETE" });
      setTasks(old => old.filter(item => item.id !== task.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete study task."); }
  }
  async function logout() { await signOutUser(); navigate("/student/login", { replace: true }); }

  if (loading) return <main className="student-portal-loading"><div className="student-loader-orbit"/><p>Loading your Gradly workspace…</p></main>;

  const navItems = [
    { id: "overview" as ToolTab, label: "Overview", icon: Activity },
    { id: "sgpa" as ToolTab, label: "SGPA calculator", icon: Calculator },
    { id: "cgpa" as ToolTab, label: "CGPA planner", icon: Target },
    { id: "planner" as ToolTab, label: "Study planner", icon: CalendarDays },
    { id: "results" as ToolTab, label: "Result history", icon: BookOpen },
    { id: "analytics" as ToolTab, label: "Analytics", icon: ChartNoAxesCombined },
  ];

  return <main className="student-dashboard-page">
    <aside className="student-sidebar"><a className="student-brand sidebar-brand" href="/"><span className="student-brand-mark"><GraduationCap size={21}/></span><span>gradly<span className="brand-dot">.</span></span></a><div className="student-sidebar-label">YOUR WORKSPACE</div><nav className="student-nav">{navItems.map(item => { const Icon = item.icon; return <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon size={18}/>{item.label}{tab === item.id && <span className="nav-active-dot"/>}</button>; })}</nav><div className="student-sidebar-bottom"><div className="sidebar-mini-card"><Sparkles size={17}/><strong>One semester at a time.</strong><small>Small steps add up.</small></div><button className="student-logout" type="button" onClick={() => void logout()}><LogOut size={17}/> Sign out</button></div></aside>
    <section className="student-dashboard-main">
      <header className="student-dashboard-top"><div><div className="student-eyebrow">STUDENT SPACE / YOUR JOURNEY</div><span className="student-top-title">Your academic cockpit</span></div><div className="student-top-actions"><button className="student-icon-button" type="button" onClick={() => void loadDashboard(true)} disabled={refreshing} title="Refresh data"><RefreshCw size={17} className={refreshing ? "refresh-spin" : ""}/></button><button className="student-user-chip" type="button" onClick={() => navigate("/student/profile")}><span className="student-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span><strong>{firstName}</strong><small>Student profile</small></span><UserRound size={16}/></button></div></header>
      {error && <div className="student-alert" role="alert">{error}<button type="button" onClick={() => void loadDashboard()}><RefreshCw size={14}/> Retry</button></div>}
      {tab === "overview" && profile && <div className="student-dashboard-content">
        <section className="student-welcome-hero"><div className="welcome-hero-copy"><div className="student-eyebrow"><Sparkles size={14}/> YOUR JOURNEY, YOUR PACE</div><h1>Hey {firstName},<br/><span>look how far you’ve come.</span></h1><p>{profile.program_name || "Your program"} · {profile.branch_name || "Your branch"} · Semester {profile.current_semester_number}</p><button type="button" className="student-hero-cta" onClick={() => setTab("cgpa")}>Plan your next milestone <ArrowRight size={16}/></button></div><div className="welcome-3d-art"><div className="welcome-glow"/><div className="welcome-cube"><div className="cube-face cube-front"><GraduationCap size={42}/></div><div className="cube-face cube-top"/><div className="cube-face cube-side"/></div><span className="welcome-art-star star-one">✦</span><span className="welcome-art-star star-two">✧</span><div className="welcome-art-pill"><Activity size={15}/> Keep your momentum</div></div></section>
        <div className="student-stat-grid"><article className="student-stat-card"><span className="stat-card-icon purple"><ChartNoAxesCombined size={19}/></span><small>Current CGPA</small><strong>{profile.current_cgpa == null ? "—" : Number(profile.current_cgpa).toFixed(2)}</strong><span className="stat-subtext">out of 10.00</span></article><article className="student-stat-card"><span className="stat-card-icon blue"><BookOpen size={19}/></span><small>Semester</small><strong>{profile.current_semester_number}</strong><span className="stat-subtext">{profile.scheme_name || "Your curriculum"}</span></article><article className="student-stat-card"><span className="stat-card-icon mint"><CheckCircle2 size={19}/></span><small>Credits earned</small><strong>{profile.current_earned_credits ?? "—"}</strong><span className="stat-subtext">from recorded results</span></article><article className="student-stat-card"><span className="stat-card-icon amber"><Target size={19}/></span><small>Target CGPA</small><strong>{profile.target_cgpa == null ? "—" : Number(profile.target_cgpa).toFixed(2)}</strong><span className="stat-subtext">your next milestone</span></article></div>
        <div className="student-section-heading"><div><h2>Pick up where you left off</h2><p>Your tools, one click away.</p></div><span className="student-live-pill"><span/> PERSONALIZED</span></div>
        <div className="student-tool-grid">{[{ id: "sgpa" as ToolTab, title: "SGPA calculator", description: "Explore grades and credit-weighted semester scores.", icon: Calculator, color: "purple", tag: "QUICK CALC" }, { id: "cgpa" as ToolTab, title: "CGPA goal planner", description: "See what average you need to reach your target.", icon: Target, color: "blue", tag: "SET A GOAL" }, { id: "planner" as ToolTab, title: "Study planner", description: "Keep track of upcoming study sessions and deadlines.", icon: CalendarDays, color: "mint", tag: "STAY ON TRACK" }, { id: "results" as ToolTab, title: "Result history", description: "Review semester results already saved to Gradly.", icon: BookOpen, color: "amber", tag: "YOUR RECORDS" }, { id: "analytics" as ToolTab, title: "Academic analytics", description: "Get a clear snapshot of your academic progress.", icon: ChartNoAxesCombined, color: "purple", tag: "PROGRESS" }].map(tool => { const Icon = tool.icon; return <button key={tool.id} type="button" className="student-tool-card" onClick={() => setTab(tool.id)}><span className={"tool-card-icon " + tool.color}><Icon size={20}/></span><span className="tool-card-tag">{tool.tag}</span><strong>{tool.title}</strong><small>{tool.description}</small><span className="tool-card-arrow"><ArrowRight size={17}/></span></button>; })}</div>
        <section className="student-recent-panel"><div className="student-section-heading"><div><h2>Recent semester results</h2><p>Saved academic history linked to your profile.</p></div><button className="student-text-button" type="button" onClick={() => setTab("results")}>View all <ArrowRight size={15}/></button></div>{data?.semesters.length ? <div className="student-recent-list">{[...data.semesters].sort((a, b) => b.semester_number - a.semester_number).slice(0, 3).map(sem => <div className="student-recent-row" key={sem.id}><span className="recent-semester-badge">S{sem.semester_number}</span><div><strong>{sem.semester_name || "Semester " + sem.semester_number}</strong><small>{sem.courses.length} course records · {sem.credits_earned ?? "—"} credits earned</small></div><strong className="recent-sgpa">{sem.sgpa == null ? "—" : Number(sem.sgpa).toFixed(2)}</strong></div>)}</div> : <div className="student-empty-state"><BookOpen size={22}/><strong>Your result history starts here.</strong><span>When semester results are saved to Gradly, they’ll appear in this timeline.</span></div>}</section>
      </div>}
      {tab === "sgpa" && <section className="student-feature-page"><div className="student-feature-page-head"><span className="student-feature-large-icon purple"><Calculator size={24}/></span><div><div className="student-eyebrow">GRADE TOOLKIT</div><h1>SGPA calculator</h1><p>Try grade combinations before you lock in your semester plan.</p></div></div><div className="student-calculator-layout"><div className="student-calculator-card">{subjectsLoaded && <div className="student-info-banner"><BookOpen size={16}/><span>{subjectsFromCurriculum ? "Subjects loaded from your selected curriculum and current semester. Choose your expected grade points." : "No curriculum subjects were found for this semester. You can add or edit rows manually."}</span></div>}<div className="student-calc-table-head"><span>Subject</span><span>Credits</span><span>Grade point</span><span/></div>{subjects.map(row => <div className="student-calc-row" key={row.id}><input aria-label="Subject name" value={row.name} onChange={e => setSubjects(old => old.map(item => item.id === row.id ? { ...item, name: e.target.value } : item))}/><input aria-label="Credits" type="number" min="0" max="30" step="0.5" value={row.credits} onChange={e => setSubjects(old => old.map(item => item.id === row.id ? { ...item, credits: e.target.value } : item))}/><select aria-label="Grade point" value={row.gradePoint} onChange={e => setSubjects(old => old.map(item => item.id === row.id ? { ...item, gradePoint: e.target.value } : item))}>{gradePoints.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select><button type="button" aria-label="Remove subject" onClick={() => setSubjects(old => old.filter(item => item.id !== row.id))}><X size={15}/></button></div>)}<button type="button" className="student-add-row" onClick={() => setSubjects(old => [...old, { id: Math.max(0, ...old.map(item => item.id)) + 1, name: "Subject " + (old.length + 1), credits: "3", gradePoint: "8" }])}><Plus size={15}/> Add subject</button></div><div className="student-calculator-result"><span>ESTIMATED SGPA</span><strong>{calculatedSgpa.toFixed(2)}</strong><small>Weighted by credits · {creditTotal} total credits</small><div className="student-score-meter"><span style={{ width: Math.min(100, calculatedSgpa * 10) + "%" }}/></div><p>Formula: Σ (credits × grade points) ÷ Σ credits</p></div></div></section>}
      {tab === "cgpa" && <section className="student-feature-page"><div className="student-feature-page-head"><span className="student-feature-large-icon blue"><Target size={24}/></span><div><div className="student-eyebrow">PLAN YOUR NEXT MILESTONE</div><h1>CGPA goal planner</h1><p>Adjust your current score and target to estimate the average you’ll need.</p></div></div><div className="student-cgpa-layout"><div className="student-calculator-card student-cgpa-form"><label>Current CGPA<input type="number" min="0" max="10" step="0.01" value={currentCgpa} onChange={e => setCurrentCgpa(e.target.value)}/></label><label>Completed semesters<input type="number" min="0" max={totalSemesters} value={completedSemesters} onChange={e => setCompletedSemesters(e.target.value)}/></label><label>Target final CGPA<input type="number" min="0" max="10" step="0.01" value={targetCgpa} onChange={e => setTargetCgpa(e.target.value)}/></label><p className="student-form-note">This estimate assumes semesters have equal weight. Your university’s credit-weighted CGPA may differ.</p></div><div className="student-calculator-result cgpa-result"><span>AVERAGE NEEDED</span><strong>{remainingSemesters ? requiredAverage.toFixed(2) : "—"}</strong><small>{remainingSemesters} semesters remaining in an {totalSemesters}-semester plan</small><div className="student-score-meter"><span style={{ width: Math.max(0, Math.min(100, requiredAverage * 10)) + "%" }}/></div><p>{!remainingSemesters ? "No semesters remain in this estimate." : requiredAverage > 10 ? "This target is above the mathematical maximum; try a nearer goal." : requiredAverage < 0 ? "You have already met this target in the equal-weight estimate." : "Keep your focus on consistent semester performance."}</p></div></div></section>}
      {tab === "planner" && <section className="student-feature-page"><div className="student-feature-page-head"><span className="student-feature-large-icon mint"><CalendarDays size={24}/></span><div><div className="student-eyebrow">MAKE ROOM FOR PROGRESS</div><h1>Study planner</h1><p>A lightweight checklist for study sessions and deadlines. Tasks are saved in this browser.</p></div><button type="button" className="student-primary-button" onClick={() => setShowTaskForm(v => !v)}><Plus size={17}/> Add task</button></div>{showTaskForm && <form className="student-task-form" onSubmit={addTask}><input required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Revise DBMS normalization"/><input required type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}/><button className="student-primary-button">Save task</button></form>}<div className="student-planner-summary"><div><small>ALL TASKS</small><strong>{tasks.length}</strong></div><div><small>COMPLETED</small><strong>{doneTasks}</strong></div><div><small>TO GO</small><strong>{tasks.length - doneTasks}</strong></div></div><div className="student-task-list">{upcomingTasks.length ? upcomingTasks.map(task => <div className={"student-task-row " + (task.done ? "is-done" : "")} key={task.id}><label><input type="checkbox" checked={task.done} onChange={e => void toggleTask(task, e.target.checked)}/><span><strong>{task.title}</strong><small><Clock3 size={13}/>{task.date}</small></span></label><button type="button" aria-label="Delete task" onClick={() => void removeTask(task)}><X size={16}/></button></div>) : <div className="student-empty-state"><CalendarDays size={23}/><strong>No study tasks yet.</strong><span>Add a small, achievable task and build momentum.</span><button type="button" className="student-text-button" onClick={() => setShowTaskForm(true)}>Create your first task <ArrowRight size={15}/></button></div>}</div></section>}
      {tab === "results" && <section className="student-feature-page"><div className="student-feature-page-head"><span className="student-feature-large-icon amber"><BookOpen size={24}/></span><div><div className="student-eyebrow">YOUR ACADEMIC RECORD</div><h1>Result history</h1><p>Semester records currently saved to your Gradly profile.</p></div></div>{data?.semesters.length ? <div className="student-results-list">{[...data.semesters].sort((a, b) => a.semester_number - b.semester_number).map(sem => <article className="student-result-card" key={sem.id}><div className="result-card-head"><span className="recent-semester-badge">S{sem.semester_number}</span><div><strong>{sem.semester_name || "Semester " + sem.semester_number}</strong><small>{sem.courses.length} subjects · attempt {sem.attempt_number}</small></div><strong className="result-score">{sem.sgpa == null ? "—" : Number(sem.sgpa).toFixed(2)}<small>SGPA</small></strong></div><div className="student-result-courses">{sem.courses.map(course => <div key={course.id}><span>{course.course_code_snapshot ? course.course_code_snapshot + " · " : ""}{course.course_name_snapshot || "Course"}</span><span>{course.credits ?? "—"} cr</span><strong>{course.grade_symbol || (course.grade_point == null ? "—" : course.grade_point)}</strong></div>)}</div></article>)}</div> : <div className="student-empty-state"><BookOpen size={23}/><strong>No saved results yet.</strong><span>Gradly will show verified or manually saved semester records here.</span></div>}<div className="student-info-banner"><Sparkles size={17}/><span><strong>Need result import?</strong> Automated fetching depends on a supported institution result source. This view currently shows records already saved in Gradly.</span></div></section>}
      {tab === "analytics" && profile && <section className="student-feature-page"><div className="student-feature-page-head"><span className="student-feature-large-icon purple"><ChartNoAxesCombined size={24}/></span><div><div className="student-eyebrow">ZOOM OUT, SEE THE PATTERN</div><h1>Academic analytics</h1><p>A snapshot of the academic data Gradly currently has for your journey.</p></div></div><div className="student-stat-grid analytics-grid"><article className="student-stat-card"><small>Recorded semesters</small><strong>{data?.semesters.length || 0}</strong><span className="stat-subtext">in saved result history</span></article><article className="student-stat-card"><small>Recorded subjects</small><strong>{data?.semesters.reduce((n, sem) => n + sem.courses.length, 0) || 0}</strong><span className="stat-subtext">across saved semesters</span></article><article className="student-stat-card"><small>Study tasks done</small><strong>{doneTasks}/{tasks.length}</strong><span className="stat-subtext">this browser’s planner</span></article><article className="student-stat-card"><small>Target CGPA</small><strong>{profile.target_cgpa == null ? "—" : Number(profile.target_cgpa).toFixed(2)}</strong><span className="stat-subtext">personal target</span></article></div><div className="student-analytics-panel"><div><span>Academic profile</span><strong>{profile.institution_name || "Institution not set"}</strong><small>{profile.program_name} · {profile.branch_name}</small></div><div><span>Admission timeline</span><strong>{profile.admission_year} onward</strong><small>{profile.gap_years || 0} gap years recorded</small></div><div><span>Result coverage</span><strong>{data?.semesters.length || 0} semesters</strong><small>Only stored records are counted; no grades are inferred.</small></div></div></section>}
      <footer className="student-dashboard-footer"><span>GRADLY · YOUR ACADEMIC SPACE</span><span><ShieldCheck size={14}/> Your profile is private to your account</span></footer>
    </section>
  </main>;
}
