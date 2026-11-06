import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./DashboardPage.css";

type Section = "overview" | "sgpa" | "cgpa" | "curriculum" | "notifications" | "services" | "profile";
type Subject = { id: number; name: string; grade: string; credits: number };

const navItems: { id: Section; label: string; icon: string; group: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂", group: "WORKSPACE" },
  { id: "sgpa", label: "SGPA calculator", icon: "∑", group: "ACADEMICS" },
  { id: "cgpa", label: "CGPA calculator", icon: "◈", group: "ACADEMICS" },
  { id: "curriculum", label: "Curriculum", icon: "▤", group: "ACADEMICS" },
  { id: "notifications", label: "Notifications", icon: "♧", group: "YOUR SPACE" },
  { id: "services", label: "Student services", icon: "✧", group: "YOUR SPACE" },
];

// GECA grading scale copied from the GECA Student Academic Planner reference.
const gradePoints: Record<string, number> = {
  "A++": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C+": 5, "C": 4, "D": 0,
};
const gradeOptions = Object.entries(gradePoints);
type AdmissionMode = "Regular" | "Direct Second Year" | "Direct Third Year";
type Program = "BTECH" | "MCA" | "MTECH";

function getSemesterRange(program: Program, admissionMode: AdmissionMode) {
  if (program === "MCA" || program === "MTECH") return { start: 1, end: 4 };
  if (admissionMode === "Direct Second Year") return { start: 3, end: 8 };
  if (admissionMode === "Direct Third Year") return { start: 5, end: 8 };
  return { start: 1, end: 8 };
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="student-section-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function Overview({ name, onNavigate }: { name: string; onNavigate: (section: Section) => void }) {
  return (
    <>
      <div className="student-welcome">
        <div><span className="student-eyebrow">YOUR ACADEMIC WORKSPACE</span><h1>Good to see you{name ? `, ${name.split(" ")[0]}` : ""}.</h1><p>Your academic journey, organised in one place. Let’s make your next step count.</p></div>
        <div className="welcome-orbit" aria-hidden="true"><span>G</span><i>✦</i></div>
      </div>
      <div className="student-stat-grid">
        <article className="student-stat-card"><span className="stat-icon cyan">◈</span><span className="stat-label">Cumulative GPA</span><strong>—</strong><small>Add your semester results to get started</small></article>
        <article className="student-stat-card"><span className="stat-icon violet">∑</span><span className="stat-label">Latest SGPA</span><strong>—</strong><small>Your latest semester performance</small></article>
        <article className="student-stat-card"><span className="stat-icon blue">▤</span><span className="stat-label">Subjects tracked</span><strong>0</strong><small>Build your academic record</small></article>
        <article className="student-stat-card"><span className="stat-icon pink">✦</span><span className="stat-label">Your workspace</span><strong>Ready</strong><small>Start planning your progress</small></article>
      </div>
      <div className="student-main-grid">
        <section className="student-panel progress-panel">
          <div className="panel-heading"><div><span className="student-eyebrow">YOUR JOURNEY</span><h2>Academic progress</h2></div><span className="panel-chip">Personal overview</span></div>
          <div className="empty-progress"><div className="empty-progress-art">⌁</div><h3>Your progress story starts here</h3><p>Add your semester grades to see your academic journey take shape. Your results are never filled with sample data.</p><button className="student-primary-btn" onClick={() => onNavigate("sgpa")}>Calculate your first SGPA <span>→</span></button></div>
        </section>
        <section className="student-panel shortcuts-panel">
          <div className="panel-heading"><div><span className="student-eyebrow">GET MOVING</span><h2>Quick actions</h2></div></div>
          <button className="student-shortcut" onClick={() => onNavigate("sgpa")}><span className="shortcut-icon cyan">∑</span><span><b>Calculate SGPA</b><small>Work out a semester result</small></span><i>↗</i></button>
          <button className="student-shortcut" onClick={() => onNavigate("cgpa")}><span className="shortcut-icon violet">◈</span><span><b>Calculate CGPA</b><small>Combine semester results</small></span><i>↗</i></button>
          <button className="student-shortcut" onClick={() => onNavigate("curriculum")}><span className="shortcut-icon blue">▤</span><span><b>Explore curriculum</b><small>Find your academic structure</small></span><i>↗</i></button>
          <button className="student-shortcut" onClick={() => onNavigate("services")}><span className="shortcut-icon pink">✧</span><span><b>Student services</b><small>Discover helpful tools</small></span><i>↗</i></button>
        </section>
      </div>
      <section className="student-panel getting-started"><div><span className="student-eyebrow">A GOOD PLACE TO BEGIN</span><h2>Make Gradly yours.</h2><p>Start with a calculator, explore your curriculum, and build a clearer picture of your academic goals.</p></div><button className="student-outline-btn" onClick={() => onNavigate("profile")}>Set up your profile <span>→</span></button></section>
    </>
  );
}

