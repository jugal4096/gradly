import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AdminWorkspaceMenu from "./AdminWorkspaceMenu";
import { Activity, Bell, ClipboardList, RefreshCw, Send } from "lucide-react";
import "./AdminDashboard.css";
import "./AdminRequestCenter.css";

const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"").replace(/\/api$/i,""))+"/api";
type RequestRow={id:string;requestType:string;title:string;description:string;targetUserId?:string|null;priority:string;status:string;reviewNote?:string|null;createdAt:string};
type EnrollmentGrievanceRow={id:string;enrollmentNumber?:string|null;category:string;description:string;status:string;adminNote?:string|null;createdAt:string;attachmentName?:string|null;studentName?:string|null;studentEmail?:string|null};
const label=(s:string)=>s.replace(/_/g," ").toLowerCase().replace(/\\b\\w/g,c=>c.toUpperCase());

async function openEvidence(url:string,authToken:string){
 const response=await fetch(url,{headers:{Authorization:"Bearer "+authToken}});
 if(!response.ok)throw new Error("Unable to download the student's supporting document.");
 const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);const opened=window.open(objectUrl,"_blank","noopener");
 if(!opened){const link=document.createElement("a");link.href=objectUrl;link.download="student-support-evidence";link.click();}
 window.setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
\nexport default function AdminRequestCenter(){
 const [rows,setRows]=useState<RequestRow[]>([]),[grievances,setGrievances]=useState<EnrollmentGrievanceRow[]>([]),[unread,setUnread]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [requestType,setType]=useState("SYSTEM_CHANGE"),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[targetUserId,setTarget]=useState(""),[priority,setPriority]=useState("NORMAL"),[busy,setBusy]=useState(false);
 const token=()=>localStorage.getItem("gradly_admin_token")||localStorage.getItem("admin_token")||"";
 async function load(){setLoading(true);try{const t=token();if(!t)throw new Error("Admin session missing. Sign in again.");const headers={Authorization:"Bearer "+t,Accept:"application/json"};const [r,g]=await Promise.all([fetch(API_ROOT+"/admin/platform-requests",{headers}),fetch(API_ROOT+"/admin/enrollment-grievances",{headers})]);const [d,gd]=await Promise.all([r.json().catch(()=>({})),g.json().catch(()=>({}))]);if(!r.ok||d.success===false)throw new Error(d.message||"Could not load requests.");setRows(Array.isArray(d.requests)?d.requests:[]);setUnread(Number(d.unreadCount)||0);setGrievances(g.ok&&gd.success!==false&&Array.isArray(gd.grievances)?gd.grievances:[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load requests.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
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
     {loading?<p>Loading enrollment grievances…</p>:grievances.length===0?<p>No student enrollment grievances have been submitted for your institution.</p>:<div className="ad-request-list">{grievances.map(g=><article key={g.id}><div><strong>{label(g.category)} · {g.enrollmentNumber||"Enrollment not provided"}</strong><small>{g.studentName||"Student"}{g.studentEmail?" · "+g.studentEmail:""} · {new Date(g.createdAt).toLocaleString("en-IN")}</small><p>{g.description}</p>{g.adminNote&&<blockquote>{g.adminNote}</blockquote>}{g.attachmentName&&<button type="button" className="ad-evidence-download" onClick={()=>void openEvidence(API_ROOT+"/admin/enrollment-grievances/"+encodeURIComponent(g.id)+"/attachment",token()).catch(e=>setError(e instanceof Error?e.message:"Unable to download evidence."))}>Download supporting document · {g.attachmentName}</button>}</div><span className={"ad-request-status status-"+g.status.toLowerCase()}>{label(g.status)}</span></article>)}</div>}
     <p className="ad-request-scope-note">This is a read-only institution-scoped view. Super Admin handles formal review and verified enrollment-mapping corrections.</p>
    </section>
    <footer className="ad-footer"><span>Gradly · Request tracking</span><Link to="/admin/dashboard">Back to overview</Link></footer>
   </div>
  </main>
 </div></>;
}
