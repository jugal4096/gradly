import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronRight, CirclePlus, FlaskConical, GraduationCap, LogOut, Plus, RotateCcw, Trash2, Search, AlertTriangle, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./Tester.css";

type Branch={id:string;name:string;code?:string|null;program_id:string;program_name:string;program_level?:string|null};
type Institution={id:string;name:string;branches:Branch[]};
type Preview={
 recognized:boolean;requiresConfirmation:boolean;unknown?:string;message?:string;
 programme?:string;programId?:string;branch?:string;branchId?:string;specialization?:string|null;specializationId?:string|null;
 curriculumId?:string;curriculumName?:string;scheme?:string;admissionYear?:number;admissionMode?:string;admissionModeId?:string|null;entrySemester?:number;
 totalSemesters?:number;expected?:{expectedSemester:number|null;academicYear:string;semesterType:"ODD"|"EVEN";expectedDurationEnded:boolean;expectedGraduationSession:string;academicYearLabel:string|null};
 parsed?:{prefix:string;admissionYear:number;admissionModeCode:string;branchCode:string};
};
type TestCase={
 id:string;label:string;enrollment:string;programme:string;programId:string;branch:string;branchId:string;semester:number;
 institutionId:string;institutionName:string;curriculumId:string;scheme:string;admissionMode:string;admissionYear:number;
 entrySemester:number;totalSemesters:number;specialization?:string|null;createdAt:string
};
const STORE="gradly_tester_cases_v1";
const DEFAULT_INSTITUTION="Government College of Engineering, Chhatrapati Sambhajinagar";
function readCases(key:string):TestCase[]{try{return JSON.parse(localStorage.getItem(STORE+":"+key)||"[]");}catch{return[];}}
const API=API_BASE_URL.replace(/\/+$/,"");

