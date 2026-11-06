import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import "./StudentPlatform.css";
import InstitutionDiscovery, { type DiscoveryInstitution } from "./InstitutionDiscovery";

type Section = "home" | "sgpa" | "cgpa" | "planner" | "tracker" | "community" | "assistant" | "credits" | "profile";
type Branch = { id: string; name: string; code?: string | null; program_id: string; program_name: string; program_level?: string | null };
type Institution = { id: string; name: string; branches: Branch[] };
type Profile = { institutionId: string; institutionName: string; programId: string; programName: string; branchId: string; branchName: string; semester: string; enrollment: string; admissionMode: string; admissionNumber: string; scheme: string };
type Subject = { id: number; name: string; credits: number; grade: string };
type SemesterResult = { id: string; semester: number; sgpa: number; credits: number; savedAt: string };
type ChatMessage = { id: number; author: string; body: string; time: string; mine: boolean };

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const POINTS: Record<string, number> = { "O":10, "A+":9, "A":8, "B+":7, "B":6, "C":5, "P":4, "F":0 };
const gradeNames = Object.keys(POINTS);
const emptyProfile: Profile = { institutionId:"", institutionName:"", programId:"", programName:"", branchId:"", branchName:"", semester:"", enrollment:"", admissionMode:"Regular", admissionNumber:"", scheme:"" };
const nav: { id: Section; label: string; icon: string; group: string }[] = [
  { id:"home",label:"Overview",icon:"⌂",group:"WORKSPACE" },
  { id:"sgpa",label:"SGPA analysis",icon:"∑",group:"ACADEMICS" },
  { id:"cgpa",label:"CGPA analysis",icon:"◈",group:"ACADEMICS" },
  { id:"planner",label:"Academic planner",icon:"⌁",group:"ACADEMICS" },
  { id:"tracker",label:"Progress tracker",icon:"▥",group:"ACADEMICS" },
  { id:"credits",label:"Credit analyser",icon:"◇",group:"ACADEMICS" },
  { id:"community",label:"Group chat & notes",icon:"☷",group:"COMMUNITY" },
  { id:"assistant",label:"Gradly AI",icon:"✳",group:"COMMUNITY" },
  { id:"profile",label:"Academic profile",icon:"◎",group:"ACCOUNT" },
];

function SectionTitle({ kicker, title, copy }: { kicker:string; title:string; copy:string }) {
  return <div className="sp-heading"><span>{kicker}</span><h1>{title}</h1><p>{copy}</p></div>;
}
function Card({ children, className="" }: { children: ReactNode; className?: string }) {
  return <section className={"sp-card "+className}>{children}</section>;
}