function SgpaCalculator() {
  const [program, setProgram] = useState<Program>("BTECH");
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>("Regular");
  const [semester, setSemester] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([{ id: 1, name: "", grade: "A", credits: 3 }]);
  const [showResult, setShowResult] = useState(false);
  const range = getSemesterRange(program, admissionMode);
  const validSemesters = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const countedSubjects = subjects.filter(subject => subject.name.trim() && subject.credits > 0 && Number.isFinite(subject.credits) && gradePoints[subject.grade] !== undefined);
  const totalCredits = countedSubjects.reduce((sum, subject) => sum + subject.credits, 0);
  const weightedPoints = countedSubjects.reduce((sum, subject) => sum + gradePoints[subject.grade] * subject.credits, 0);
  const result = totalCredits > 0 ? weightedPoints / totalCredits : null;
  function updateSubject(id: number, patch: Partial<Subject>) {
    setSubjects(current => current.map(subject => subject.id === id ? { ...subject, ...patch } : subject));
    setShowResult(false);
  }
  function resetSubjects() {
    setSubjects([{ id: 1, name: "", grade: "A", credits: 3 }]);
    setShowResult(false);
  }
  return <>
    <SectionHeading eyebrow="GECA ACADEMIC ENGINE" title="SGPA calculator" description="Calculate your semester grade point average using the GECA grade scale and credit-weighted method." />
    <div className="academic-rule-banner"><span>GECA GRADING STANDARD</span><p>Σ (Subject credits × Grade points) ÷ Σ Subject credits</p><small>Only subjects with a name, valid grade and positive credits are included.</small></div>
    <div className="academic-config-row">
      <label>Programme<select value={program} onChange={event => { const next = event.target.value as Program; setProgram(next); const nextRange = getSemesterRange(next, admissionMode); setSemester(nextRange.start); resetSubjects(); }}><option value="BTECH">B.Tech</option><option value="MCA">MCA</option><option value="MTECH">M.Tech</option></select></label>
      {program === "BTECH" && <label>Admission mode<select value={admissionMode} onChange={event => { const next = event.target.value as AdmissionMode; setAdmissionMode(next); setSemester(getSemesterRange(program, next).start); resetSubjects(); }}><option>Regular</option><option>Direct Second Year</option><option>Direct Third Year</option></select></label>}
      <label>Semester<select value={semester} onChange={event => setSemester(Number(event.target.value))}>{validSemesters.map(value => <option key={value} value={value}>Semester {value}</option>)}</select></label>
    </div>
    <div className="calculator-layout"><section className="student-panel calculator-panel"><div className="panel-heading"><div><span className="student-eyebrow">SEMESTER {semester} · SUBJECT RECORDS</span><h2>Enter your subject grades</h2></div><span className="panel-chip">{subjects.length} subject{subjects.length === 1 ? "" : "s"}</span></div>
      <div className="subject-table"><div className="subject-table-head"><span>SUBJECT NAME</span><span>GRADE</span><span>CREDITS</span><span /></div>
        {subjects.map((subject,index)=><div className="subject-row" key={subject.id}><input aria-label={`Subject ${index+1} name`} value={subject.name} onChange={event=>updateSubject(subject.id,{name:event.target.value})} placeholder={`Subject ${index+1}`} /><select aria-label={`Subject ${index+1} grade`} value={subject.grade} onChange={event=>updateSubject(subject.id,{grade:event.target.value})}>{gradeOptions.map(([grade,point])=><option key={grade} value={grade}>{grade} · {point}</option>)}</select><input aria-label={`Subject ${index+1} credits`} type="number" min="0" step="0.5" value={subject.credits} onChange={event=>updateSubject(subject.id,{credits:Number(event.target.value)})}/><button className="remove-subject" aria-label="Remove subject" disabled={subjects.length===1} onClick={()=>{setSubjects(current=>current.filter(item=>item.id!==subject.id));setShowResult(false);}}>×</button></div>)}
      </div><button className="add-subject-btn" onClick={()=>setSubjects(current=>[...current,{id:Math.max(0,...current.map(item=>item.id))+1,name:"",grade:"A",credits:3}])}>＋ Add another subject</button>
      <div className="calculator-actions"><button className="student-primary-btn" onClick={()=>setShowResult(true)}>Calculate SGPA <span>→</span></button><button className="student-quiet-btn" onClick={resetSubjects}>Reset subjects</button></div>
    </section><aside className="student-panel result-panel"><span className="student-eyebrow">SEMESTER RESULT</span><div className="result-orb"><strong>{showResult && result !== null ? result.toFixed(2) : "—"}</strong><span>SGPA / 10</span></div><h3>{showResult ? (result !== null ? "Calculation complete" : "Complete subject details") : "Your result will appear here"}</h3><p>{showResult ? (result !== null ? "Calculated with the GECA credit-weighted grade point method." : "Add a subject name and positive credit value to calculate.") : "Enter the grades and credits from your semester marksheet."}</p><div className="result-detail"><span>Counted subjects</span><b>{showResult ? countedSubjects.length : "—"}</b></div><div className="result-detail"><span>Total credits</span><b>{showResult ? totalCredits : "—"}</b></div><div className="result-detail"><span>Weighted points</span><b>{showResult ? weightedPoints.toFixed(2) : "—"}</b></div></aside></div>
    <section className="grade-reference-panel"><div><span className="student-eyebrow">OFFICIAL REFERENCE SCALE</span><h3>GECA grade points</h3></div><div className="grade-reference-grid">{gradeOptions.map(([grade,point])=><div key={grade}><b>{grade}</b><span>{point}</span></div>)}</div></section>
  </>;
}