export default function TesterWorkspace(){
 const navigate=useNavigate();
 const token=localStorage.getItem("gradly_tester_token")||"";
 const loginId=localStorage.getItem("gradly_tester_login_id")||"Tester";
 const [cases,setCases]=useState<TestCase[]>(()=>readCases(loginId));
 const [activeId,setActiveId]=useState("");
 const [label,setLabel]=useState("");
 const [enrollment,setEnrollment]=useState("");
 const [institutionQuery,setInstitutionQuery]=useState(DEFAULT_INSTITUTION);
 const [institutions,setInstitutions]=useState<Institution[]>([]);
 const [institution,setInstitution]=useState<Institution|null>(null);
 const [institutionBusy,setInstitutionBusy]=useState(false);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [semester,setSemester]=useState(1);
 const [error,setError]=useState("");
 const [verified,setVerified]=useState(false);
 const [resolving,setResolving]=useState(false);
 const [launching,setLaunching]=useState(false);
 const [studentFrameUrl,setStudentFrameUrl]=useState("");
 const [frameScenarioId,setFrameScenarioId]=useState("");

 useEffect(()=>{
  if(!token){navigate("/tester/login",{replace:true});return;}
  let live=true;
  fetch(API+"/api/tester/me",{headers:{Authorization:"Bearer "+token}})
   .then(async r=>{if(!r.ok)throw new Error("Tester account is no longer active. Please contact your Super Admin.");return r.json();})
   .then(()=>{if(live)setVerified(true);})
   .catch(e=>{if(live){setError(e instanceof Error?e.message:"Unable to verify tester access.");localStorage.removeItem("gradly_tester_token");}});
  return()=>{live=false;};
 },[token,navigate]);

 useEffect(()=>{localStorage.setItem(STORE+":"+loginId,JSON.stringify(cases));},[cases,loginId]);

 useEffect(()=>{
  const studentOrigin=new URL(import.meta.env.VITE_STUDENT_APP_URL||"https://gradly-peach.vercel.app").origin;
  const onStudentMessage=(event:MessageEvent)=>{
   if(event.origin!==studentOrigin||event.data?.type!=="GRADLY_TESTER_EXIT")return;
   setStudentFrameUrl("");setFrameScenarioId("");
  };
  window.addEventListener("message",onStudentMessage);
  return()=>window.removeEventListener("message",onStudentMessage);
 },[]);

 useEffect(()=>{
  if(institutionQuery.trim().length<2){setInstitutions([]);return;}
  let live=true;
  const timer=window.setTimeout(async()=>{
   setInstitutionBusy(true);
   try{
    const response=await fetch(API+"/api/academic/institutions/search?q="+encodeURIComponent(institutionQuery.trim()));
    const body=await response.json();
    if(!response.ok)throw new Error(body.message||"Institution search failed.");
    if(live){
     const rows=Array.isArray(body.data)?body.data as Institution[]:[];
     setInstitutions(rows);
     if(institutionQuery===DEFAULT_INSTITUTION){
      const preferred=rows.find(row=>row.name.toLowerCase().includes("government college of engineering"));
      if(preferred)setInstitution(current=>current||preferred);
     }
    }
   }catch(e){if(live)setError(e instanceof Error?e.message:"Unable to search institutions.");}
   finally{if(live)setInstitutionBusy(false);}
  },250);
  return()=>{live=false;window.clearTimeout(timer);};
 },[institutionQuery]);

 const active=useMemo(()=>cases.find(c=>c.id===activeId)||cases[0]||null,[cases,activeId]);
 const institutionBranches=useMemo(()=>institution?.branches||[],[institution]);
 const testedBranchKeys=useMemo(()=>new Set(cases.filter(c=>c.institutionId===institution?.id).map(c=>c.programId+":"+c.branchId)),[cases,institution]);
 const testedBranchCount=institutionBranches.filter(b=>testedBranchKeys.has(b.program_id+":"+b.id)).length;
 const canCreateScenario=Boolean(preview?.programId&&preview?.branchId);

 async function resolveEnrollment(e:FormEvent){
  e.preventDefault();setError("");setPreview(null);
  if(!institution){setError("Select an institution before resolving this enrollment.");return;}
  if(!enrollment.trim()){setError("Enter an enrollment number to resolve the student profile.");return;}
  setResolving(true);
  try{
   const response=await fetch(API+"/api/tester/enrollment/preview",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
    body:JSON.stringify({institutionId:institution.id,enrollmentNumber:enrollment.trim().toUpperCase()})
   });
   const body=await response.json();
   if(!response.ok)throw new Error(body.message||"Unable to resolve this enrollment.");
   const data=body.data as Preview;
   setPreview(data);
   if(data.programId&&data.branchId){
    const predicted=data.expected?.expectedSemester??data.entrySemester??1;
    setSemester(Math.max(data.entrySemester||1,Math.min(data.totalSemesters||12,predicted)));
   }else if(!data.recognized){
    setError(data.message||"This enrollment could not be resolved against the selected institution's academic configuration.");
   }
  }catch(e){setError(e instanceof Error?e.message:"Unable to resolve this enrollment.");}
  finally{setResolving(false);}
 }

 function addResolvedCase(){
  if(!preview?.programId||!preview.branchId||!institution)return;
  const item:TestCase={
   id:crypto.randomUUID(),label:label.trim()||institution.name+" · "+preview.branch+" · Sem "+semester,
   enrollment:enrollment.trim().toUpperCase(),programme:preview.programme||"Unknown programme",programId:preview.programId||"",
   branch:preview.branch||"Unknown branch",branchId:preview.branchId||"",semester,
   institutionId:institution.id,institutionName:institution.name,curriculumId:preview.curriculumId||"",
   scheme:preview.scheme||preview.curriculumName||"Unresolved scheme",admissionMode:preview.admissionMode||"Unknown",
   admissionYear:preview.admissionYear||new Date().getFullYear(),entrySemester:preview.entrySemester||1,
   totalSemesters:preview.totalSemesters||8,specialization:preview.specialization,createdAt:new Date().toISOString()
  };
  setCases(old=>[item,...old]);setActiveId(item.id);setLabel("");setEnrollment("");setPreview(null);
 }

 function remove(id:string){setCases(old=>old.filter(c=>c.id!==id));if(activeId===id)setActiveId("");}
 function fresh(){if(!window.confirm("Clear every local test case for this tester on this browser?"))return;setCases([]);setActiveId("");}
 function logout(){localStorage.removeItem("gradly_tester_token");localStorage.removeItem("gradly_tester_login_id");navigate("/tester/login",{replace:true});}

 function launchStudentWorkspace(){
  if(!active||!token)return;
  setLaunching(true);setError("");
  try{
   const base=(import.meta.env.VITE_STUDENT_APP_URL||"https://gradly-peach.vercel.app").replace(/\/+$/, "");
   const target=new URL(base+"/dashboard");
   const params=new URLSearchParams();
   params.set("testerToken",token);params.set("testerId",loginId);params.set("testerCaseId",active.id);
   params.set("testerProfile",JSON.stringify(active));params.set("testerReturnUrl",window.location.origin+"/tester/workspace");
   target.hash=params.toString();
   setStudentFrameUrl(target.toString());setFrameScenarioId(active.id);
  }catch(e){setError(e instanceof Error?e.message:"Could not load the virtual student workspace.");}
  finally{setLaunching(false);}
 }

 function closeStudentWorkspace(){setStudentFrameUrl("");setFrameScenarioId("");}

 if(!verified&&!error)return <main className="tester-loading">Verifying isolated tester access…</main>;
 return <main className="tester-workspace">
  <header className="tester-workspace-top"><a href="/"><span className="tester-brand-mark">G</span><span>GRADLY <small>TEST ENVIRONMENT</small></span></a><div className="tester-session"><span>SIGNED IN AS <strong>{loginId}</strong></span><button onClick={logout}><LogOut size={15}/> Sign out</button></div></header>
  <section className="tester-workspace-intro"><div><span className="tester-workspace-eyebrow"><FlaskConical size={15}/> STUDENT EXPERIENCE QA</span><h1>Test Gradly as any student.</h1><p>Enter an enrollment number and let Gradly's actual academic intelligence resolve the programme, discipline, scheme, admission mode, curriculum and predicted semester. Then inspect the real student experience inside this Tester page, without navigating away.</p></div><div className="tester-local-chip"><ShieldCheck size={15}/> ISOLATED TEST DATA</div></section>
  {error&&<div className="tester-login-error" role="alert">{error}</div>}
  <div className="tester-workspace-grid">
   <aside className="tester-scenarios">
    <div className="tester-section-heading"><div><h2>Build a student scenario</h2><span>Enrollment-driven profile resolution</span></div><button type="button" title="Clear local test cases" onClick={fresh}><RotateCcw size={15}/></button></div>
    <form className="tester-add-form tester-resolve-form" onSubmit={resolveEnrollment}>
     <label>INSTITUTION / UNIVERSITY</label>
     <div className="tester-institution-search"><Search size={15}/><input value={institutionQuery} onChange={e=>{setInstitutionQuery(e.target.value);setInstitution(null);setPreview(null);}} placeholder="Search institution name"/></div>
     {institutionBusy&&<small className="tester-help">Searching institution directory…</small>}
     {institutions.length>0&&institutionQuery!==institution?.name&&<div className="tester-institution-results">{institutions.slice(0,8).map(item=><button type="button" key={item.id} onClick={()=>{setInstitution(item);setInstitutionQuery(item.name);setPreview(null);}}><strong>{item.name}</strong><small>{item.branches.length} configured programme / discipline combinations</small></button>)}</div>}
     {institution&&<div className="tester-selected-institution"><Check size={14}/><span>{institution.name}</span><small>{institution.branches.length} academic mappings</small></div>}
     <label>STUDENT ENROLLMENT NUMBER</label>
     <input className="tester-enrollment-input" value={enrollment} onChange={e=>{setEnrollment(e.target.value.toUpperCase());setPreview(null);}} placeholder="e.g. BE23S06F007" autoComplete="off" spellCheck={false} required/>
     <small className="tester-help">Use a real-format or randomly generated enrollment number. No real student account is opened or modified.</small>
     <label>TEST CASE LABEL <small>(OPTIONAL)</small></label>
     <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. DSE IT · 5th semester"/>
     <button className="tester-add-button" type="submit" disabled={resolving||!institution}><Search size={16}/>{resolving?"Resolving academic profile…":"Resolve enrollment number"}</button>
    </form>
    {preview&&<section className={"tester-resolution-card "+(preview.recognized?"is-resolved":"is-unresolved")}>
     <div className="tester-resolution-head">{preview.recognized?<Check size={17}/>:<AlertTriangle size={17}/>}<strong>{preview.recognized?"Academic profile resolved":canCreateScenario?"Branch resolved · curriculum needs review":"Profile needs configuration"}</strong></div>
     {preview.recognized||canCreateScenario?<><dl>
      <div><dt>Programme</dt><dd>{preview.programme}</dd></div><div><dt>Discipline / branch</dt><dd>{preview.branch}{preview.specialization?" · "+preview.specialization:""}</dd></div>
      <div><dt>Scheme / curriculum</dt><dd>{preview.scheme||preview.curriculumName||"Not configured"}</dd></div><div><dt>Admission</dt><dd>{preview.admissionMode} · {preview.admissionYear}</dd></div>
      <div><dt>Predicted semester</dt><dd>{preview.expected?.expectedSemester??preview.entrySemester??"—"} / {preview.totalSemesters||"Not configured"}</dd></div>
      <div><dt>Academic session</dt><dd>{preview.expected?.academicYearLabel||preview.expected?.academicYear||"—"}</dd></div>
     </dl>
     {!preview.recognized&&<p>{preview.message||"The programme and discipline are resolved, but the curriculum needs configuration. You can still launch a generic UI smoke-test scenario; curriculum-specific subjects will not be available."}</p>}
     <label className="tester-semester-override">TEST AS SEMESTER
      <select value={semester} onChange={e=>setSemester(Number(e.target.value))}>{Array.from({length:Math.max(1,preview.totalSemesters||8)},(_,i)=>i+1).filter(n=>n>=(preview.entrySemester||1)).map(n=><option key={n} value={n}>Semester {n}{n===(preview.expected?.expectedSemester??preview.entrySemester)?" · predicted":""}</option>)}</select>
     </label>
     <button type="button" className="tester-add-button" onClick={addResolvedCase}><CirclePlus size={16}/>{preview.recognized?"Save student scenario":"Save fallback UI test scenario"}</button>
     </>:<p>{preview.message||"The enrollment could not be resolved. Check the selected institution's programme, discipline and enrollment mappings."}</p>}
    </section>}
    <div className="tester-case-list-heading"><strong>Saved scenarios</strong><span>{cases.length}</span></div>
    <div className="tester-case-list">{cases.map(c=><button key={c.id} className={"tester-case-item "+((active?.id===c.id)?"selected":"")} onClick={()=>setActiveId(c.id)}><span className="tester-case-icon"><GraduationCap size={17}/></span><span className="tester-case-copy"><strong>{c.label}</strong><small>{c.enrollment}</small><small>{c.programme} · {c.branch} · Sem {c.semester}</small></span><ChevronRight size={16}/><span className="tester-case-remove" role="button" aria-label="Delete test case" onClick={e=>{e.stopPropagation();remove(c.id);}}><Trash2 size={14}/></span></button>)}</div>
    {institution&&<section className="tester-coverage-card"><div className="tester-coverage-head"><strong>Discipline coverage</strong><span>{testedBranchCount}/{institutionBranches.length} tested</span></div><div className="tester-coverage-track"><i style={{width:(institutionBranches.length?testedBranchCount/institutionBranches.length*100:0)+"%"}}/></div><div className="tester-coverage-list">{institutionBranches.map(branch=><span key={branch.program_id+":"+branch.id} className={testedBranchKeys.has(branch.program_id+":"+branch.id)?"covered":""}>{testedBranchKeys.has(branch.program_id+":"+branch.id)?"✓":"○"} {branch.program_name} · {branch.name}</span>)}</div><small>Coverage is tracked locally for this tester. Add a resolved scenario for each programme and branch to complete the institution sweep.</small></section>}
   </aside>
   <section className="tester-preview">{active?<><div className="tester-preview-top"><div><span>STUDENT WORKSPACE / SELECTED SCENARIO</span><h2>{active.label}</h2></div><span className="tester-preview-badge">SIMULATED PROFILE</span></div>
    <div className="tester-student-hero"><div className="tester-student-avatar"><GraduationCap size={28}/></div><div><span>STUDENT PROFILE</span><h3>{active.enrollment}</h3><p>{active.programme} · {active.branch}</p></div><div className="tester-semester-pill">SEMESTER {active.semester}</div></div>
    <div className="tester-preview-stats"><article><span>INSTITUTION</span><strong>{active.institutionName}</strong><small>{active.admissionMode} · {active.admissionYear}</small></article><article><span>SCHEME / CURRICULUM</span><strong>{active.scheme}</strong><small>{active.curriculumId?"Matched to configured curriculum":"Curriculum mapping unavailable"}</small></article><article><span>PROGRAMME DURATION</span><strong>{active.totalSemesters} semesters</strong><small>Entry from semester {active.entrySemester}</small></article></div>
    <div className="tester-preview-panel tester-virtual-launch"><div><GraduationCap size={19}/><h3>Virtual student dashboard</h3></div><p>This student experience stays embedded inside Tester Mode. Navigate the real student interface without leaving this test page. All edits remain isolated to this tester scenario.</p>
     <div className="tester-preview-modules"><span>SGPA Analysis</span><span>CGPA Analysis</span><span>What-if & planners</span><span>Progress trackers</span><span>Academics</span><span>Settings</span></div>
     {!studentFrameUrl||frameScenarioId!==active.id?<button type="button" className="tester-add-button tester-launch-button" onClick={launchStudentWorkspace} disabled={launching}><GraduationCap size={16}/>{launching?"Preparing virtual dashboard…":"Open virtual student dashboard here"}</button>:<div className="tester-virtual-actions"><span><ShieldCheck size={14}/> Running as {active.enrollment}</span><button type="button" onClick={closeStudentWorkspace}>Close dashboard</button></div>}
    </div>
    {studentFrameUrl&&frameScenarioId===active.id&&<section className="tester-virtual-frame-wrap"><div className="tester-virtual-frame-bar"><span><span className="tester-live-dot"/> STUDENT APP · {active.enrollment} · SEM {active.semester}</span><button type="button" onClick={closeStudentWorkspace}>Exit virtual dashboard</button></div><iframe key={frameScenarioId} className="tester-virtual-frame" src={studentFrameUrl} title={"Gradly virtual student dashboard for "+active.enrollment} allow="clipboard-read; clipboard-write" referrerPolicy="strict-origin-when-cross-origin"/></section>}
    <div className="tester-preview-footer">Tester mode never claims a real student's account, writes student records, submits grievances or deletes accounts. Each scenario is isolated by tester and scenario ID.</div>
   </>:<div className="tester-empty-preview"><div><Plus size={25}/></div><h2>Your student QA lab is ready</h2><p>Search for an institution, enter any enrollment number and resolve its academic identity. Save multiple scenarios to test every configured programme, discipline and semester.</p></div>}</section>
  </div>
 </main>;
}
