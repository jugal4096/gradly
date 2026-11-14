import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronRight, CirclePlus, FlaskConical, GraduationCap, LogOut, Plus, RotateCcw, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";

type TestCase={
 id:string;label:string;enrollment:string;programme:string;branch:string;semester:number;
 institutionName:string;curriculumId:string;scheme:string;admissionMode:string;admissionYear:number;createdAt:string
};
const STORE="gradly_tester_cases_v1";
const DEFAULT_INSTITUTION="Government College of Engineering, Chhatrapati Sambhajinagar";
function readCases(key:string):TestCase[]{try{return JSON.parse(localStorage.getItem(STORE+":"+key)||"[]");}catch{return[];}}
export default function TesterWorkspace(){
 const navigate=useNavigate();const token=localStorage.getItem("gradly_tester_token")||"";const loginId=localStorage.getItem("gradly_tester_login_id")||"Tester";
 const [cases,setCases]=useState<TestCase[]>(()=>readCases(loginId));const [activeId,setActiveId]=useState("");const [label,setLabel]=useState("");
 const [enrollment,setEnrollment]=useState("");const [programme,setProgramme]=useState("B.Tech");const [branch,setBranch]=useState("Information Technology");
 const [semester,setSemester]=useState(1);const [institutionName,setInstitutionName]=useState(DEFAULT_INSTITUTION);const [curriculumId,setCurriculumId]=useState("");
 const [scheme,setScheme]=useState("New CBCS");const [admissionMode,setAdmissionMode]=useState("Regular");const [admissionYear,setAdmissionYear]=useState(new Date().getFullYear());
 const [error,setError]=useState("");const [verified,setVerified]=useState(false);const [launching,setLaunching]=useState(false);
 useEffect(()=>{if(!token){navigate("/tester/login",{replace:true});return;}let live=true;fetch(API_BASE_URL+"/api/tester/me",{headers:{Authorization:"Bearer "+token}}).then(async r=>{if(!r.ok)throw new Error("Tester account is no longer active. Please contact your Super Admin.");return r.json();}).then(()=>{if(live)setVerified(true);}).catch(e=>{if(live){setError(e instanceof Error?e.message:"Unable to verify tester access.");localStorage.removeItem("gradly_tester_token");}});return()=>{live=false;};},[token,navigate]);
 useEffect(()=>{localStorage.setItem(STORE+":"+loginId,JSON.stringify(cases));},[cases,loginId]);
 const active=useMemo(()=>cases.find(c=>c.id===activeId)||cases[0]||null,[cases,activeId]);
 function add(e:FormEvent){e.preventDefault();if(!enrollment.trim())return;const item:TestCase={id:crypto.randomUUID(),label:label.trim()||"Test case "+(cases.length+1),enrollment:enrollment.trim().toUpperCase(),programme,branch,semester,institutionName,curriculumId:curriculumId.trim(),scheme,admissionMode,admissionYear,createdAt:new Date().toISOString()};setCases(old=>[item,...old]);setActiveId(item.id);setLabel("");setEnrollment("");}
 function remove(id:string){setCases(old=>old.filter(c=>c.id!==id));if(activeId===id)setActiveId("");}
 function fresh(){if(!window.confirm("Clear every local test case for this tester on this browser?"))return;setCases([]);setActiveId("");}
 function logout(){localStorage.removeItem("gradly_tester_token");localStorage.removeItem("gradly_tester_login_id");navigate("/tester/login",{replace:true});}
 function launchStudentWorkspace(){
  if(!active||!token)return;
  setLaunching(true);setError("");
  try{
   const base=(import.meta.env.VITE_STUDENT_APP_URL||"https://gradly-peach.vercel.app").replace(/\/+$/,"");
   const target=new URL(base+"/dashboard");
   const params=new URLSearchParams();
   params.set("testerToken",token);params.set("testerId",loginId);params.set("testerCaseId",active.id);
   params.set("testerProfile",JSON.stringify(active));params.set("testerReturnUrl",window.location.origin+"/tester/workspace");
   target.hash=params.toString();
   const opened=window.open(target.toString(),"_blank","noopener,noreferrer");
   if(!opened)throw new Error("Your browser blocked the new tab. Allow pop-ups for Gradly and try again.");
  }catch(e){setError(e instanceof Error?e.message:"Could not launch the student workspace.");}
  finally{setLaunching(false);}
 }
 if(!verified&&!error)return <main className="tester-loading">Verifying isolated tester access…</main>;
 return <main className="tester-workspace">
  <header className="tester-workspace-top"><a href="/"><span className="tester-brand-mark">G</span><span>GRADLY <small>TEST ENVIRONMENT</small></span></a><div className="tester-session"><span>SIGNED IN AS <strong>{loginId}</strong></span><button onClick={logout}><LogOut size={15}/> Sign out</button></div></header>
  <section className="tester-workspace-intro"><div><span className="tester-workspace-eyebrow"><FlaskConical size={15}/> ISOLATED STUDENT PREVIEW</span><h1>Test the real student experience.</h1><p>Create independent student scenarios, then launch the actual Gradly student application with the selected simulated profile. Academic changes remain in a separate local workspace for each test case.</p></div><div className="tester-local-chip"><Check size={15}/> LOCAL-ONLY TEST DATA</div></section>
  {error&&<div className="tester-login-error" role="alert">{error}</div>}
  <div className="tester-workspace-grid">
   <aside className="tester-scenarios"><div className="tester-section-heading"><div><h2>Test cases</h2><span>{cases.length} saved locally</span></div><button type="button" title="Clear local test cases" onClick={fresh}><RotateCcw size={15}/></button></div>
    <form className="tester-add-form" onSubmit={add}>
     <label>TEST CASE NAME</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. DSE student — 5th sem"/>
     <label>ENROLLMENT NUMBER</label><input value={enrollment} onChange={e=>setEnrollment(e.target.value)} placeholder="Enter any test enrollment" required/>
     <label>INSTITUTION</label><input value={institutionName} onChange={e=>setInstitutionName(e.target.value)} required/>
     <label>PROGRAMME</label><select value={programme} onChange={e=>setProgramme(e.target.value)}><option>B.Tech</option><option>B.E.</option><option>MCA</option><option>M.Tech</option><option>Other</option></select>
     <label>BRANCH / DEPARTMENT</label><input value={branch} onChange={e=>setBranch(e.target.value)}/>
     <label>SCHEME</label><select value={scheme} onChange={e=>setScheme(e.target.value)}><option>New CBCS</option><option>Old CBCS</option><option>NEP</option><option>Other</option></select>
     <label>ADMISSION MODE</label><select value={admissionMode} onChange={e=>setAdmissionMode(e.target.value)}><option>Regular</option><option>Direct Second Year</option></select>
     <label>ADMISSION YEAR</label><input type="number" min="2000" max="2100" value={admissionYear} onChange={e=>setAdmissionYear(Number(e.target.value))}/>
     <label>SEMESTER</label><select value={semester} onChange={e=>setSemester(Number(e.target.value))}>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}{["st","nd","rd"][i]||"th"} Semester</option>)}</select>
     <label>CURRICULUM ID <small>(OPTIONAL)</small></label><input value={curriculumId} onChange={e=>setCurriculumId(e.target.value)} placeholder="Paste curriculum ID to load subjects"/>
     <button className="tester-add-button"><CirclePlus size={16}/> Add test case</button>
    </form>
    <div className="tester-case-list">{cases.map(c=><button key={c.id} className={"tester-case-item "+((active?.id===c.id)?"selected":"")} onClick={()=>setActiveId(c.id)}><span className="tester-case-icon"><GraduationCap size={17}/></span><span className="tester-case-copy"><strong>{c.label}</strong><small>{c.enrollment}</small><small>{c.programme} · Sem {c.semester}</small></span><ChevronRight size={16}/><span className="tester-case-remove" role="button" aria-label="Delete test case" onClick={e=>{e.stopPropagation();remove(c.id);}}><Trash2 size={14}/></span></button>)}</div>
   </aside>
   <section className="tester-preview">{active?<><div className="tester-preview-top"><div><span>STUDENT WORKSPACE / SELECTED SCENARIO</span><h2>{active.label}</h2></div><span className="tester-preview-badge">SIMULATED PROFILE</span></div><div className="tester-student-hero"><div className="tester-student-avatar"><GraduationCap size={28}/></div><div><span>STUDENT PROFILE</span><h3>{active.enrollment}</h3><p>{active.programme} · {active.branch}</p></div><div className="tester-semester-pill">SEMESTER {active.semester}</div></div><div className="tester-preview-stats"><article><span>INSTITUTION</span><strong>{active.institutionName}</strong><small>Simulated academic home</small></article><article><span>SCHEME / MODE</span><strong>{active.scheme}</strong><small>{active.admissionMode}</small></article><article><span>CURRICULUM</span><strong>{active.curriculumId||"Custom subjects"}</strong><small>{active.curriculumId?"Read-only curriculum lookup":"Add test subjects inside Gradly"}</small></article></div><div className="tester-preview-panel"><div><GraduationCap size={19}/><h3>Launch the complete Gradly student application</h3></div><p>Open the actual student dashboard with this scenario loaded. SGPA and CGPA tools, what-if analysis, planners, progress trackers, academic profile, settings and student-facing navigation use the real Gradly interface. Results and preferences are saved only in this scenario’s browser namespace.</p><div className="tester-preview-modules"><span>SGPA Analysis</span><span>CGPA Analysis</span><span>Academics</span><span>Community</span><span>AI Assistant</span><span>Settings</span></div><button type="button" className="tester-add-button tester-launch-button" onClick={launchStudentWorkspace} disabled={launching}><ExternalLink size={16}/>{launching?"Opening student workspace…":"Launch student workspace"}</button></div><div className="tester-preview-footer">Student database writes and account deletion are disabled in tester mode. Each test case has its own local academic records.</div></>:<div className="tester-empty-preview"><div><Plus size={25}/></div><h2>Your test workspace is ready</h2><p>Add your first enrollment on the left. Create as many test cases as needed, each with its own programme, branch and semester.</p></div>}</section>
  </div>
 </main>;
}