function CgpaCalculator() {
  const [program, setProgram] = useState<Program>("BTECH");
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>("Regular");
  const [semesters,setSemesters]=useState<{id:number;semester:number;sgpa:string;credits:string}[]>([{id:1,semester:1,sgpa:"",credits:""}]);
  const [calculated,setCalculated]=useState(false);
  const range=getSemesterRange(program,admissionMode);
  const validSemesters=Array.from({length:range.end-range.start+1},(_,index)=>range.start+index);
  const usedSemesters=semesters.map(item=>item.semester);
  const nextSemester=validSemesters.find(value=>!usedSemesters.includes(value));
  const validRows=semesters.filter(item=>item.sgpa.trim()!==""&&item.credits.trim()!==""&&Number.isFinite(Number(item.sgpa))&&Number(item.sgpa)>=0&&Number(item.sgpa)<=10&&Number.isFinite(Number(item.credits))&&Number(item.credits)>0);
  const totalCredits=validRows.reduce((sum,item)=>sum+Number(item.credits),0);
  const weighted=validRows.reduce((sum,item)=>sum+Number(item.sgpa)*Number(item.credits),0);
  const cgpa=totalCredits>0?weighted/totalCredits:null;
  function updateSemester(id:number,patch:Partial<{semester:number;sgpa:string;credits:string}>){
    setSemesters(current=>current.map(item=>item.id===id?{...item,...patch}:item));setCalculated(false);
  }
  function changeProgramme(nextProgram:Program,nextMode:AdmissionMode){
    const nextRange=getSemesterRange(nextProgram,nextMode);
    setProgram(nextProgram);setAdmissionMode(nextMode);
    setSemesters([{id:1,semester:nextRange.start,sgpa:"",credits:""}]);setCalculated(false);
  }
  function addSemester(){
    if(nextSemester===undefined)return;
    setSemesters(current=>[...current,{id:Math.max(0,...current.map(item=>item.id))+1,semester:nextSemester,sgpa:"",credits:""}]);setCalculated(false);
  }
  return <>
    <SectionHeading eyebrow="GECA ACADEMIC ENGINE" title="CGPA management" description="Build your semester-wise academic record and calculate your cumulative performance exactly by GECA's credit-weighted method." />
    <div className="academic-rule-banner"><span>GECA CGPA STANDARD</span><p>Σ (Semester SGPA × Semester credits) ÷ Σ Semester credits</p><small>CGPA uses each semester's total credits. It is not the simple average of SGPAs.</small></div>
    <div className="academic-config-row">
      <label>Programme<select value={program} onChange={event=>changeProgramme(event.target.value as Program,admissionMode)}><option value="BTECH">B.Tech</option><option value="MCA">MCA</option><option value="MTECH">M.Tech</option></select></label>
      {program==="BTECH"&&<label>Admission mode<select value={admissionMode} onChange={event=>changeProgramme(program,event.target.value as AdmissionMode)}><option>Regular</option><option>Direct Second Year</option><option>Direct Third Year</option></select></label>}
      <div className="semester-limit-note"><span>ELIGIBLE SEMESTERS</span><b>{range.start}–{range.end}</b></div>
    </div>
    <div className="calculator-layout"><section className="student-panel calculator-panel"><div className="panel-heading"><div><span className="student-eyebrow">ACADEMIC HISTORY</span><h2>Your semester records</h2></div><span className="panel-chip">{semesters.length} entered</span></div>
      <div className="subject-table"><div className="cgpa-table-head"><span>SEMESTER</span><span>SGPA (0–10)</span><span>TOTAL CREDITS</span><span /></div>{semesters.map(item=><div className="cgpa-row" key={item.id}><select aria-label="Semester" value={item.semester} onChange={event=>updateSemester(item.id,{semester:Number(event.target.value)})}>{validSemesters.map(value=><option key={value} value={value}>Sem {value}</option>)}</select><input aria-label={`Semester ${item.semester} SGPA`} type="number" min="0" max="10" step="0.01" placeholder="e.g. 8.25" value={item.sgpa} onChange={event=>updateSemester(item.id,{sgpa:event.target.value})}/><input aria-label={`Semester ${item.semester} credits`} type="number" min="1" step="0.5" placeholder="e.g. 22" value={item.credits} onChange={event=>updateSemester(item.id,{credits:event.target.value})}/><button className="remove-subject" aria-label="Remove semester" disabled={semesters.length===1} onClick={()=>{setSemesters(current=>current.filter(row=>row.id!==item.id));setCalculated(false);}}>×</button></div>)}</div>
      <button className="add-subject-btn" onClick={addSemester} disabled={nextSemester===undefined}>＋ Add next eligible semester</button>
      {nextSemester===undefined&&<p className="semester-complete-note">All semesters available for this programme and admission mode have been added.</p>}
      <div className="calculator-actions"><button className="student-primary-btn" onClick={()=>setCalculated(true)}>Calculate CGPA <span>→</span></button><button className="student-quiet-btn" onClick={()=>{setSemesters([{id:1,semester:range.start,sgpa:"",credits:""}]);setCalculated(false);}}>Reset records</button></div>
      {calculated&&validRows.length!==semesters.length&&<p className="academic-validation-note">Only rows with SGPA between 0 and 10 and positive total credits are included. Complete or correct the remaining rows.</p>}
    </section><aside className="student-panel result-panel"><span className="student-eyebrow">CUMULATIVE RESULT</span><div className="result-orb"><strong>{calculated&&cgpa!==null?cgpa.toFixed(2):"—"}</strong><span>CGPA / 10</span></div><h3>{calculated&&cgpa!==null?"Your cumulative score":"Your result will appear here"}</h3><p>{calculated&&cgpa!==null?"Credit-weighted result across the valid semester records entered." :"Enter SGPA and total credits for each completed semester."}</p><div className="result-detail"><span>Valid semesters</span><b>{calculated?validRows.length:"—"}</b></div><div className="result-detail"><span>Total credits</span><b>{calculated?totalCredits:"—"}</b></div><div className="result-detail"><span>Weighted SGPA points</span><b>{calculated?weighted.toFixed(2):"—"}</b></div></aside></div>
    <p className="calculator-note">GECA CGPA method: each semester SGPA is weighted by that semester's total credits. The result is displayed to two decimal places, matching the reference calculator.</p>
  </>;
}

