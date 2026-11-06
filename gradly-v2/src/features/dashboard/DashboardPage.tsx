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

const gradePoints: Record<string, number> = {
  "O": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C": 5, "P": 4, "F": 0,
};

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
  const [subjects, setSubjects] = useState<Subject[]>([{ id: 1, name: "", grade: "A", credits: 3 }]);
  const [showResult, setShowResult] = useState(false);
  const totalCredits = subjects.reduce((sum, subject) => sum + (Number(subject.credits) || 0), 0);
  const points = subjects.reduce((sum, subject) => sum + (gradePoints[subject.grade] ?? 0) * (Number(subject.credits) || 0), 0);
  const result = totalCredits > 0 ? points / totalCredits : 0;
  function updateSubject(id: number, patch: Partial<Subject>) {
    setSubjects(current => current.map(subject => subject.id === id ? { ...subject, ...patch } : subject));
    setShowResult(false);
  }
  return <><SectionHeading eyebrow="ACADEMIC TOOLS" title="SGPA calculator" description="Calculate your Semester Grade Point Average using your subject grades and credits." />
    <div className="calculator-layout"><section className="student-panel calculator-panel"><div className="panel-heading"><div><span className="student-eyebrow">SEMESTER DETAILS</span><h2>Enter your subjects</h2></div><span className="panel-chip">{subjects.length} subject{subjects.length===1?"":"s"}</span></div>
      <div className="subject-table"><div className="subject-table-head"><span>SUBJECT NAME</span><span>GRADE</span><span>CREDITS</span><span /></div>
        {subjects.map((subject,index)=><div className="subject-row" key={subject.id}><input aria-label={`Subject ${index+1} name`} value={subject.name} onChange={event=>updateSubject(subject.id,{name:event.target.value})} placeholder={`Subject ${index+1}`} /><select aria-label={`Subject ${index+1} grade`} value={subject.grade} onChange={event=>updateSubject(subject.id,{grade:event.target.value})}>{Object.keys(gradePoints).map(grade=><option key={grade} value={grade}>{grade} · {gradePoints[grade]}</option>)}</select><input aria-label={`Subject ${index+1} credits`} type="number" min="0" max="30" step="0.5" value={subject.credits} onChange={event=>updateSubject(subject.id,{credits:Number(event.target.value)})}/><button className="remove-subject" aria-label="Remove subject" disabled={subjects.length===1} onClick={()=>{setSubjects(current=>current.filter(item=>item.id!==subject.id));setShowResult(false);}}>×</button></div>)}
      </div><button className="add-subject-btn" onClick={()=>setSubjects(current=>[...current,{id:Math.max(0,...current.map(item=>item.id))+1,name:"",grade:"A",credits:3}])}>＋ Add another subject</button>
      <div className="calculator-actions"><button className="student-primary-btn" onClick={()=>setShowResult(true)}>Calculate SGPA <span>→</span></button><button className="student-quiet-btn" onClick={()=>{setSubjects([{id:1,name:"",grade:"A",credits:3}]);setShowResult(false);}}>Reset</button></div>
    </section><aside className="student-panel result-panel"><span className="student-eyebrow">YOUR RESULT</span><div className="result-orb"><strong>{showResult && totalCredits>0 ? result.toFixed(2) : "—"}</strong><span>SGPA</span></div><h3>{showResult ? (totalCredits>0 ? "Calculation complete" : "Add valid credits") : "Your result will appear here"}</h3><p>{showResult ? (totalCredits>0 ? "Your semester grade point average, based on the grades and credits entered." : "Enter at least one subject with credits greater than zero.") : "Enter your subject grades and credits, then calculate your semester score."}</p><div className="result-detail"><span>Total credits</span><b>{showResult ? totalCredits : "—"}</b></div><div className="result-detail"><span>Weighted grade points</span><b>{showResult ? points.toFixed(1) : "—"}</b></div></aside></div>
    <p className="calculator-note">Grade scale: O = 10, A+ = 9, A = 8, B+ = 7, B = 6, C = 5, P = 4, F = 0. Confirm your institution’s grading rules before using this result officially.</p>
  </>;
}

function CgpaCalculator() {
  const [semesters,setSemesters]=useState([{id:1,sgpa:"",credits:""}]);
  const [calculated,setCalculated]=useState(false);
  const totalCredits=semesters.reduce((sum,item)=>sum+(Number(item.credits)||0),0);
  const weighted=semesters.reduce((sum,item)=>sum+(Number(item.sgpa)||0)*(Number(item.credits)||0),0);
  const cgpa=totalCredits>0?weighted/totalCredits:0;
  return <><SectionHeading eyebrow="ACADEMIC TOOLS" title="CGPA calculator" description="Combine semester performance using credit-weighted SGPA values for a cumulative result."/><div className="calculator-layout"><section className="student-panel calculator-panel"><div className="panel-heading"><div><span className="student-eyebrow">SEMESTER RECORDS</span><h2>Add your semester results</h2></div></div><div className="subject-table"><div className="cgpa-table-head"><span>SEMESTER</span><span>SGPA (0–10)</span><span>TOTAL CREDITS</span><span /></div>{semesters.map((item,index)=><div className="cgpa-row" key={item.id}><b>Semester {index+1}</b><input aria-label={`Semester ${index+1} SGPA`} type="number" min="0" max="10" step="0.01" placeholder="e.g. 8.25" value={item.sgpa} onChange={event=>{setSemesters(current=>current.map(s=>s.id===item.id?{...s,sgpa:event.target.value}:s));setCalculated(false);}}/><input aria-label={`Semester ${index+1} credits`} type="number" min="0" max="100" placeholder="e.g. 22" value={item.credits} onChange={event=>{setSemesters(current=>current.map(s=>s.id===item.id?{...s,credits:event.target.value}:s));setCalculated(false);}}/><button className="remove-subject" aria-label="Remove semester" disabled={semesters.length===1} onClick={()=>{setSemesters(current=>current.filter(s=>s.id!==item.id));setCalculated(false);}}>×</button></div>)}</div><button className="add-subject-btn" onClick={()=>setSemesters(current=>[...current,{id:Math.max(0,...current.map(s=>s.id))+1,sgpa:"",credits:""}])}>＋ Add semester</button><div className="calculator-actions"><button className="student-primary-btn" onClick={()=>setCalculated(true)}>Calculate CGPA <span>→</span></button><button className="student-quiet-btn" onClick={()=>{setSemesters([{id:1,sgpa:"",credits:""}]);setCalculated(false);}}>Reset</button></div></section><aside className="student-panel result-panel"><span className="student-eyebrow">CUMULATIVE RESULT</span><div className="result-orb"><strong>{calculated&&totalCredits>0?cgpa.toFixed(2):"—"}</strong><span>CGPA</span></div><h3>{calculated&&totalCredits>0?"Your cumulative score":"Your result will appear here"}</h3><p>{calculated&&totalCredits>0?"Credit-weighted average across the semesters you entered.":"Enter each semester’s SGPA and total credits to calculate your CGPA."}</p><div className="result-detail"><span>Semesters entered</span><b>{calculated?semesters.length:"—"}</b></div><div className="result-detail"><span>Total credits</span><b>{calculated?totalCredits:"—"}</b></div></aside></div><p className="calculator-note">CGPA is calculated as Σ(SGPA × semester credits) ÷ Σ(semester credits). Use the credit totals shown on your official grade sheets.</p></>;
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
