import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./StudentPlatform.css";
import GuestOnboarding from "./GuestOnboarding";

type Section = "home" | "sgpa" | "sgpaWhatIf" | "sgpaPlanner" | "tracker" | "cgpa" | "cgpaWhatIf" | "planner" | "cgpaTracker" | "community" | "events" | "assistant" | "aiStudyPlanner" | "profile" | "academicManagement" | "settings" | "credits";
type Profile = { institutionId: string; institutionName: string; programId: string; programName: string; branchId: string; branchName: string; curriculumId: string; semester: string; enrollment: string; admissionYear: string; admissionMode: string; admissionNumber: string; scheme: string };
type Subject = { id: number; name: string; credits: number; grade: string; courseCode?: string; curriculumSubjectId?: string };
type SemesterResult = { id: string; semester: number; sgpa: number; credits: number; savedAt: string };
type ChatMessage = { id: number; author: string; body: string; time: string; mine: boolean };
type AcademicRecordApi = { id: string | number; semester_number: number | string; sgpa?: number | string | null; credits_registered?: number | string | null; created_at?: string | null };
type CurriculumSubjectApi = { name?: string | null; credits?: number | string | null; code?: string | null; id?: string | number | null };

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
// GECA grade-point reference used by the earlier Gradly academic engine: A++=10 through D=0.
const POINTS: Record<string, number> = { "A++":10, "A+":9, "A":8, "B+":7, "B":6, "C+":5, "C":4, "D":0 };
const gradeNames = Object.keys(POINTS);
const emptyProfile: Profile = { institutionId:"", institutionName:"", programId:"", programName:"", branchId:"", branchName:"", curriculumId:"", semester:"", enrollment:"", admissionYear:String(new Date().getFullYear()), admissionMode:"Regular", admissionNumber:"", scheme:"" };
const nav: { id: Section; label: string; icon: string; group: string }[] = [
  { id:"home",label:"Overview",icon:"⌂",group:"WORKSPACE" },
  { id:"sgpa",label:"SGPA calculator",icon:"∑",group:"SGPA ANALYSIS" },
  { id:"sgpaWhatIf",label:"What-if analysis",icon:"⌁",group:"SGPA ANALYSIS" },
  { id:"sgpaPlanner",label:"SGPA planner",icon:"✧",group:"SGPA ANALYSIS" },
  { id:"tracker",label:"SGPA progress tracker",icon:"▤",group:"SGPA ANALYSIS" },
  { id:"cgpa",label:"CGPA calculator",icon:"◌",group:"CGPA ANALYSIS" },
  { id:"cgpaWhatIf",label:"What-if analysis",icon:"◈",group:"CGPA ANALYSIS" },
  { id:"planner",label:"CGPA planner",icon:"◇",group:"CGPA ANALYSIS" },
  { id:"cgpaTracker",label:"CGPA progress tracker",icon:"▥",group:"CGPA ANALYSIS" },
  { id:"community",label:"Group chat",icon:"▤",group:"COMMUNITY" },
  { id:"events",label:"Events & holidays",icon:"◷",group:"COMMUNITY" },
  { id:"assistant",label:"AI chatbot",icon:"✺",group:"AI ASSISTANT" },
  { id:"aiStudyPlanner",label:"AI study planner",icon:"⌘",group:"AI ASSISTANT" },
  { id:"profile",label:"Academic profile",icon:"◎",group:"ACADEMICS" },
  { id:"academicManagement",label:"Academic management",icon:"▧",group:"ACADEMICS" },
  { id:"credits",label:"Credit analyser",icon:"◩",group:"ACADEMICS" },
  { id:"settings",label:"Settings",icon:"⚙",group:"SETTINGS" },
];


function buildSgpaScenarios(targetInput:number, subjects:Subject[]) {
  const rows=subjects.filter(subject=>Number.isFinite(subject.credits)&&subject.credits>0);
  const totalCredits=rows.reduce((sum,subject)=>sum+subject.credits,0);
  const target=Math.max(0,Math.min(10,Number.isFinite(targetInput)?targetInput:0));
  const scale=Object.entries(POINTS).sort((a,b)=>a[1]-b[1]);
  const lower=scale.filter(([,points])=>points<=target).at(-1)||scale[0];
  const upper=scale.find(([,points])=>points>lower[1])||lower;
  const balanced=scale.find(([,points])=>points>=target)||scale[scale.length-1];
  const makeMixed=(ordered:Subject[])=>{
    const grades:Record<number,string>={};
    rows.forEach(subject=>{grades[subject.id]=lower[0];});
    let weighted=rows.reduce((sum,subject)=>sum+lower[1]*subject.credits,0);
    const required=target*totalCredits;
    for(const subject of ordered){
      if(weighted>=required)break;
      grades[subject.id]=upper[0];
      weighted+=(upper[1]-lower[1])*subject.credits;
    }
    return {grades,projected:totalCredits?weighted/totalCredits:0};
  };
  const uniformGrades:Record<number,string>={};
  rows.forEach(subject=>{uniformGrades[subject.id]=balanced[0];});
  const uniformPoints=rows.reduce((sum,subject)=>sum+balanced[1]*subject.credits,0);
  const creditPriority=makeMixed([...rows].sort((a,b)=>b.credits-a.credits));
  const spreadPriority=makeMixed([...rows].sort((a,b)=>a.credits-b.credits));
  return [
    {label:"Balanced grade plan",description:"Keep the same target-band grade across every subject.",grades:uniformGrades,projected:totalCredits?uniformPoints/totalCredits:0},
    {label:"High-credit-first mix",description:"Prioritise higher-credit subjects when moving up to the next grade band.",grades:creditPriority.grades,projected:creditPriority.projected},
    {label:"Spread-across-subjects mix",description:"Distribute the higher grade across lower-credit subjects first.",grades:spreadPriority.grades,projected:spreadPriority.projected},
  ];
}

function SectionTitle({ kicker, title, copy }: { kicker:string; title:string; copy:string }) {
  return <div className="sp-heading"><span>{kicker}</span><h1>{title}</h1><p>{copy}</p></div>;
}
function Card({ children, className="" }: { children: ReactNode; className?: string }) {
  return <section className={"sp-card "+className}>{children}</section>;
}