function SimpleSection({ section, onNavigate }: { section: Exclude<Section,"overview"|"sgpa"|"cgpa">; onNavigate:(section:Section)=>void }) {
  const content = {
    curriculum: { eyebrow:"ACADEMIC REFERENCE",title:"Your curriculum",description:"Keep your programme structure, semesters and subjects in one place.",icon:"▤",heading:"Find your academic path",body:"Curriculum browsing will show the subjects and semester structure for your selected institution and programme. Your institution details can be added in your profile." },
    notifications: { eyebrow:"STAY IN THE LOOP",title:"Notifications",description:"Important updates and messages for your student workspace.",icon:"♧",heading:"You’re all caught up",body:"When student notifications are connected to your account, they’ll appear here. There are no new messages to show right now." },
    services: { eyebrow:"STUDENT TOOLKIT",title:"Student services",description:"Useful tools and support for your academic journey.",icon:"✧",heading:"Your student toolkit",body:"Use the SGPA and CGPA calculators today. More student services can be added here as they become available." },
    profile: { eyebrow:"YOUR DETAILS",title:"Student profile",description:"Your identity and academic preferences.",icon:"◎",heading:"Complete your student profile",body:"Your sign-in identity is shown in the account menu. Institution, programme and semester details can be added when you’re ready." },
  }[section];
  return <><SectionHeading eyebrow={content.eyebrow} title={content.title} description={content.description}/><section className="student-panel empty-section"><div className="empty-section-icon">{content.icon}</div><h2>{content.heading}</h2><p>{content.body}</p><button className="student-primary-btn" onClick={()=>onNavigate("sgpa")}>Open SGPA calculator <span>→</span></button></section></>;
}

