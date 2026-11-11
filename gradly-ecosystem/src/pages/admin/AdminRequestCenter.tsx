import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AdminWorkspaceMenu from "./AdminWorkspaceMenu";
import { Activity, Bell, ClipboardList, RefreshCw, Send } from "lucide-react";
import "./AdminDashboard.css";
import "./AdminRequestCenter.css";

const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"").replace(/\/api$/i,""))+"/api";
type RequestRow={id:string;requestType:string;title:string;description:string;targetUserId?:string|null;priority:string;status:string;reviewNote?:string|null;createdAt:string};
type EnrollmentGrievanceRow={id:string;studentUserId:string;enrollmentNumber?:string|null;category:string;description:string;status:string;adminNote?:string|null;createdAt:string;attachmentName?:string|null;studentName?:string|null;studentEmail?:string|null};
const label=(s:string)=>s.replace(/_/g," ").toLowerCase().replace(/\\b\\w/g,c=>c.toUpperCase());

async function openEvidence(url:string,authToken:string){
 const viewer=window.open("about:blank","_blank");
 try{
  const response=await fetch(url,{headers:{Authorization:"Bearer "+authToken}});
  if(!response.ok)throw new Error("Unable to open the student's supporting document. Check your Admin session and try again.");
  const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);
  if(viewer){viewer.location.href=objectUrl;}else{const link=document.createElement("a");link.href=objectUrl;link.target="_blank";link.rel="noopener";link.click();}
  window.setTimeout(()=>URL.revokeObjectURL(objectUrl),120000);
 }catch(error){viewer?.close();throw error;}
}
export default function AdminRequestCenter(){
 const [rows,setRows]=useState<RequestRow[]>([]),[grievances,setGrievances]=useState<EnrollmentGrievanceRow[]>([]),[unread,setUnread]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [grievanceBusy,setGrievanceBusy]=useState("");const [grievanceNote,setGrievanceNote]=useState<Record<string,string>>({});const [grievanceFeedback,setGrievanceFeedback]=useState<Record<string,{kind:"error"|"success";message:string}>>({});
 const [requestType,setType]=useState("SYSTEM_CHANGE"),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[targetUserId,setTarget]=useState(""),[priority,setPriority]=useState("NORMAL"),[busy,setBusy]=useState(false);
 const token=()=>localStorage.getItem("gradly_admin_token")||localStorage.getItem("admin_token")||"";
 async function load(){setLoading(true);try{const t=token();if(!t)throw new Error("Admin session missing. Sign in again.");const headers={Authorization:"Bearer "+t,Accept:"application/json"};const [r,g]=await Promise.all([fetch(API_ROOT+"/admin/platform-requests",{headers}),fetch(API_ROOT+"/admin/enrollment-grievances",{headers})]);const [d,gd]=await Promise.all([r.json().catch(()=>({})),g.json().catch(()=>({}))]);if(!r.ok||d.success===false)throw new Error(d.message||"Could not load requests.");setRows(Array.isArray(d.requests)?d.requests:[]);setUnread(Number(d.unreadCount)||0);setGrievances(g.ok&&gd.success!==false&&Array.isArray(gd.grievances)?gd.grievances:[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load requests.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function grievanceAction(g:EnrollmentGrievanceRow,action:"IN_REVIEW"|"NEEDS_INFO"|"REJECTED"|"DISABLE"|"ENABLE"){
  const note=(grievanceNote[g.id]||"").trim();if(note.length<3){setGrievanceFeedback(v=>({...v,[g.id]:{kind:"error",message:"Enter a reason of at least 3 characters before taking action."}}));return;}
  const actionLabel=action==="IN_REVIEW"?"Mark this request as in review":action==="NEEDS_INFO"?"Request more information":action==="REJECTED"?"Reject this student data mismatch request":action==="DISABLE"?"Disable this student's Gradly login":"Reactivate this student's Gradly login";if(!window.confirm(actionLabel+"?"))return;
  setGrievanceBusy(g.id);setGrievanceFeedback(v=>({...v,[g.id]:{kind:"success",message:"Saving your action…"}}));setError("");setNotice("");
  try{
   const endpoint=action==="DISABLE"||action==="ENABLE"?"/admin/enrollment-grievances/"+encodeURIComponent(g.id)+"/student-access":"/admin/enrollment-grievances/"+encodeURIComponent(g.id)+"/review";
   const body=action==="DISABLE"||action==="ENABLE"?{active:action==="ENABLE",note}:{status:action,adminNote:note};
   const r=await fetch(API_ROOT+endpoint,{method:"PATCH",headers:{Authorization:"Bearer "+token(),"Content-Type":"application/json"},body:JSON.stringify(body)});
   const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||"Unable to apply this action.");
   setGrievanceFeedback(v=>({...v,[g.id]:{kind:"success",message:d.message||"Action completed successfully."}}));await load();
  }catch(e){setGrievanceFeedback(v=>({...v,[g.id]:{kind:"error",message:e instanceof Error?e.message:"Unable to apply this action."}}));}finally{setGrievanceBusy("");}
 }
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try{const r=await fetch(API_ROOT+"/admin/platform-requests",{method:"POST",headers:{Authorization:"Bearer "+token(),"Content-Type":"application/json"},body:JSON.stringify({requestType,title,description,targetUserId:targetUserId.trim()||null,priority})});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||"Could not submit request.");setNotice("Request submitted to Super Admin.");setTitle("");setDescription("");setTarget("");await load();}catch(e){setError(e instanceof Error?e.message:"Could not submit request.");}finally{setBusy(false);}}
 return <><AdminWorkspaceMenu/><div className="admin-request-shell" data-theme={document.documentElement.dataset.adminTheme||"light"} data-palette={document.documentElement.dataset.adminPalette||"green"} data-font={document.documentElement.dataset.adminFont||"system"} data-font-size={document.documentElement.dataset.adminFontSize||"normal"} data-compact={document.documentElement.dataset.adminCompact||"false"} data-reduced-motion={document.documentElement.dataset.adminReducedMotion||"false"}>
  <aside className="ad-sidebar admin-request-rail"><Link to="/admin/dashboard" className="ad-brand"><span className="ad-brand-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></Link></aside>
  <main className="admin-request-main">
   <div className="admin-request-system-strip"><span><Activity size={14}/> SYSTEM STATUS <b>NORMAL</b></span><span>ADMIN WORKSPACE</span></div>
   <div className="ad-workspace">
    <header className="ad-page-head"><div><span className="ad-section-kicker">ADMIN WORKSPACE / SUPPORT</span><h1>Request Center</h1><p>Submit account, student, curriculum or system requests and follow every decision.</p></div><button className="ad-secondary-btn" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></header>
    {error&&<p role="alert" className="ad-error">{error}</p>}{notice&&<p className="ad-success">{notice}</p>}
    <section className="ad-panel"><div className="ad-panel-heading"><div><span className="ad-section-kicker">NEW REQUEST</span><h2><Send size={18}/> Send to Super Admin</h2></div><span className="ad-scope-pill">Private to your Admin account</span></div>
     <form onSubmit={submit} className="ad-request-form"><label>Request category<select value={requestType} onChange={e=>setType(e.target.value)}><option value="USER_DISABLE">Disable a student account</option><option value="USER_REACTIVATE">Reactivate a student account</option><option value="USER_DELETE">Request student account deletion</option><option value="USER_REVIEW">Report a user for review</option><option value="SYSTEM_CHANGE">System change</option><option value="BUG_REPORT">Report a system bug</option><option value="FEATURE_REQUEST">Request a new feature</option><option value="CURRICULUM_CHANGE">Curriculum change</option><option value="ACCOUNT_ACCESS">Account / permission access</option><option value="OTHER">Other</option></select></label>
      <label>Request title<input required minLength={4} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Short, clear summary"/></label>
      <label>Target student/user ID <span>(only for user-related requests)</span><input value={targetUserId} onChange={e=>setTarget(e.target.value)} placeholder="Paste the exact user ID"/></label>
      <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
      <label className="ad-request-wide">Details and reason<textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explain what should happen, why it is needed, and any supporting context."/></label>
      <div className="ad-request-wide"><button className="ad-primary-btn" disabled={busy}><Send size={15}/>{busy?"Submitting…":"Submit request"}</button></div>
     </form>
    </section>
    <section className="ad-panel"><div className="ad-panel-heading"><div><span className="ad-section-kicker">TRACKING</span><h2><ClipboardList size={18}/> My requests</h2></div><span className="ad-scope-pill"><Bell size={13}/> {unread} unread updates</span></div>
     {loading?<p>Loading requests…</p>:rows.length===0?<p>No requests submitted yet.</p>:<div className="ad-request-list">{rows.map(r=><article key={r.id}><div><strong>{r.title}</strong><small>{label(r.requestType)} · {new Date(r.createdAt).toLocaleString("en-IN")}</small><p>{r.description}</p>{r.reviewNote&&<blockquote>{r.reviewNote}</blockquote>}</div><span className={"ad-request-status status-"+r.status.toLowerCase()}>{label(r.status)}</span></article>)}</div>}
    </section>
    <section className="ad-panel" id="student-grievances"><div className="ad-panel-heading"><div><span className="ad-section-kicker">STUDENT SUPPORT INBOX</span><h2><ClipboardList size={18}/> Student Data Mismatch Grievances</h2></div><span className="ad-scope-pill">Your institution only</span></div>
     {loading?<p>Loading enrollment grievances…</p>:grievances.length===0?<p>No student enrollment grievances have been submitted for your institution.</p>:<div className="ad-request-list">{grievances.map(g=><article key={g.id}><div><strong>{label(g.category)} · {g.enrollmentNumber||"Enrollment not provided"}</strong><small>{g.studentName||"Student"}{g.studentEmail?" · "+g.studentEmail:""} · {new Date(g.createdAt).toLocaleString("en-IN")}</small><p>{g.description}</p>{g.adminNote&&<blockquote>{g.adminNote}</blockquote>}{g.attachmentName&&<button type="button" className="ad-evidence-download" onClick={()=>void openEvidence(API_ROOT+"/admin/enrollment-grievances/"+encodeURIComponent(g.id)+"/attachment",token()).catch(e=>setError(e instanceof Error?e.message:"Unable to download evidence."))}>View supporting document · {g.attachmentName}</button>}{["PENDING","IN_REVIEW","NEEDS_INFO"].includes(g.status.toUpperCase())&&<div className="ad-grievance-actions"><label className="ad-grievance-note-label">Decision note <span>Required · 3–2,000 characters</span><textarea rows={3} value={grievanceNote[g.id]||""} onChange={e=>{setGrievanceNote(v=>({...v,[g.id]:e.target.value}));setGrievanceFeedback(v=>({...v,[g.id]:undefined}));}} placeholder="Explain why this action is being taken. The student will be notified."/></label><div className="ad-grievance-action-buttons"><button className="is-review" type="button" disabled={grievanceBusy===g.id} onClick={()=>void grievanceAction(g,"IN_REVIEW")}>Mark in review</button><button className="is-info" type="button" disabled={grievanceBusy===g.id} onClick={()=>void grievanceAction(g,"NEEDS_INFO")}>Request information</button><button className="is-reject" type="button" disabled={grievanceBusy===g.id} onClick={()=>void grievanceAction(g,"REJECTED")}>Reject request</button><button className="is-disable" type="button" disabled={grievanceBusy===g.id} onClick={()=>void grievanceAction(g,"DISABLE")}>Disable login</button><button className="is-enable" type="button" disabled={grievanceBusy===g.id} onClick={()=>void grievanceAction(g,"ENABLE")}>Allow login</button></div>{grievanceFeedback[g.id]&&<p className={"ad-grievance-feedback is-"+grievanceFeedback[g.id].kind} role={grievanceFeedback[g.id].kind==="error"?"alert":"status"}>{grievanceFeedback[g.id].message}</p>}{grievanceBusy===g.id&&<small className="ad-grievance-saving">Saving action…</small>}</div>}</div><span className={"ad-request-status status-"+g.status.toLowerCase()}>{label(g.status)}</span></article>)}</div>}
     <p className="ad-request-scope-note">Actions are institution-scoped and recorded in the grievance history. Super Admin handles verified enrollment-mapping corrections.</p>
    </section>
    <footer className="ad-footer"><span>Gradly · Request tracking</span><Link to="/admin/dashboard">Back to overview</Link></footer>
   </div>
  </main>
 </div></>;
}