export default function StudentPlatform() {
  const { user, isGuest, signOut, loginWithGoogle } = useAuth();
  const [section,setSection] = useState<Section>("home");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [institutions,setInstitutions] = useState<Institution[]>([]);
  const [institutionLoading,setInstitutionLoading] = useState(true);
  const [institutionError,setInstitutionError] = useState("");
  const [profile,setProfile] = useState<Profile>(() => {
    try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem("gradly_student_profile") || "{}") }; }
    catch { return emptyProfile; }
  });
  const [onboarding,setOnboarding] = useState(() => !isGuest && !profile.institutionId);
  const [guestInstitutionId,setGuestInstitutionId] = useState(() => localStorage.getItem("gradly_guest_institute") || "");
  const [guestInstitutionName,setGuestInstitutionName] = useState(() => localStorage.getItem("gradly_guest_institute_name") || "");
  const [guestSemester,setGuestSemester] = useState("1");
  const [loginGate,setLoginGate] = useState(false);
  const [notice,setNotice] = useState("");
  const [subjects,setSubjects] = useState<Subject[]>(() => {
    if (isGuest) {
      try { const saved=JSON.parse(localStorage.getItem("gradly_guest_subjects") || "null"); if(Array.isArray(saved)&&saved.length) return saved; } catch { /* use defaults */ }
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
    let active = true;
    fetch(API+"/api/academic/institutions")
      .then(async response => { const data=await response.json(); if(!response.ok) throw new Error(data.message || "Unable to load institutions."); return data; })
      .then(data => { if(active) setInstitutions(Array.isArray(data.data)?data.data:[]); })
      .catch(error => { if(active) setInstitutionError(error instanceof Error?error.message:"Unable to load institutions."); })
      .finally(() => { if(active) setInstitutionLoading(false); });
    return () => { active=false; };
  }, []);


  const selectedInstitution = useMemo(()=>institutions.find(item=>item.id===(isGuest ? guestInstitutionId : profile.institutionId)) || (isGuest && guestInstitutionId ? {id:guestInstitutionId,name:guestInstitutionName,branches:[]} : undefined),[institutions,isGuest,guestInstitutionId,guestInstitutionName,profile.institutionId]);
  const programs = useMemo(() => {
    const map = new Map<string,{id:string;name:string;level?:string|null}>();
    (selectedInstitution?.branches || []).forEach(branch=>map.set(branch.program_id,{id:branch.program_id,name:branch.program_name,level:branch.program_level}));
    return Array.from(map.values());
  },[selectedInstitution]);
  const branches = (selectedInstitution?.branches || []).filter(item=>!profile.programId || item.program_id===profile.programId);
  const weighted = subjects.filter(s=>s.name.trim() && s.credits>0).reduce((sum,s)=>sum+POINTS[s.grade]*s.credits,0);
  const countedCredits = subjects.filter(s=>s.name.trim() && s.credits>0).reduce((sum,s)=>sum+s.credits,0);
  const guestCreditTotal = subjects.reduce((sum,s)=>sum+Math.max(0,s.credits),0);
  const computedSgpa = countedCredits ? weighted/countedCredits : 0;
  const cgpaCredits = results.reduce((sum,r)=>sum+r.credits,0);
  const cgpaValue = cgpaCredits ? results.reduce((sum,r)=>sum+r.sgpa*r.credits,0)/cgpaCredits : 0;
  const name = user?.displayName?.split(" ")[0] || "Guest";
  const title = nav.find(item=>item.id===section)?.label || "Overview";

  function saveProfile(next:Profile) {
    setProfile(next);
    localStorage.setItem("gradly_student_profile",JSON.stringify(next));
    setOnboarding(false);
    setNotice("Academic profile saved on this device. Server-side profile sync will be connected to the student-profile API.");
  }
  function updateProfile(patch:Partial<Profile>) { setProfile(current=>({...current,...patch})); }
  function addSubject() {
    if (isGuest && guestCreditTotal >= 20) { setNotice("Guest mode allows a maximum of 20 credits per semester."); return; }
    setSubjects(current=>[...current,{id:Math.max(0,...current.map(s=>s.id))+1,name:isGuest?`Subject ${current.length+1}`:"",credits:isGuest?Math.min(1,Math.max(0,20-guestCreditTotal)):3,grade:"A"}]); setSgpa(null);
  }
  function calculateSgpa() {
    if(!countedCredits) { setNotice("Add at least one subject with a name and positive credits."); return; }
    setSgpa(computedSgpa);
  }
  function saveSemester() {
    if(sgpa===null) { setNotice("Calculate your SGPA before saving it."); return; }
    const row:SemesterResult={id:crypto.randomUUID(),semester:isGuest?Number(guestSemester):(Number(profile.semester)||results.length+1),sgpa,credits:countedCredits,savedAt:new Date().toISOString()};
    const next=[...results.filter(item=>item.semester!==row.semester),row].sort((a,b)=>a.semester-b.semester);
    setResults(next); localStorage.setItem(isGuest?"gradly_guest_semester_results":"gradly_semester_results",JSON.stringify(next));
    setNotice("Semester result added to your academic tracker.");
  }
  function navigate(next:Section) {
    if (isGuest && !["home","sgpa","cgpa"].includes(next)) { setLoginGate(true); setMobileOpen(false); return; }
    setSection(next); setMobileOpen(false); setNotice("");
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
  const remainingSemesters=Math.max(1,8-results.length);
  const requiredAverage=(desired*8-results.reduce((sum,r)=>sum+r.sgpa,0))/remainingSemesters;

  return <div className="sp-shell">
    <aside className={"sp-sidebar "+(mobileOpen?"open":"")}>
      <a className="sp-brand" href="/" onClick={e=>{e.preventDefault();navigate("home");}}><span className="sp-brand-mark">G<small>✦</small></span><span>Gradly<small>STUDENT SPACE</small></span></a>
      <div className="sp-nav-scroll">{["WORKSPACE","ACADEMICS","COMMUNITY","ACCOUNT"].map(group=><div className="sp-nav-group" key={group}><span className="sp-nav-label">{group}</span>{nav.filter(item=>item.group===group).map(item=><button key={item.id} className={section===item.id?"active":""} onClick={()=>navigate(item.id)}><i>{item.icon}</i>{item.label}{section===item.id&&<b/>}</button>)}</div>)}</div>
      <div className="sp-sidebar-bottom"><div className="sp-sidebar-tip"><span>✦ ACADEMIC COMPANION</span><b>Progress over perfection.</b><small>Your next chapter starts here.</small></div><button className="sp-signout" onClick={()=>void signOut()}>↗ Sign out</button></div>
    </aside>
    {mobileOpen&&<button className="sp-backdrop" aria-label="Close menu" onClick={()=>setMobileOpen(false)}/>}
    <main className="sp-main">
      <header className="sp-topbar"><div className="sp-top-left"><button className="sp-menu" onClick={()=>setMobileOpen(true)} aria-label="Open navigation">☰</button><div><small>GRADLY / STUDENT</small><strong>{title}</strong></div></div><div className="sp-top-right"><span className="sp-status"><i/> {isGuest?"Guest calculator":"Student workspace"}</span><span className="sp-avatar">{(user?.displayName||"G").charAt(0).toUpperCase()}</span></div></header>
      <div className="sp-content">
        {notice&&<div className="sp-notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        {section==="home"&&isGuest&&<><div className="sp-hero sp-guest-hero"><div><span className="sp-kicker">GUEST CALCULATOR MODE</span><h1>Calculate first.<br/><em>Sign in when ready.</em></h1><p>No profile setup. Choose your institution and enter your academic details manually.</p><InstitutionDiscovery isGuest={true} user={user} selectedId={guestInstitutionId} onSelect={(item:DiscoveryInstitution)=>{setGuestInstitutionId(item.id);setGuestInstitutionName(item.name);localStorage.setItem("gradly_guest_institute",item.id);localStorage.setItem("gradly_guest_institute_name",item.name);setNotice("Institution selected for your guest calculator.");}}/><button className="sp-primary" onClick={()=>navigate("sgpa")}>Open SGPA calculator →</button></div><div className="sp-hero-art"><div className="sp-orbit orbit-a"/><div className="sp-orbit orbit-b"/><div className="sp-orbit-core">G<span>✦</span></div><small>MANUAL · SIMPLE · QUICK</small></div></div><div className="sp-metrics"><article><span>INSTITUTION</span><strong>{selectedInstitution?.name?"Selected":"—"}</strong><small>{selectedInstitution?.name||"Optional institution selection"}</small></article><article><span>SEMESTERS SAVED</span><strong>{results.length}</strong><small>Manual guest records</small></article><article><span>CURRENT SGPA</span><strong>{results.length?results[results.length-1].sgpa.toFixed(2):"—"}</strong><small>Latest saved result</small></article><article><span>ACCESS</span><strong>Guest</strong><small>Sign in to unlock all tools</small></article></div><div className="sp-section-row"><div><span className="sp-kicker">AVAILABLE TOOLS</span><h2>Start calculating.</h2></div><span>01 — 02</span></div><div className="sp-feature-grid">{[{id:"sgpa" as Section,n:"01",t:"SGPA analysis",d:"Manually add subjects, grades and credits.",ic:"∑"},{id:"cgpa" as Section,n:"02",t:"CGPA analysis",d:"Save semester results and calculate CGPA.",ic:"◈"},{id:"planner" as Section,n:"03",t:"Academic planner",d:"Plan target academic performance.",ic:"⌁"},{id:"tracker" as Section,n:"04",t:"Progress tracker",d:"Review semester-wise progress.",ic:"▥"},{id:"credits" as Section,n:"05",t:"Credit analyser",d:"Review credit completion.",ic:"◇"},{id:"community" as Section,n:"06",t:"Group chat & notes",d:"Connect with classmates and share notes.",ic:"☷"},{id:"assistant" as Section,n:"07",t:"Gradly AI",d:"Get academic guidance.",ic:"✳"},{id:"profile" as Section,n:"08",t:"Academic profile",d:"Create a full student profile after signing in.",ic:"◎"}].map(item=><button className="sp-feature" key={item.id} onClick={()=>navigate(item.id)}><span>{item.n} / {item.ic} · {["sgpa","cgpa"].includes(item.id)?"AVAILABLE":"SIGN IN TO UNLOCK"}</span><strong>{item.t}</strong><p>{item.d}</p><i>{["sgpa","cgpa"].includes(item.id)?"↗":"🔒"}</i></button>)}</div></>}
        {section==="home"&&!isGuest&&<><div className="sp-hero"><div><span className="sp-kicker">YOUR ACADEMIC WORKSPACE</span><h1>Make your next semester<br/><em>your strongest yet.</em></h1><p>Welcome back, {name}. Your academic journey, organised in one place.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Explore academic tools <span>→</span></button></div><div className="sp-hero-art"><div className="sp-orbit orbit-a"/><div className="sp-orbit orbit-b"/><div className="sp-orbit-core">G<span>✦</span></div><small>LEARN · PLAN · GROW</small></div></div>
          <div className="sp-metrics"><article><span>CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>{results.length} semester records saved</small></article><article><span>LATEST SGPA</span><strong>{results.length?results[results.length-1].sgpa.toFixed(2):"—"}</strong><small>Most recent saved result</small></article><article><span>CREDITS EARNED</span><strong>{earnedCredits||"0"}</strong><small>Update your credit analyser</small></article><article><span>ACADEMIC PROFILE</span><strong>{profile.institutionName?"Ready":"Setup"}</strong><small>{profile.institutionName||"Complete your onboarding"}</small></article></div>
          <div className="sp-section-row"><div><span className="sp-kicker">YOUR TOOLKIT</span><h2>Everything in one place.</h2></div><span>01 — 06</span></div>
          <div className="sp-feature-grid">{[{id:"sgpa" as Section,n:"01",t:"SGPA analysis",d:"Calculate, simulate and track semester grades.",ic:"∑"},{id:"cgpa" as Section,n:"02",t:"CGPA analysis",d:"Understand your cumulative performance.",ic:"◈"},{id:"planner" as Section,n:"03",t:"Academic planner",d:"Work backwards from your target SGPA or CGPA.",ic:"⌁"},{id:"tracker" as Section,n:"04",t:"Progress tracker",d:"Visualise your results across semesters.",ic:"▥"},{id:"community" as Section,n:"05",t:"Community & notes",d:"Share study material and talk with classmates.",ic:"☷"},{id:"assistant" as Section,n:"06",t:"Gradly AI assistant",d:"Get academic guidance in one conversation.",ic:"✳"}].map(item=><button className="sp-feature" key={item.id} onClick={()=>navigate(item.id)}><span>{item.n} / {item.ic}</span><strong>{item.t}</strong><p>{item.d}</p><i>↗</i></button>)}</div>
        </>}
        {section==="sgpa"&&<><SectionTitle kicker="SEMESTER PERFORMANCE" title="SGPA analysis" copy={isGuest?"Guest mode: enter everything manually. Subject labels are editable and credits are capped at 20 total.":"Enter subject-wise grades and credits, test different outcomes and save your semester result."}/>{isGuest&&<div className="sp-rule"><span>GUEST INSTITUTION</span><strong>{selectedInstitution?.name||"No institution selected"}</strong><small>Institution selection does not load subjects or grading rules. This is a manual calculator using the displayed sample grade-point scale.</small></div>}<div className="sp-rule"><span>WEIGHTED GRADE POINT</span><strong>Σ (subject credits × grade points) ÷ total credits</strong><small>{isGuest?"Guest calculator sample scale: O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0. Verify your institution rules.":"Grade points shown here are a configurable default. Your institution's approved grading scheme must take precedence."}</small>{isGuest&&<div className="sp-inline-form"><label>Semester to save<select value={guestSemester} onChange={e=>setGuestSemester(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Semester {i+1}</option>)}</select></label></div>}<div className="sp-rule-actions"><button className="sp-secondary" onClick={()=>setNotice("Automatic result fetching requires a verified institution result source or official integration. The connector is not available yet.")}>Fetch grade-wise result ↗</button><span>Manual entry is available now</span></div></div><div className="sp-two-col"><Card><div className="sp-card-head"><div><span>YOUR SUBJECTS</span><h2>Grade entry</h2></div><b>{subjects.length} subjects</b></div><div className="sp-subject-head"><span>SUBJECT</span><span>CREDITS</span><span>GRADE</span><span/></div>{subjects.map((s,index)=><div className="sp-subject-row" key={s.id}><input aria-label={"Subject "+(index+1)} placeholder={"Subject "+(index+1)} value={s.name} onChange={e=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,name:e.target.value}:x));setSgpa(null);}}/><input aria-label="Credits" type="number" min="0" max={isGuest?Math.max(0,20-(guestCreditTotal-s.credits)):undefined} step="0.5" value={s.credits} onChange={e=>{const value=Math.max(0,Number(e.target.value)||0);setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,credits:isGuest?Math.min(value,Math.max(0,20-cur.filter(y=>y.id!==s.id).reduce((sum,y)=>sum+y.credits,0))):value}:x));setSgpa(null);}}/><select aria-label="Grade" value={s.grade} onChange={e=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,grade:e.target.value}:x));setSgpa(null);}}>{gradeNames.map(g=><option key={g} value={g}>{g} · {POINTS[g]}</option>)}</select><button className="sp-remove" disabled={subjects.length===1} onClick={()=>setSubjects(cur=>cur.filter(x=>x.id!==s.id))}>×</button></div>)}<button className="sp-add" onClick={addSubject} disabled={isGuest&&guestCreditTotal>=20}>＋ Add subject</button>{isGuest&&<div className="sp-muted">Credits allocated: {guestCreditTotal.toFixed(1)} / 20 maximum</div>}<div className="sp-actions"><button className="sp-primary" onClick={calculateSgpa}>Calculate SGPA →</button><button className="sp-secondary" onClick={saveSemester} disabled={sgpa===null}>Save to tracker</button></div></Card><Card className="sp-result"><span>YOUR SGPA</span><div className="sp-score">{sgpa===null?"—":sgpa.toFixed(2)}<small>/ 10</small></div><h3>{sgpa===null?"Your result appears here":"Calculation complete"}</h3><p>{sgpa===null?"Add subject names, credits and grades to calculate your semester result.":"Your weighted semester grade point average."}</p><div className="sp-result-line"><span>Counted credits</span><b>{countedCredits}</b></div><div className="sp-result-line"><span>Weighted points</span><b>{weighted.toFixed(2)}</b></div></Card></div><Card><div className="sp-card-head"><div><span>WHAT-IF ANALYSIS</span><h2>Explore a possible outcome</h2></div></div><p className="sp-muted">Try a hypothetical SGPA target and compare it with your current calculated result.</p><div className="sp-inline-form"><label>Target SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={e=>setWhatIf(e.target.value)}/></label><div className="sp-inline-result"><span>Target difference</span><strong>{sgpa===null?"Calculate first":(Number(whatIf)-sgpa).toFixed(2)}</strong></div></div></Card></>}
        {section==="cgpa"&&<><SectionTitle kicker="CUMULATIVE PERFORMANCE" title="CGPA analysis" copy={isGuest?"Use your manually saved semester SGPA and credits to calculate cumulative performance.":"Combine your saved semester results, model future outcomes and understand your cumulative progress."}/>{isGuest&&<Card><div className="sp-card-head"><div><span>MANUAL SEMESTER ENTRY</span><h2>Save a semester result</h2></div></div><div className="sp-inline-form"><label>Semester<select value={guestSemester} onChange={e=>setGuestSemester(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Semester {i+1}</option>)}</select></label><div className="sp-inline-result"><span>Current SGPA</span><strong>{sgpa===null?"Calculate in SGPA":sgpa.toFixed(2)}</strong></div><div className="sp-inline-result"><span>Credits</span><strong>{countedCredits} / 20</strong></div></div><p className="sp-muted">Calculate SGPA first, then save it from the SGPA analysis page. You can save one record per semester.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Go to SGPA calculator →</button></Card>}<div className="sp-metrics"><article><span>CURRENT CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>Credit-weighted from saved records</small></article><article><span>SEMESTERS SAVED</span><strong>{results.length}</strong><small>Academic history</small></article><article><span>TOTAL CREDITS</span><strong>{cgpaCredits}</strong><small>Across saved semesters</small></article><article><span>WEIGHTED POINTS</span><strong>{results.reduce((s,r)=>s+r.sgpa*r.credits,0).toFixed(1)}</strong><small>SGPA × semester credits</small></article></div><Card><div className="sp-card-head"><div><span>SEMESTER HISTORY</span><h2>Saved academic results</h2></div></div>{results.length?results.map(r=><div className="sp-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(2)} SGPA</strong><button onClick={()=>{const next=results.filter(x=>x.id!==r.id);setResults(next);localStorage.setItem(isGuest?"gradly_guest_semester_results":"gradly_semester_results",JSON.stringify(next));}}>Remove</button></div>):<div className="sp-empty"><span>◈</span><h3>Your academic history starts here</h3><p>Calculate and save a semester SGPA to build your CGPA profile.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Calculate SGPA →</button></div>}</Card><Card><div className="sp-card-head"><div><span>WHAT-IF CGPA</span><h2>Model your next semester</h2></div></div><div className="sp-inline-form"><label>Hypothetical next SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={e=>setWhatIf(e.target.value)}/></label><label>Next semester credits<input type="number" min="1" max={isGuest?20:undefined} value={totalCredits} onChange={e=>setTotalCredits(String(Math.min(Number(e.target.value)||1,isGuest?20:10000)))}/></label><div className="sp-inline-result"><span>Projected CGPA</span><strong>{cgpaCredits+Number(totalCredits)>0?((cgpaValue*cgpaCredits+Number(whatIf)*Number(totalCredits))/(cgpaCredits+Number(totalCredits))).toFixed(2):"—"}</strong></div></div></Card></>}
        {section==="planner"&&<><SectionTitle kicker="GOAL-BASED PLANNING" title="Academic planner" copy="Set a target and estimate the performance needed in your remaining semesters."/><Card><div className="sp-card-head"><div><span>CGPA GOAL PLANNER</span><h2>What do you want to achieve?</h2></div></div><div className="sp-inline-form"><label>Desired final CGPA<input type="number" min="0" max="10" step=".01" value={targetSgpa} onChange={e=>setTargetSgpa(e.target.value)}/></label><label>Expected total semesters<input type="number" min={Math.max(1,results.length+1)} max="12" value={remainingSemesters+results.length} readOnly/></label></div><div className="sp-plan-result"><span>ESTIMATED AVERAGE SGPA NEEDED IN REMAINING SEMESTERS</span><strong>{results.length?requiredAverage.toFixed(2):"Enter and save your semester results first"}</strong><p>{results.length?(requiredAverage>10?"This target is not mathematically reachable under a 10-point scale using the current assumptions.":requiredAverage<=0?"Your saved results already meet or exceed this target.":"This is an equal-semester estimate; actual credit weighting may change the required result."):"Your saved academic history is needed to calculate a meaningful target."}</p></div><button className="sp-primary" onClick={()=>navigate("sgpa")}>Plan a semester SGPA →</button></Card><Card><div className="sp-card-head"><div><span>PLANNING CHECKLIST</span><h2>Build a practical plan</h2></div></div><ul className="sp-checklist"><li>Review your current subject credits and grade points.</li><li>Identify subjects where focused study can improve your grade.</li><li>Use what-if analysis before finalising your semester target.</li><li>Save official results to keep your tracker accurate.</li></ul></Card></>}
        {section==="tracker"&&<><SectionTitle kicker="PERFORMANCE OVER TIME" title="SGPA progress tracker" copy="A visual record of your saved semester results. Add results to see your progress chart grow."/><Card><div className="sp-card-head"><div><span>SEMESTER PERFORMANCE</span><h2>Your SGPA trend</h2></div><b>{results.length} records</b></div>{results.length?<div className="sp-chart">{results.map(r=><div className="sp-bar-col" key={r.id}><strong>{r.sgpa.toFixed(2)}</strong><div className="sp-bar-track"><i style={{height:(r.sgpa*10)+"%"}}/></div><span>Sem {r.semester}</span></div>)}</div>:<div className="sp-empty"><span>▥</span><h3>No results to chart yet</h3><p>Your semester-wise graph will appear after you save an SGPA calculation.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Add first result →</button></div>}</Card><Card><div className="sp-card-head"><div><span>PERFORMANCE LOG</span><h2>Semester records</h2></div></div>{results.map(r=><div className="sp-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(2)} / 10</strong><small>{new Date(r.savedAt).toLocaleDateString()}</small></div>)}</Card></>}
        {section==="credits"&&<><SectionTitle kicker="ACADEMIC ELIGIBILITY" title="Credit analyser" copy="Understand how many credits you have completed and how many remain against your programme requirement."/><Card><div className="sp-card-head"><div><span>CREDIT COMPLETION</span><h2>Your academic credit progress</h2></div></div><div className="sp-inline-form"><label>Required credits<input type="number" min="1" value={totalCredits} onChange={e=>setTotalCredits(e.target.value)}/></label><label>Earned credits<input type="number" min="0" value={earnedCredits} onChange={e=>setEarnedCredits(e.target.value)}/></label></div><div className="sp-credit-visual"><div><strong>{remainingCredits}</strong><span>credits remaining</span></div><div className="sp-credit-track"><i style={{width:Math.min(100,Number(totalCredits)>0?Number(earnedCredits)/Number(totalCredits)*100:0)+"%"}}/></div><div className="sp-credit-labels"><span>{earnedCredits||0} earned</span><span>{totalCredits||0} required</span></div></div><p className="sp-muted">Enter the credit requirement published by your institution. Eligibility rules, compulsory courses and minimum grade conditions must also be checked before treating this as an official clearance.</p></Card></>}
        {section==="community"&&<><SectionTitle kicker="LEARN TOGETHER" title="Group chat & notes" copy="A shared study space for classmates to exchange questions and learning material."/><div className="sp-two-col"><Card><div className="sp-card-head"><div><span>STUDENT DISCUSSION</span><h2>Group conversation</h2></div><b>Preview</b></div><div className="sp-chat-list">{messages.map(m=><div className={"sp-chat-message "+(m.mine?"mine":"")} key={m.id}><div><b>{m.author}</b><small>{m.time}</small></div><p>{m.body}</p>{m.mine&&<div className="sp-message-actions"><button onClick={()=>{setEditingId(m.id);setMessage(m.body);}}>Edit</button><button onClick={()=>setMessages(cur=>cur.filter(x=>x.id!==m.id))}>Delete</button></div>}</div>)}</div><form className="sp-chat-compose" onSubmit={submitMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder={editingId?"Edit your message…":"Write a message…"}/><button className="sp-primary">{editingId?"Save":"Send"} →</button></form><small className="sp-muted">Frontend preview: messages are currently local to this browser, not shared with other students.</small></Card><Card><div className="sp-card-head"><div><span>STUDY MATERIAL</span><h2>Notes library</h2></div></div><button className="sp-upload" onClick={()=>fileRef.current?.click()}>＋ Upload notes or documents</button><input ref={fileRef} type="file" hidden multiple onChange={e=>setNotes(cur=>[...cur,...Array.from(e.target.files||[]).map(f=>({name:f.name,size:(f.size/1024).toFixed(0)+" KB",file:f}))])}/>{notes.length?notes.map((n,i)=><div className="sp-note-row" key={i}><span>▤</span><div><b>{n.name}</b><small>{n.size}</small></div><button onClick={()=>setNotes(cur=>cur.filter((_,j)=>i!==j))}>Remove</button></div>):<div className="sp-empty compact"><span>▤</span><p>Your uploaded files will appear here in this preview.</p></div>}<small className="sp-muted">Cloud sharing and downloads will activate with the notes-storage API.</small></Card></div></>}
        {section==="assistant"&&<><SectionTitle kicker="YOUR ACADEMIC COMPANION" title="Gradly AI assistant" copy="Ask questions about study planning, concepts and your academic journey."/><Card className="sp-ai-card"><div className="sp-ai-head"><span>✳</span><div><b>Gradly AI</b><small>Academic assistant · preview</small></div><i/></div><div className="sp-ai-thread">{aiMessages.map((m,i)=><div className={"sp-ai-bubble "+m.role} key={i}>{m.text}</div>)}</div><form className="sp-chat-compose" onSubmit={submitAi}><input value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Ask an academic question…"/><button className="sp-primary">Send →</button></form><p className="sp-muted">This interface is a frontend preview. Institution-specific answers require approved college documents, a retrieval system and a connected AI service. Do not rely on this preview for official rules.</p></Card></>}
        {section==="profile"&&<><SectionTitle kicker="YOUR DETAILS" title="Academic profile" copy="Review and update your institution and academic identity."/><Card><div className="sp-card-head"><div><span>STUDENT IDENTITY</span><h2>{user?.displayName||"Student"}</h2></div><span className="sp-status"><i/> Google verified</span></div><div className="sp-profile-grid"><div><span>Email</span><b>{user?.email||"—"}</b></div><div><span>Institution</span><b>{profile.institutionName||"Not selected"}</b></div><div><span>Programme</span><b>{profile.programName||"—"}</b></div><div><span>Branch</span><b>{profile.branchName||"—"}</b></div><div><span>Semester</span><b>{profile.semester||"—"}</b></div><div><span>Enrollment</span><b>{profile.enrollment||"—"}</b></div><div><span>Admission mode</span><b>{profile.admissionMode||"—"}</b></div><div><span>Scheme</span><b>{profile.scheme||"—"}</b></div></div><button className="sp-primary" onClick={()=>setOnboarding(true)}>Edit academic profile →</button></Card><Card><div className="sp-card-head"><div><span>SUPPORT</span><h2>Contact the developer</h2></div></div><p className="sp-muted">Report an issue, suggest a feature or share feedback about Gradly.</p><a className="sp-primary sp-link" href="https://github.com/jugal4096/gradly/issues" target="_blank" rel="noreferrer">Contact developer ↗</a></Card></>}
      </div>
      <footer className="sp-footer"><span>© {new Date().getFullYear()} Gradly</span><span>CALCULATE · UNDERSTAND · PLAN</span><span>Built for your next chapter ✦</span></footer>
    </main>

    {onboarding&&!isGuest&&<div className="sp-modal-backdrop"><section className="sp-modal"><div className="sp-modal-head"><div><span className="sp-kicker">WELCOME TO GRADLY</span><h2>Set up your academic profile</h2><p>Choose your institution and academic details to personalise your workspace.</p></div><button onClick={()=>{if(profile.institutionId)setOnboarding(false);}}>×</button></div>
      <form onSubmit={e=>{e.preventDefault();if(!profile.institutionId||!profile.programId||!profile.branchId){setNotice("Please select your institution, programme and branch.");return;}saveProfile(profile);}}>
        <div className="sp-field-full"><span className="sp-form-label">Find your institution</span><InstitutionDiscovery isGuest={false} user={user} selectedId={profile.institutionId} onSelect={(item:DiscoveryInstitution)=>{if(!item.isInGradly)return;setInstitutions(current=>current.some(x=>x.id===item.id)?current:[...current,{id:item.id,name:item.name,branches:item.branches||[]}]);updateProfile({...emptyProfile,institutionId:item.id,institutionName:item.name});}}/><input type="hidden" required value={profile.institutionId}/></div>
        {institutionLoading&&<p className="sp-muted">Loading institutions from Gradly database…</p>}
        {institutionError&&<p className="sp-error">{institutionError} Check that the Gradly API is available.</p>}
        <label>Programme<select required disabled={!profile.institutionId} value={profile.programId} onChange={e=>{const p=programs.find(x=>x.id===e.target.value);updateProfile({programId:e.target.value,programName:p?.name||"",branchId:"",branchName:""});}}><option value="">Select programme</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Branch<select required disabled={!profile.programId} value={profile.branchId} onChange={e=>{const b=branches.find(x=>x.id===e.target.value);updateProfile({branchId:e.target.value,branchName:b?.name||""});}}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>Current semester<select required value={profile.semester} onChange={e=>updateProfile({semester:e.target.value})}><option value="">Select semester</option>{Array.from({length:profile.programName.toLowerCase().includes("b.tech")||profile.programName.toLowerCase().includes("btech")?8:4},(_,i)=><option key={i+1} value={String(i+1)}>Semester {i+1}</option>)}</select></label>
        <label>Enrollment number<input required value={profile.enrollment} onChange={e=>updateProfile({enrollment:e.target.value})} placeholder="Your university enrollment"/></label>
        <label>Admission mode<select value={profile.admissionMode} onChange={e=>updateProfile({admissionMode:e.target.value})}><option>Regular</option><option>Direct Second Year</option><option>Transfer</option><option>Other</option></select></label>
        <label>Admission number<input value={profile.admissionNumber} onChange={e=>updateProfile({admissionNumber:e.target.value})} placeholder="Optional"/></label>
        <label>Scheme / pattern<input value={profile.scheme} onChange={e=>updateProfile({scheme:e.target.value})} placeholder="e.g. CBCS 2022"/></label>
        <div className="sp-modal-actions"><button className="sp-primary" disabled={institutionLoading}>Save profile →</button></div>
      </form>
    </section></div>}
    {loginGate&&<div className="sp-modal-backdrop top"><section className="sp-modal sp-request-modal"><div className="sp-modal-head"><div><span className="sp-kicker">GRADLY ACCOUNT</span><h2>Unlock your student workspace</h2><p>This feature is available to signed-in students. Your guest calculations remain on this device.</p></div><button onClick={()=>setLoginGate(false)}>×</button></div><div className="sp-actions"><button className="sp-primary" onClick={()=>void loginWithGoogle()}>Continue with Google →</button><button className="sp-secondary" onClick={()=>setLoginGate(false)}>Maybe later</button></div></section></div>}
  </div>;
}