export default function DashboardPage() {
  const { user, isGuest, signOut } = useAuth();
  const [section,setSection]=useState<Section>("overview");
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const displayName=user?.displayName||"Student";
  const initials=useMemo(()=>displayName.split(" ").filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"S",[displayName]);
  const title=navItems.find(item=>item.id===section)?.label||"Profile";
  function navigateTo(next:Section){setSection(next);setMobileNavOpen(false);}
  return <div className="student-app-shell">
    <aside className={`student-sidebar ${mobileNavOpen?"is-open":""}`}>
      <a className="student-brand" href="/" onClick={event=>{event.preventDefault();navigateTo("overview");}}><span className="student-brand-mark">G<span>✦</span></span><span>Gradly<small>STUDENT SPACE</small></span></a>
      <div className="sidebar-rule"/>
      {["WORKSPACE","ACADEMICS","YOUR SPACE"].map(group=><div className="student-nav-group" key={group}><span className="student-nav-label">{group}</span>{navItems.filter(item=>item.group===group).map(item=><button key={item.id} className={`student-nav-item ${section===item.id?"active":""}`} onClick={()=>navigateTo(item.id)}><span>{item.icon}</span>{item.label}{section===item.id&&<i/>}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="sidebar-help"><span>✦</span><b>Your next step starts here.</b><small>Keep learning. Keep growing.</small></div><button className={`student-nav-item profile-nav ${section==="profile"?"active":""}`} onClick={()=>navigateTo("profile")}><span>◎</span>Profile & settings</button></div>
    </aside>
    {mobileNavOpen&&<button className="student-mobile-backdrop" aria-label="Close navigation" onClick={()=>setMobileNavOpen(false)}/>}
    <main className="student-main">
      <header className="student-topbar"><div className="student-topbar-left"><button className="student-menu-toggle" aria-label="Open navigation" onClick={()=>setMobileNavOpen(true)}>☰</button><div><span className="topbar-overline">GRADLY / STUDENT</span><strong>{title}</strong></div></div><div className="student-topbar-right"><span className="student-mode-chip"><i/>{isGuest?"Guest workspace":"Student workspace"}</span><button className="student-avatar" title={displayName} onClick={()=>navigateTo("profile")}>{initials}</button><button className="student-signout" onClick={()=>void signOut()}>{isGuest?"Exit guest":"Sign out"} ↗</button></div></header>
      <div className="student-content">{section==="overview"?<Overview name={user?.displayName||""} onNavigate={navigateTo}/>:section==="sgpa"?<SgpaCalculator/>:section==="cgpa"?<CgpaCalculator/>:section==="curriculum"||section==="notifications"||section==="services"||section==="profile"?<SimpleSection section={section} onNavigate={navigateTo}/>:null}</div>
      <footer className="student-app-footer"><span>© {new Date().getFullYear()} Gradly</span><span>CALCULATE <i>·</i> SIMULATE <i>·</i> PLAN</span><span>Built for your next chapter ✦</span></footer>
    </main>
  </div>;
}