export default function StudentPlatform() {
  const { user, isGuest, signOut, loginWithGoogle } = useAuth();
  const [guestSessionReady,setGuestSessionReady] = useState(() => Boolean(localStorage.getItem("gradly_guest_session_token")));
  const [section,setSection] = useState<Section>("home");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [profileMenuOpen,setProfileMenuOpen] = useState(false);
  const [themeMode,setThemeMode] = useState<"light"|"dark"|"system">(()=>{const saved=localStorage.getItem("gradly_theme");return saved==="dark"||saved==="light"||saved==="system"?saved:"light";});
  const [systemDark] = useState(()=>window.matchMedia?.("(prefers-color-scheme: dark)").matches??false);
  const theme=themeMode==="system"?(systemDark?"dark":"light"):themeMode;
  const [fontFamily,setFontFamily] = useState(()=>localStorage.getItem("gradly_font_family")||"DM Sans");
  const [textSize,setTextSize] = useState(()=>Number(localStorage.getItem("gradly_text_size")||"14"));
  const [profile,setProfile] = useState<Profile>(() => {
    try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem("gradly_student_profile") || "{}") }; }
    catch { return emptyProfile; }
  });
  const [onboarding,setOnboarding] = useState(() => !isGuest);
  const [profileCheck,setProfileCheck] = useState<"loading"|"complete"|"missing"|"error">(isGuest?"complete":"loading");
  const [profileCheckAttempt,setProfileCheckAttempt] = useState(0);
  const [guestSemester] = useState("1");
  
  const [guestCgpaRows,setGuestCgpaRows] = useState([{id:1,semester:"1",sgpa:"",credits:""}]);
  const [guestCgpaResult,setGuestCgpaResult] = useState<number|null>(null);
  const [loginGate,setLoginGate] = useState(false);
  const [notice,setNotice] = useState("");
  const [subjects,setSubjects] = useState<Subject[]>(() => {
    if (isGuest) {
      try { const saved=JSON.parse(localStorage.getItem("gradly_guest_subjects") || "null"); if(Array.isArray(saved)&&saved.length) return saved.map((subject:Subject)=>({...subject,grade:({O:"A++",C:"C+",P:"C",F:"D"} as Record<string,string>)[subject.grade] || (POINTS[subject.grade]!==undefined?subject.grade:"A")})); } catch { /* use defaults */ }
      return Array.from({length:5},(_,i)=>({id:i+1,name:`Subject ${i+1}`,credits:3,grade:"A"}));
    }
    return [{id:1,name:"",credits:3,grade:"A"}];
  });
  const [sgpa,setSgpa] = useState<number|null>(null);
  const [results,setResults] = useState<SemesterResult[]>(() => {
    try { return JSON.parse(localStorage.getItem(isGuest ? "gradly_guest_semester_results" : "gradly_semester_results") || "[]"); } catch { return []; }
  });
  const [whatIf,setWhatIf] = useState("8.5");
  const [targetSgpa,setTargetSgpa] = useState("9");
  const [totalCredits,setTotalCredits] = useState("160");
  const [earnedCredits,setEarnedCredits] = useState("0");
  const [messages,setMessages] = useState<ChatMessage[]>([
    {id:1,author:"Gradly Community",body:"Welcome! Share notes, ask questions and help each other prepare.",time:"Today",mine:false},
  ]);
  const [message,setMessage] = useState("");
  const [editingId,setEditingId] = useState<number|null>(null);
  const [notes,setNotes] = useState<{name:string;size:string;file:File}[]>([]);
  const [aiInput,setAiInput] = useState("");
  const [aiMessages,setAiMessages] = useState<{role:"assistant"|"user";text:string}[]>([
    {role:"assistant",text:"Hi! I’m Gradly AI. I can help explain academic concepts and organise your study questions. Institution-specific answers will become available when your college rules are connected."},
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGuest) localStorage.setItem("gradly_guest_subjects", JSON.stringify(subjects));
  }, [isGuest, subjects]);

  useEffect(() => {
    if (isGuest || !user) return;
    let cancelled=false;
    setProfileCheck("loading");
    void (async()=>{
      try {
        const token=await user.getIdToken();
        const headers={Authorization:"Bearer "+token};
        const profileResponse=await fetch(API+"/api/student/profile",{headers});
        const profileData=await profileResponse.json().catch(()=>({}));
        if(!profileResponse.ok) throw new Error(profileData.message||"Unable to verify your student profile.");
        if(profileData.profile && !cancelled) {
          const p=profileData.profile;
          const next:Profile={institutionId:p.institution_id||"",institutionName:p.institution_name||"",programId:p.program_id||"",programName:p.program_name||"",branchId:p.branch_id||"",branchName:p.branch_name||"",curriculumId:p.curriculum_id||"",semester:String(p.current_semester_number||""),enrollment:p.student_identifier||"",admissionYear:String(p.admission_year||new Date().getFullYear()),admissionMode:p.admission_mode_name||"Regular",admissionNumber:"",scheme:p.scheme_name||""};
          setProfile(next); localStorage.setItem("gradly_student_profile",JSON.stringify(next)); setOnboarding(false); setProfileCheck("complete");
        } else if(!cancelled) {
          setOnboarding(true);
          setProfileCheck("missing");
        }
        const recordsResponse=await fetch(API+"/api/student/academic/records",{headers});
        const recordsData=await recordsResponse.json();
        if(recordsResponse.ok && !cancelled && Array.isArray(recordsData.records)) {
          const saved:SemesterResult[]=(recordsData.records as AcademicRecordApi[]).map((row)=>({id:String(row.id),semester:Number(row.semester_number),sgpa:Number(row.sgpa||0),credits:Number(row.credits_registered||0),savedAt:row.created_at||new Date().toISOString()}));
          setResults(saved); localStorage.setItem("gradly_semester_results",JSON.stringify(saved));
        }
      } catch(error) { if(!cancelled) { setNotice(error instanceof Error?error.message:"Unable to sync academic profile."); setProfileCheck("error"); } }
    })();
    return ()=>{cancelled=true;};
  }, [isGuest, user, profileCheckAttempt]);

  useEffect(() => {
    if (isGuest || !user || !profile.curriculumId || !profile.semester) return;
    let cancelled=false;
    void (async()=>{
      try {
        const response=await fetch(API+`/api/academic/curricula/${encodeURIComponent(profile.curriculumId)}/semesters/${encodeURIComponent(profile.semester)}/subjects`);
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to load curriculum subjects.");
        if(!cancelled && Array.isArray(data.data) && data.data.length) {
          setSubjects((data.data as CurriculumSubjectApi[]).map((item,index)=>({id:index+1,name:item.name||"",credits:Number(item.credits||0),grade:"A",courseCode:item.code||"",curriculumSubjectId:String(item.id||"")})));
          setSgpa(null);
        }
      } catch(error) { if(!cancelled) setNotice(error instanceof Error?error.message:"Unable to load curriculum subjects."); }
    })();
    return ()=>{cancelled=true;};
  }, [isGuest, user, profile.curriculumId, profile.semester]);

  const weighted = subjects.filter(s=>s.name.trim() && s.credits>0).reduce((sum,s)=>sum+POINTS[s.grade]*s.credits,0);
  const countedCredits = subjects.filter(s=>s.name.trim() && s.credits>0).reduce((sum,s)=>sum+s.credits,0);
  const computedSgpa = countedCredits ? weighted/countedCredits : 0;
  const cgpaCredits = results.reduce((sum,r)=>sum+r.credits,0);
  const cgpaValue = cgpaCredits ? results.reduce((sum,r)=>sum+r.sgpa*r.credits,0)/cgpaCredits : 0;
  const institutionLabel = profile.institutionName || localStorage.getItem("gradly_guest_institute_name") || "Institution selected";
  const name = user?.displayName?.split(" ")[0] || "Guest";
  const title = nav.find(item=>item.id===section)?.label || "Overview";

  function addSubject() {
    if (isGuest && countedCredits >= 20) { setNotice("Guest mode allows a maximum of 20 credits per semester."); return; }
    setSubjects(current=>[...current,{id:Math.max(0,...current.map(s=>s.id))+1,name:isGuest?`Subject ${current.length+1}`:"",credits:isGuest?Math.min(1,Math.max(0,20-countedCredits)):3,grade:"A"}]); setSgpa(null);
  }
  function calculateSgpa() {
    if(!countedCredits) { setNotice("Add at least one subject with a name and positive credits."); return; }
    setSgpa(computedSgpa);
  }
  async function saveSemester() {
    if(sgpa===null) { setNotice("Calculate your SGPA before saving it."); return; }
    const semesterNumber=isGuest?Number(guestSemester):(Number(profile.semester)||results.length+1);
    const row:SemesterResult={id:crypto.randomUUID(),semester:semesterNumber,sgpa,credits:countedCredits,savedAt:new Date().toISOString()};
    if(!isGuest) {
      if(!user || !profile.curriculumId) { setNotice("Save your academic profile and select a curriculum scheme before recording results."); return; }
      try {
        const token=await user.getIdToken();
        const response=await fetch(API+"/api/student/academic/semesters",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({
          semesterNumber,attemptNumber:1,courses:subjects.filter(subject=>subject.name.trim()&&subject.credits>0).map(subject=>({courseCode:subject.courseCode||"",courseName:subject.name,credits:subject.credits,gradeSymbol:subject.grade,gradePoint:POINTS[subject.grade]}))
        })});
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to save semester result.");
        row.id=data.semester.id;
      } catch(error) { setNotice(error instanceof Error?error.message:"Unable to save semester result."); return; }
    }
    const next=[...results.filter(item=>item.semester!==row.semester),row].sort((a,b)=>a.semester-b.semester);
    setResults(next); localStorage.setItem(isGuest?"gradly_guest_semester_results":"gradly_semester_results",JSON.stringify(next));
    setNotice(isGuest?"Semester result saved on this device.":"Semester subject grades saved to your Gradly academic record.");
  }
  function navigate(next:Section) {
    if (isGuest && !["home","sgpa","cgpa"].includes(next)) { setLoginGate(true); setMobileOpen(false); setProfileMenuOpen(false); return; }
    setSection(next); setMobileOpen(false); setProfileMenuOpen(false); setNotice("");
  }
  function updateSetting(key:string,value:string) { localStorage.setItem(key,value); }
  async function deleteGuestIdentity() {
    if (!window.confirm("Permanently delete your Guest ID and guest workspace? This cannot be undone.")) return;
    const token=localStorage.getItem("gradly_guest_session_token");
    if(!token){setNotice("No active guest session was found on this device.");return;}
    try {
      const response=await fetch(API+"/api/guest/session",{method:"DELETE",headers:{"x-guest-session":token}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.message||"Guest ID could not be deleted.");
      ["gradly_guest_id","gradly_guest_session_token","gradly_guest_institute","gradly_guest_subjects","gradly_guest_semester_results","gradly_guest_institute_request_token"].forEach(key=>localStorage.removeItem(key));
      await signOut();
    } catch(error) { setNotice(error instanceof Error?error.message:"Guest ID could not be deleted."); }
  }
  function submitMessage(event:FormEvent) {
    event.preventDefault(); if(!message.trim()) return;
    if(editingId!==null) setMessages(current=>current.map(item=>item.id===editingId?{...item,body:message.trim()}:item));
    else setMessages(current=>[...current,{id:Date.now(),author:user?.displayName||"You",body:message.trim(),time:"Just now",mine:true}]);
    setMessage("");setEditingId(null);
  }
  function submitAi(event:FormEvent) {
    event.preventDefault(); if(!aiInput.trim()) return;
    const prompt=aiInput.trim();setAiMessages(current=>[...current,{role:"user",text:prompt},{role:"assistant",text:"I’ve received your question. The live institution-aware AI service is not connected yet, so I can’t verify your college’s specific rules. For now, I can help with general academic concepts once the AI backend is enabled."}]);setAiInput("");
  }
  const remainingCredits=Math.max(0,Number(totalCredits||0)-Number(earnedCredits||0));
  const desired=Number(targetSgpa);
  const programmeName=profile.programName.toLowerCase();
  const totalProgrammeSemesters=programmeName.includes("mca")||programmeName.includes("m.tech")||programmeName.includes("mtech")?4:8;
  const remainingSemesters=Math.max(1,totalProgrammeSemesters-results.length);
  const completedWeightedPoints=results.reduce((sum,r)=>sum+r.sgpa*r.credits,0);
  const completedCredits=results.reduce((sum,r)=>sum+r.credits,0);
  const averageFutureCredits=results.length?completedCredits/results.length:20;
  const requiredAverage=(desired*(completedCredits+remainingSemesters*averageFutureCredits)-completedWeightedPoints)/(remainingSemesters*averageFutureCredits);
  const sgpaScenarios=buildSgpaScenarios(Number(targetSgpa),subjects);

  if (isGuest && !guestSessionReady) return <GuestOnboarding onComplete={() => setGuestSessionReady(true)} />;
  if (!isGuest && profileCheck === "loading") return <main className="sp-route-loading" role="status">Verifying your Gradly student profile…</main>;
  if (!isGuest && profileCheck === "error") return <main className="sp-route-loading"><h2>We could not verify your student profile.</h2><p>{notice || "Check your connection and try again."}</p><button className="sp-primary" onClick={() => setProfileCheckAttempt(value => value + 1)}>Retry profile check</button></main>;
  if (!isGuest && (profileCheck === "missing" || onboarding)) return <Navigate to="/academic-setup" replace />;

  return <div className={"sp-shell "+(isGuest?"sp-guest-mode":"sp-user-mode")+(theme==="dark"?" sp-dark-theme":"")} style={{fontFamily:`"${fontFamily}", sans-serif`,fontSize:`${textSize}px`}}>
    <aside id="student-workspace-menu" className={"sp-sidebar "+(mobileOpen?"open":"")}>
      <a className="sp-brand" href="/" onClick={e=>{e.preventDefault();navigate("home");}}><span className="sp-brand-mark">G<small>✦</small></span><span>Gradly<small>STUDENT SPACE</small></span></a>
      <div className="sp-nav-scroll">{["WORKSPACE","SGPA ANALYSIS","CGPA ANALYSIS","COMMUNITY","AI ASSISTANT","ACADEMICS","SETTINGS"].map((group,index)=><section className={"sp-nav-group sp-nav-group-"+index} key={group} aria-label={group}><div className="sp-nav-label-row"><span className="sp-nav-label">{group}</span><span className="sp-nav-count">{nav.filter(item=>item.group===group).length.toString().padStart(2,"0")}</span></div><div className="sp-nav-items">{nav.filter(item=>item.group===group).map(item=>{const locked=isGuest&&!["home","sgpa","cgpa"].includes(item.id);return <button key={item.id} className={(section===item.id?"active ":"")+(locked?"sp-nav-locked":"")} onClick={()=>navigate(item.id)} aria-current={section===item.id?"page":undefined} aria-label={locked?item.label+" — sign in to unlock":item.label}><i>{item.icon}</i><span>{item.label}</span>{locked&&<small className="sp-nav-lock" aria-hidden="true">LOCKED</small>}{section===item.id&&<b/>}</button>;})}</div></section>)}</div>
      <div className="sp-sidebar-bottom">{isGuest?<div className="sp-guest-unlock"><span>✦ THE FULL EXPERIENCE</span><strong>Your next chapter is waiting.</strong><p>Unlock planners, progress insights, community and AI study tools.</p><button onClick={()=>void loginWithGoogle()}>Unlock Gradly →</button></div>:<div className="sp-sidebar-tip"><span>✦ ACADEMIC COMPANION</span><b>Progress over perfection.</b><small>Your next chapter starts here.</small></div>}<button className="sp-signout" onClick={()=>void signOut()}>↗ {isGuest?"Exit guest mode":"Sign out"}</button></div>
    </aside>
    {mobileOpen&&<button className="sp-backdrop" aria-label="Close workspace menu" onClick={()=>setMobileOpen(false)}/>}
    <main className="sp-main">
      <header className="sp-topbar"><div className="sp-top-left"><button className="sp-menu" onClick={()=>setMobileOpen(true)} aria-label="Explore workspace" aria-controls="student-workspace-menu" aria-expanded={mobileOpen}><span/><span/><span/></button><div><small>GRADLY / STUDENT</small><strong>{title}</strong></div></div><div className="sp-top-right"><span className="sp-status"><i/> {isGuest?"GUEST MODE":"STUDENT WORKSPACE"}</span><div className="sp-profile-menu-wrap"><button className="sp-avatar sp-avatar-button" aria-label="Open profile menu" aria-expanded={profileMenuOpen} onClick={()=>setProfileMenuOpen(open=>!open)}>{(user?.displayName||localStorage.getItem("gradly_guest_id")||"G").charAt(0).toUpperCase()}</button>{profileMenuOpen&&<div className="sp-profile-dropdown"><div className="sp-profile-dropdown-head"><strong>{isGuest?(localStorage.getItem("gradly_guest_id")||"Guest"):user?.displayName||"Student"}</strong><small>{isGuest?"Guest account":user?.email||"Signed-in student"}</small></div>{!isGuest&&<><button onClick={()=>navigate("profile")}>Academic profile</button><button onClick={()=>navigate("settings")}>Settings</button></>}{isGuest&&<><button onClick={()=>void loginWithGoogle()}>Sign in to unlock</button><button className="danger" onClick={()=>void deleteGuestIdentity()}>Delete Guest ID</button></>}<button onClick={()=>void signOut()}>{isGuest?"Exit guest mode":"Log out"}</button></div>}</div></div></header>
      <div className="sp-content">
        {notice&&<div className="sp-notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        {section==="home"&&isGuest&&<>
          <section className="sp-guest-welcome">
            <div className="sp-guest-welcome-copy">
              <span className="sp-kicker">GRADLY / GUEST WORKSPACE</span>
              <h1>Your academics.<br/><em>In better focus.</em></h1>
              <p>A clean, practical space to understand your semester and cumulative performance. Your calculations stay on this device.</p>
              <div className="sp-guest-identity"><span>GUEST ID</span><strong>@{localStorage.getItem("gradly_guest_id")||"GUEST"}</strong><i><b/> ACTIVE</i></div>
              <div className="sp-guest-welcome-actions">
                <button className="sp-primary" onClick={()=>navigate("sgpa")}>Calculate SGPA <span>↗</span></button>
                <button className="sp-guest-text-action" onClick={()=>navigate("cgpa")}>Open CGPA calculator <span>→</span></button>
              </div>
            </div>
            <div className="sp-guest-visual" aria-hidden="true">
              <div className="sp-guest-visual-orbit orbit-one"/><div className="sp-guest-visual-orbit orbit-two"/>
              <div className="sp-guest-visual-glow"/><div className="sp-guest-visual-mark">G<span>✦</span></div>
              <div className="sp-guest-visual-chip chip-a"><small>YOUR ACADEMIC SPACE</small><b>Clear numbers.<br/>Better decisions.</b></div>
              <div className="sp-guest-visual-chip chip-b"><small>TOOLS READY</small><b>SGPA / CGPA</b></div>
            </div>
          </section>
          <section className="sp-guest-stats">
            <article><span>INSTITUTION</span><strong>{institutionLabel}</strong><small>Your selected academic home</small></article>
            <article><span>SAVED SEMESTERS</span><strong>{results.length.toString().padStart(2,"0")}</strong><small>SGPA records on this device</small></article>
            <article><span>CURRENT CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>{results.length?"Based on saved semester credits":"Add semester results to begin"}</small></article>
          </section>
          <div className="sp-guest-section-head"><div><span className="sp-kicker">YOUR CALCULATION TOOLS</span><h2>Start with the numbers that matter.</h2><p>Both calculators are available without signing in.</p></div><span>02 AVAILABLE</span></div>
          <div className="sp-guest-tools">
            <button className="sp-guest-tool sp-guest-tool-sgpa" onClick={()=>navigate("sgpa")}><span className="sp-guest-tool-top"><span className="sp-guest-tool-icon">∑</span><small>01 / SEMESTER</small></span><strong>SGPA calculator</strong><p>Enter subject credits and grades, calculate your semester score and save it to your progress.</p><i>Open SGPA calculator <b>↗</b></i></button>
            <button className="sp-guest-tool sp-guest-tool-cgpa" onClick={()=>navigate("cgpa")}><span className="sp-guest-tool-top"><span className="sp-guest-tool-icon">◈</span><small>02 / CUMULATIVE</small></span><strong>CGPA calculator</strong><p>Combine semester performance and credits to understand your overall academic standing.</p><i>Open CGPA calculator <b>↗</b></i></button>
          </div>
          <section className="sp-guest-full-preview">
            <div className="sp-guest-preview-head"><div><span className="sp-kicker">THE COMPLETE GRADLY WORKSPACE</span><h2>Everything else, organised for you.</h2><p>Sign in to unlock the full set of academic tools and student spaces.</p></div><button onClick={()=>void loginWithGoogle()}>Unlock full access <span>→</span></button></div>
            <div className="sp-guest-preview-groups">
              <div><span>01</span><section><strong>SGPA Analysis</strong><p>Calculator · What-if Analysis · SGPA Planner · Progress Tracker</p></section><i>⌁</i></div>
              <div><span>02</span><section><strong>CGPA Analysis</strong><p>Calculator · What-if Analysis · CGPA Planner · Progress Tracker</p></section><i>◈</i></div>
              <div><span>03</span><section><strong>Community</strong><p>Group Chat · Upcoming Events & Holidays</p></section><i>☷</i></div>
              <div><span>04</span><section><strong>AI Assistant</strong><p>AI Chatbot · AI Study Planner</p></section><i>✳</i></div>
              <div><span>05</span><section><strong>Academics</strong><p>Academic Profile · Academic Management</p></section><i>◎</i></div>
              <div><span>06</span><section><strong>Settings</strong><p>Font · Light / Dark Mode · Text Size</p></section><i>⚙</i></div>
            </div>
          </section>
          <section className="sp-guest-upgrade"><div><span className="sp-kicker">YOUR NEXT STEP</span><h2>Keep your academic journey moving.</h2><p>Create your student account to save your profile, plan targets, track progress and use every Gradly feature.</p></div><button className="sp-primary" onClick={()=>void loginWithGoogle()}>Continue with Google <span>→</span></button></section>
        </>}
        {section==="home"&&!isGuest&&<><div className="sp-hero"><div><span className="sp-kicker">YOUR ACADEMIC WORKSPACE</span><h1>Your academic journey.<br/><em>Beautifully in balance.</em></h1><p>Welcome back, {name}. A smarter space to track progress, plan ahead and stay in control.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Explore academic tools <span>→</span></button></div><div className="sp-hero-art"><div className="sp-orbit orbit-a"/><div className="sp-orbit orbit-b"/><div className="sp-orbit-core">G<span>✦</span></div><small>LEARN · PLAN · GROW</small></div></div>
          <div className="sp-metrics"><article><span>CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>{results.length} semester records saved</small></article><article><span>LATEST SGPA</span><strong>{results.length?results[results.length-1].sgpa.toFixed(2):"—"}</strong><small>Most recent saved result</small></article><article><span>CREDITS EARNED</span><strong>{earnedCredits||"0"}</strong><small>Update your credit analyser</small></article><article><span>ACADEMIC PROFILE</span><strong>{profile.institutionName?"Ready":"Setup"}</strong><small>{profile.institutionName||"Complete your onboarding"}</small></article></div>
          <div className="sp-section-row"><div><span className="sp-kicker">YOUR TOOLKIT</span><h2>Your tools. One clear direction.</h2></div><span>01 — 06</span></div>
          <div className="sp-feature-grid">{[{id:"sgpa" as Section,n:"01",t:"SGPA analysis",d:"Calculate, simulate and track semester grades.",ic:"∑"},{id:"cgpa" as Section,n:"02",t:"CGPA analysis",d:"Understand your cumulative performance.",ic:"◈"},{id:"planner" as Section,n:"03",t:"Academic planner",d:"Work backwards from your target SGPA or CGPA.",ic:"⌁"},{id:"tracker" as Section,n:"04",t:"Progress tracker",d:"Visualise your results across semesters.",ic:"▥"},{id:"community" as Section,n:"05",t:"Community & notes",d:"Share study material and talk with classmates.",ic:"☷"},{id:"assistant" as Section,n:"06",t:"Gradly AI assistant",d:"Get academic guidance in one conversation.",ic:"✳"}].map(item=><button className="sp-feature" key={item.id} onClick={()=>navigate(item.id)}><span>{item.n} / {item.ic}</span><strong>{item.t}</strong><p>{item.d}</p><i>↗</i></button>)}</div>
        </>}
        {section==="sgpa"&&<><section className="sp-calculator-hero"><div className="sp-calculator-hero-copy"><span className="sp-calc-eyebrow">GRADLY · ACADEMIC TOOLS</span><h1>SGPA calculator</h1><p>Bring your semester grades together and see your performance clearly.</p></div><div className="sp-calc-art" aria-hidden="true"><div className="sp-calc-orbit sp-calc-orbit-one"/><div className="sp-calc-orbit sp-calc-orbit-two"/><div className="sp-calc-cube"><span>G</span><i>✦</i></div><div className="sp-calc-float sp-calc-float-one">A+</div><div className="sp-calc-float sp-calc-float-two">10</div></div><div className="sp-calc-glow"/></section><div className="sp-two-col"><Card><div className="sp-card-head"><div><span>YOUR SUBJECTS</span><h2>Grade entry</h2></div><b>{subjects.length} subjects</b></div><div className="sp-subject-head"><span>SUBJECT</span><span>CREDITS</span><span>GRADE</span><span/></div>{subjects.map((s,index)=><div className="sp-subject-row" key={s.id}><input aria-label={"Subject "+(index+1)} placeholder={"Subject "+(index+1)} value={s.name} onChange={e=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,name:e.target.value}:x));setSgpa(null);}}/><input aria-label="Credits" type="number" min="0" max={isGuest?Math.max(0,20-(countedCredits-s.credits)):undefined} step="0.5" value={s.credits} onChange={e=>{const value=Math.max(0,Number(e.target.value)||0);setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,credits:isGuest?Math.min(value,Math.max(0,20-cur.filter(y=>y.id!==s.id).reduce((sum,y)=>sum+y.credits,0))):value}:x));setSgpa(null);}}/><div className="sp-grade-options" role="radiogroup" aria-label={"Choose grade for "+(s.name||"subject "+(index+1))}>{gradeNames.map(g=><button type="button" key={g} role="radio" aria-checked={s.grade===g} className={s.grade===g?"selected":""} onClick={()=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,grade:g}:x));setSgpa(null);}}><strong>{g}</strong><small>{POINTS[g]} pts</small></button>)}</div><button className="sp-remove" disabled={subjects.length===1} onClick={()=>setSubjects(cur=>cur.filter(x=>x.id!==s.id))}>×</button></div>)}<button className="sp-add" onClick={addSubject} disabled={isGuest&&countedCredits>=20}>＋ Add subject</button>{isGuest&&<div className="sp-muted">Credits used: {countedCredits.toFixed(1)} / 20 maximum</div>}<div className="sp-actions"><button className="sp-primary" onClick={calculateSgpa}>Calculate SGPA →</button>{!isGuest&&<button className="sp-secondary" onClick={saveSemester} disabled={sgpa===null}>Save to tracker</button>}</div></Card><Card className="sp-result"><span>YOUR SGPA</span><div className="sp-score">{sgpa===null?"—":sgpa.toFixed(2)}<small>/ 10</small></div><h3>{sgpa===null?"Your result appears here":"Calculation complete"}</h3><p>{sgpa===null?"Add subject names, credits and grades to calculate your semester result.":"Your weighted semester grade point average."}</p><div className="sp-result-line"><span>Counted credits</span><b>{countedCredits}</b></div><div className="sp-result-line"><span>Weighted points</span><b>{weighted.toFixed(2)}</b></div></Card></div></>}
        {section==="sgpaWhatIf"&&<><SectionTitle kicker="SGPA ANALYSIS" title="SGPA what-if analysis" copy="Change possible subject grades and credits to compare alternative semester outcomes."/><Card><div className="sp-card-head"><div><span>SCENARIO INPUT</span><h2>Compare a target against your current SGPA</h2></div></div><div className="sp-inline-form"><label>Target SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={e=>setWhatIf(e.target.value)}/></label><div className="sp-inline-result"><span>Current calculated SGPA</span><strong>{sgpa===null?"Not calculated":sgpa.toFixed(2)}</strong></div><div className="sp-inline-result"><span>Difference to target</span><strong>{sgpa===null?"—":(Number(whatIf)-sgpa).toFixed(2)}</strong></div></div><p className="sp-muted">This compares the target with the current entered grades. It does not predict official marks or guarantee a result.</p></Card></>}

{section==="sgpaPlanner"&&<><SectionTitle kicker="TARGET-BASED PLANNING" title="SGPA planner" copy="Set a target SGPA and compare several subject-wise grade combinations based on the credits you entered."/><Card><div className="sp-card-head"><div><span>YOUR TARGET</span><h2>What SGPA are you aiming for?</h2></div></div><div className="sp-inline-form"><label>Target SGPA<input type="number" min="0" max="10" step=".01" value={targetSgpa} onChange={e=>setTargetSgpa(e.target.value)}/></label><div className="sp-inline-result"><span>Subjects in your calculator</span><strong>{subjects.filter(s=>s.credits>0).length}</strong></div><div className="sp-inline-result"><span>Total subject credits</span><strong>{subjects.reduce((sum,s)=>sum+Math.max(0,s.credits),0)}</strong></div></div><p className="sp-muted">The planner uses the subjects and credits from SGPA calculator. Update those entries first if your semester load differs.</p></Card><div className="sp-feature-grid sp-plan-scenarios">{sgpaScenarios.map((plan,i)=><Card key={plan.label}><div className="sp-card-head"><div><span>SCENARIO {String(i+1).padStart(2,"0")}</span><h2>{plan.label}</h2></div></div><div className="sp-score">{plan.projected.toFixed(2)}<small> projected SGPA</small></div><p className="sp-muted">{plan.description}</p>{subjects.filter(s=>s.credits>0).map((subject,index)=><div className="sp-history-row" key={subject.id}><span>{subject.name.trim()||"Subject "+(index+1)} · {subject.credits} credits</span><strong>{plan.grades[subject.id]||"D"} · {POINTS[plan.grades[subject.id]||"D"]}</strong></div>)}</Card>)}</div><p className="sp-muted">These are mathematical planning scenarios using the GECA reference points. They are not predictions of awarded grades. Your institution's current scheme and official marksheet remain authoritative.</p></>}

{section==="cgpa"&&<>{isGuest?<><section className="sp-calculator-hero sp-cgpa-calculator-hero"><div className="sp-calculator-hero-copy"><span className="sp-calc-eyebrow">GRADLY · ACADEMIC TOOLS</span><h1>CGPA calculator</h1><p>Bring every completed semester together and see your cumulative performance.</p></div><div className="sp-calc-glow"/></section><div className="sp-cgpa-workspace-grid"><Card><div className="sp-card-head"><div><span>SEMESTER INPUT</span><h2>Enter semester results</h2></div><b>{guestCgpaRows.length} rows</b></div><div className="sp-subject-head sp-cgpa-input-head"><span>SEMESTER</span><span>SGPA</span><span>CREDITS</span><span/></div>{guestCgpaRows.map((row,index)=><div className="sp-subject-row sp-cgpa-input-row" key={row.id}><select aria-label={"Semester "+(index+1)} value={row.semester} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,semester:e.target.value}:x));setGuestCgpaResult(null);}}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Sem {i+1}</option>)}</select><input aria-label="Semester SGPA" type="number" min="0" max="10" step=".01" placeholder="e.g. 8.25" value={row.sgpa} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,sgpa:e.target.value}:x));setGuestCgpaResult(null);}}/><input aria-label="Semester credits" type="number" min="1" max="20" step=".5" placeholder="Credits" value={row.credits} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,credits:e.target.value}:x));setGuestCgpaResult(null);}}/><button className="sp-remove" aria-label="Remove semester" disabled={guestCgpaRows.length===1} onClick={()=>{setGuestCgpaRows(rows=>rows.filter(x=>x.id!==row.id));setGuestCgpaResult(null);}}>×</button></div>)}<div className="sp-actions"><button className="sp-add" onClick={()=>setGuestCgpaRows(rows=>[...rows,{id:Math.max(0,...rows.map(x=>x.id))+1,semester:String(Math.min(12,rows.length+1)),sgpa:"",credits:""}])} disabled={guestCgpaRows.length>=12}>＋ Add semester</button><button className="sp-primary" onClick={()=>{const valid=guestCgpaRows.filter(x=>x.sgpa!==""&&x.credits!==""&&Number(x.sgpa)>=0&&Number(x.sgpa)<=10&&Number(x.credits)>0&&Number(x.credits)<=20);if(!valid.length||valid.length!==guestCgpaRows.length){setNotice("Enter a valid SGPA from 0 to 10 and credits from 1 to 20 for every semester.");setGuestCgpaResult(null);return;}const credits=valid.reduce((sum,x)=>sum+Number(x.credits),0);setGuestCgpaResult(valid.reduce((sum,x)=>sum+Number(x.sgpa)*Number(x.credits),0)/credits);}}>Calculate CGPA →</button><button className="sp-secondary" onClick={()=>{setGuestCgpaRows([{id:1,semester:"1",sgpa:"",credits:""}]);setGuestCgpaResult(null);}}>Reset</button></div></Card><Card className="sp-result sp-cgpa-result-panel"><span>YOUR CGPA</span><div className="sp-score">{guestCgpaResult===null?"—":guestCgpaResult.toFixed(2)}<small>/ 10</small></div><h3>{guestCgpaResult===null?"Your result appears here":"Calculation complete"}</h3><p>Credit-weighted cumulative grade point average from the semester entries above.</p><div className="sp-result-line"><span>Semesters entered</span><b>{guestCgpaRows.length}</b></div><div className="sp-result-line"><span>Total credits</span><b>{guestCgpaRows.reduce((sum,x)=>sum+(Number(x.credits)||0),0)}</b></div></Card></div></>:<><div className="sp-metrics"><article><span>CURRENT CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>Credit-weighted from saved records</small></article><article><span>SEMESTERS SAVED</span><strong>{results.length}</strong><small>Academic history</small></article><article><span>TOTAL CREDITS</span><strong>{cgpaCredits}</strong><small>Across saved semesters</small></article><article><span>WEIGHTED POINTS</span><strong>{results.reduce((s,r)=>s+r.sgpa*r.credits,0).toFixed(1)}</strong><small>SGPA × semester credits</small></article></div><Card><div className="sp-card-head"><div><span>SEMESTER HISTORY</span><h2>Saved academic results</h2></div></div>{results.length?results.map(r=><div className="sp-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(2)} SGPA</strong><button onClick={()=>{const next=results.filter(x=>x.id!==r.id);setResults(next);localStorage.setItem("gradly_semester_results",JSON.stringify(next));}}>Remove</button></div>):<div className="sp-empty"><span>◈</span><h3>Your academic history starts here</h3><p>Calculate and save a semester SGPA to build your CGPA profile.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Calculate SGPA →</button></div>}</Card></>}</>}

{section==="cgpaWhatIf"&&<><SectionTitle kicker="CGPA ANALYSIS" title="CGPA what-if analysis" copy="Model how a future semester result could change your cumulative grade point average."/><Card><div className="sp-card-head"><div><span>FUTURE SEMESTER SIMULATION</span><h2>Try a hypothetical result</h2></div></div><div className="sp-inline-form"><label>Hypothetical SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={e=>setWhatIf(e.target.value)}/></label><label>Next semester credits<input type="number" min="1" value={totalCredits} onChange={e=>setTotalCredits(e.target.value)}/></label><div className="sp-inline-result"><span>Projected CGPA</span><strong>{cgpaCredits+Number(totalCredits)>0?((cgpaValue*cgpaCredits+Number(whatIf)*Number(totalCredits))/(cgpaCredits+Number(totalCredits))).toFixed(2):"—"}</strong></div></div><p className="sp-muted">Projection is credit-weighted using the semester credits entered. It is an estimate, not an official result.</p></Card></>}

{section==="cgpaTracker"&&<><SectionTitle kicker="CUMULATIVE PERFORMANCE" title="CGPA progress tracker" copy="Track how your credit-weighted CGPA changes as you add semester results."/><Card><div className="sp-card-head"><div><span>CUMULATIVE TREND</span><h2>CGPA after each semester</h2></div><b>{results.length} records</b></div>{results.length?<div className="sp-chart">{results.reduce((acc,row)=>{const prev=acc.length?acc[acc.length-1]:{credits:0,points:0};const credits=prev.credits+row.credits;const points=prev.points+row.sgpa*row.credits;acc.push({semester:row.semester,cgpa:credits?points/credits:0,credits,points});return acc;},[] as {semester:number;cgpa:number;credits:number;points:number}[]).map(row=><div className="sp-bar-col" key={row.semester}><strong>{row.cgpa.toFixed(2)}</strong><div className="sp-bar-track"><i style={{height:(row.cgpa*10)+"%"}}/></div><span>Sem {row.semester}</span></div>)}</div>:<div className="sp-empty"><span>▥</span><h3>No cumulative history yet</h3><p>Save semester SGPA and credit records to build your CGPA graph.</p></div>}</Card></>}

{section==="planner"&&<><SectionTitle kicker="GOAL-BASED PLANNING" title="CGPA planner" copy="Set a target CGPA and estimate the credit-weighted performance needed in your remaining semesters."/><Card><div className="sp-card-head"><div><span>CGPA GOAL PLANNER</span><h2>What do you want to achieve?</h2></div></div><div className="sp-inline-form"><label>Desired final CGPA<input type="number" min="0" max="10" step=".01" value={targetSgpa} onChange={e=>setTargetSgpa(e.target.value)}/></label><label>Expected total semesters<input type="number" min={Math.max(1,results.length+1)} max="12" value={remainingSemesters+results.length} readOnly/></label></div><div className="sp-plan-result"><span>ESTIMATED AVERAGE SGPA NEEDED IN REMAINING SEMESTERS</span><strong>{results.length?requiredAverage.toFixed(2):"Enter and save your semester results first"}</strong><p>{results.length?(requiredAverage>10?"This target is not mathematically reachable under a 10-point scale using the current assumptions.":requiredAverage<=0?"Your saved results already meet or exceed this target.":"This estimate uses your saved semester credits and the average credits per future semester; actual future credit loads may change the requirement."):"Your saved academic history is needed to calculate a meaningful target."}</p></div><button className="sp-primary" onClick={()=>navigate("sgpa")}>Plan a semester SGPA →</button></Card><Card><div className="sp-card-head"><div><span>PLANNING CHECKLIST</span><h2>Build a practical plan</h2></div></div><ul className="sp-checklist"><li>Review your current subject credits and grade points.</li><li>Identify subjects where focused study can improve your grade.</li><li>Use what-if analysis before finalising your semester target.</li><li>Save official results to keep your tracker accurate.</li></ul></Card></>}
        {section==="tracker"&&<><SectionTitle kicker="PERFORMANCE OVER TIME" title="SGPA progress tracker" copy="A visual record of your saved semester results. Add results to see your progress chart grow."/><Card><div className="sp-card-head"><div><span>SEMESTER PERFORMANCE</span><h2>Your SGPA trend</h2></div><b>{results.length} records</b></div>{results.length?<div className="sp-chart">{results.map(r=><div className="sp-bar-col" key={r.id}><strong>{r.sgpa.toFixed(2)}</strong><div className="sp-bar-track"><i style={{height:(r.sgpa*10)+"%"}}/></div><span>Sem {r.semester}</span></div>)}</div>:<div className="sp-empty"><span>▥</span><h3>No results to chart yet</h3><p>Your semester-wise graph will appear after you save an SGPA calculation.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Add first result →</button></div>}</Card><Card><div className="sp-card-head"><div><span>PERFORMANCE LOG</span><h2>Semester records</h2></div></div>{results.map(r=><div className="sp-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(2)} / 10</strong><small>{new Date(r.savedAt).toLocaleDateString()}</small></div>)}</Card></>}
        {section==="credits"&&<><SectionTitle kicker="ACADEMIC ELIGIBILITY" title="Credit analyser" copy="Understand how many credits you have completed and how many remain against your programme requirement."/><Card><div className="sp-card-head"><div><span>CREDIT COMPLETION</span><h2>Your academic credit progress</h2></div></div><div className="sp-inline-form"><label>Required credits<input type="number" min="1" value={totalCredits} onChange={e=>setTotalCredits(e.target.value)}/></label><label>Earned credits<input type="number" min="0" value={earnedCredits} onChange={e=>setEarnedCredits(e.target.value)}/></label></div><div className="sp-credit-visual"><div><strong>{remainingCredits}</strong><span>credits remaining</span></div><div className="sp-credit-track"><i style={{width:Math.min(100,Number(totalCredits)>0?Number(earnedCredits)/Number(totalCredits)*100:0)+"%"}}/></div><div className="sp-credit-labels"><span>{earnedCredits||0} earned</span><span>{totalCredits||0} required</span></div></div><p className="sp-muted">Enter the credit requirement published by your institution. Eligibility rules, compulsory courses and minimum grade conditions must also be checked before treating this as an official clearance.</p></Card></>}
        {section==="community"&&<><SectionTitle kicker="LEARN TOGETHER" title="Community group chat" copy="A shared study space for classmates to exchange questions and learning material."/><div className="sp-two-col"><Card><div className="sp-card-head"><div><span>STUDENT DISCUSSION</span><h2>Group conversation</h2></div><b>Preview</b></div><div className="sp-chat-list">{messages.map(m=><div className={"sp-chat-message "+(m.mine?"mine":"")} key={m.id}><div><b>{m.author}</b><small>{m.time}</small></div><p>{m.body}</p>{m.mine&&<div className="sp-message-actions"><button onClick={()=>{setEditingId(m.id);setMessage(m.body);}}>Edit</button><button onClick={()=>setMessages(cur=>cur.filter(x=>x.id!==m.id))}>Delete</button></div>}</div>)}</div><form className="sp-chat-compose" onSubmit={submitMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder={editingId?"Edit your message…":"Write a message…"}/><button className="sp-primary">{editingId?"Save":"Send"} →</button></form><small className="sp-muted">Frontend preview: messages are currently local to this browser, not shared with other students.</small></Card><Card><div className="sp-card-head"><div><span>STUDY MATERIAL</span><h2>Notes library</h2></div></div><button className="sp-upload" onClick={()=>fileRef.current?.click()}>＋ Upload notes or documents</button><input ref={fileRef} type="file" hidden multiple onChange={e=>setNotes(cur=>[...cur,...Array.from(e.target.files||[]).map(f=>({name:f.name,size:(f.size/1024).toFixed(0)+" KB",file:f}))])}/>{notes.length?notes.map((n,i)=><div className="sp-note-row" key={i}><span>▤</span><div><b>{n.name}</b><small>{n.size}</small></div><button onClick={()=>setNotes(cur=>cur.filter((_,j)=>i!==j))}>Remove</button></div>):<div className="sp-empty compact"><span>▤</span><p>Your uploaded files will appear here in this preview.</p></div>}<small className="sp-muted">Cloud sharing and downloads will activate with the notes-storage API.</small></Card></div></>}
        {section==="events"&&<><SectionTitle kicker="COMMUNITY" title="Upcoming events & holidays" copy="A shared calendar for academic events, campus activities and holidays."/><Card><div className="sp-card-head"><div><span>EVENT CALENDAR</span><h2>What's coming up</h2></div><b>Campus feed</b></div><div className="sp-empty"><span>✦</span><h3>Campus calendar is ready for connection</h3><p>Upcoming events and official holiday lists will appear here once an institution calendar feed is connected. No dates are invented in this preview.</p></div></Card></>}

{section==="assistant"&&<><SectionTitle kicker="YOUR ACADEMIC COMPANION" title="AI chatbot" copy="Ask questions about study planning, concepts and your academic journey."/><Card className="sp-ai-card"><div className="sp-ai-head"><span>✳</span><div><b>Gradly AI</b><small>Academic assistant · preview</small></div><i/></div><div className="sp-ai-thread">{aiMessages.map((m,i)=><div className={"sp-ai-bubble "+m.role} key={i}>{m.text}</div>)}</div><form className="sp-chat-compose" onSubmit={submitAi}><input value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Ask an academic question…"/><button className="sp-primary">Send →</button></form><p className="sp-muted">This interface is a frontend preview. Institution-specific answers require approved college documents, a retrieval system and a connected AI service. Do not rely on this preview for official rules.</p></Card></>}
        {section==="aiStudyPlanner"&&<><SectionTitle kicker="AI ASSISTANT" title="AI study planner" copy="Create a study routine around your subjects, deadlines and available time."/><Card><div className="sp-card-head"><div><span>STUDY PLAN SETUP</span><h2>Build your weekly study plan</h2></div></div><div className="sp-inline-form"><label>Daily study time<input type="number" min="1" max="16" defaultValue="3"/></label><label>Priority subject<input placeholder="e.g. Engineering Mathematics"/></label><label>Target date<input type="date"/></label></div><div className="sp-empty compact"><span>✳</span><p>Connect the AI planner service to generate and adapt a personalised schedule. This screen is the setup interface; it will not pretend a plan was generated.</p></div></Card></>}

{section==="academicManagement"&&<><SectionTitle kicker="ACADEMICS" title="Academic management" copy="Manage the academic records connected to your student profile."/><Card><div className="sp-card-head"><div><span>ACADEMIC RECORD</span><h2>Institution and programme</h2></div></div><div className="sp-profile-grid"><div><span>Institution</span><b>{profile.institutionName||"Not selected"}</b></div><div><span>Programme</span><b>{profile.programName||"Not configured"}</b></div><div><span>Branch</span><b>{profile.branchName||"Not configured"}</b></div><div><span>Current semester</span><b>{profile.semester||"Not configured"}</b></div><div><span>Admission mode</span><b>{profile.admissionMode||"Not configured"}</b></div><div><span>Scheme</span><b>{profile.scheme||"Not configured"}</b></div></div><button className="sp-primary" onClick={()=>setOnboarding(true)}>Manage academic profile →</button></Card></>}

{section==="settings"&&<><SectionTitle kicker="YOUR WORKSPACE" title="Personalise Gradly" copy="Make your academic workspace comfortable, clear and easy to use."/><Card className="sp-preference-card"><div className="sp-card-head"><div><span>DISPLAY EXPERIENCE</span><h2>Choose your appearance</h2></div></div><div className="sp-theme-choices">{[{id:"light",icon:"☀",label:"Light",copy:"Bright and focused"},{id:"dark",icon:"☾",label:"Dark",copy:"Easy on the eyes"},{id:"system",icon:"◐",label:"Device",copy:"Follow your device"}].map(option=><button type="button" key={option.id} className={themeMode===option.id?"selected":""} onClick={()=>{setThemeMode(option.id as "light"|"dark"|"system");updateSetting("gradly_theme",option.id);}}><span>{option.icon}</span><strong>{option.label}</strong><small>{option.copy}</small>{themeMode===option.id&&<b>✓ Selected</b>}</button>)}</div></Card><Card className="sp-preference-card"><div className="sp-card-head"><div><span>READABILITY</span><h2>Typography</h2></div></div><div className="sp-inline-form"><label>Font family<select value={fontFamily} onChange={e=>{setFontFamily(e.target.value);updateSetting("gradly_font_family",e.target.value);}}><option>DM Sans</option><option>Manrope</option><option>Inter</option><option>Arial</option><option>Georgia</option><option>Verdana</option></select></label><label>Text size · {textSize}px<input type="range" min="12" max="20" value={textSize} onChange={e=>{setTextSize(Number(e.target.value));updateSetting("gradly_text_size",e.target.value);}}/></label></div><div className="sp-type-preview" style={{fontFamily,fontSize:textSize+"px"}}>The quick brown fox jumps over the lazy dog. <strong>Academic progress, made clearer.</strong></div><p className="sp-muted">Your appearance and typography preferences are saved in this browser.</p></Card></>}

{section==="profile"&&<><SectionTitle kicker="YOUR DETAILS" title="Academic profile" copy="Review and update your institution and academic identity."/><Card><div className="sp-card-head"><div><span>STUDENT IDENTITY</span><h2>{user?.displayName||"Student"}</h2></div><span className="sp-status"><i/> Google verified</span></div><div className="sp-profile-grid"><div><span>Email</span><b>{user?.email||"—"}</b></div><div><span>Institution</span><b>{profile.institutionName||"Not selected"}</b></div><div><span>Programme</span><b>{profile.programName||"—"}</b></div><div><span>Branch</span><b>{profile.branchName||"—"}</b></div><div><span>Semester</span><b>{profile.semester||"—"}</b></div><div><span>Enrollment</span><b>{profile.enrollment||"—"}</b></div><div><span>Admission mode</span><b>{profile.admissionMode||"—"}</b></div><div><span>Scheme</span><b>{profile.scheme||"—"}</b></div></div><button className="sp-primary" onClick={()=>setOnboarding(true)}>Edit academic profile →</button></Card><Card><div className="sp-card-head"><div><span>SUPPORT</span><h2>Contact the developer</h2></div></div><p className="sp-muted">Report an issue, suggest a feature or share feedback about Gradly.</p><a className="sp-primary sp-link" href="https://github.com/jugal4096/gradly/issues" target="_blank" rel="noreferrer">Contact developer ↗</a></Card></>}
      </div>
      <footer className="sp-footer"><span>© {new Date().getFullYear()} Gradly</span><span>CALCULATE · UNDERSTAND · PLAN</span><span>Built for your next chapter ✦</span></footer>
    </main>

    {loginGate&&<div className="sp-modal-backdrop top"><section className="sp-modal sp-request-modal"><div className="sp-modal-head"><div><span className="sp-kicker">GRADLY ACCOUNT</span><h2>Unlock your student workspace</h2><p>This feature is available to signed-in students. Your guest calculations remain on this device.</p></div><button onClick={()=>setLoginGate(false)}>×</button></div><div className="sp-actions"><button className="sp-primary" onClick={()=>void loginWithGoogle()}>Continue with Google →</button><button className="sp-secondary" onClick={()=>setLoginGate(false)}>Maybe later</button></div></section></div>}

  </div>;
}
