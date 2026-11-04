import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Activity, Bell, BookOpen, Building2, ChevronRight, ClipboardList,
  LayoutDashboard, LogOut, Menu, MessageSquareText, RefreshCw, Send,
  Settings, ShieldCheck, UserRound, Users, X
} from "lucide-react";
import "./AdminDashboard.css";
import "./AdminRequestCenter.css";

const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\\/+$/,"").replace(/\\/api$/i,""))+"/api";
type RequestRow={id:string;requestType:string;title:string;description:string;targetUserId?:string|null;priority:string;status:string;reviewNote?:string|null;createdAt:string};
const label=(s:string)=>s.replace(/_/g," ").toLowerCase().replace(/\\b\\w/g,c=>c.toUpperCase());
const adminNavigation=[
 {to:"/admin/dashboard",label:"Overview",icon:LayoutDashboard},
 {to:"/admin/curriculum",label:"My curriculum",icon:BookOpen},
 {to:"/admin/requests",label:"Request log",icon:ClipboardList},
 {to:"/admin/notifications",label:"Super Admin inbox",icon:Bell},
 {to:"/admin/activity",label:"User activity",icon:Users},
 {to:"/admin/feedback",label:"Student feedback",icon:MessageSquareText},
 {to:"/admin/department",label:"My assignment",icon:Building2},
 {to:"/admin/profile",label:"My profile",icon:UserRound},
 {to:"/admin/settings",label:"Settings",icon:Settings},
];
export default function AdminRequestCenter(){
 const navigate=useNavigate(),location=useLocation();
 const [workspaceOpen,setWorkspaceOpen]=useState(false);
 const [rows,setRows]=useState<RequestRow[]>([]),[unread,setUnread]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [requestType,setType]=useState("SYSTEM_CHANGE"),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[targetUserId,setTarget]=useState(""),[priority,setPriority]=useState("NORMAL"),[busy,setBusy]=useState(false);
 const token=()=>localStorage.getItem("gradly_admin_token")||localStorage.getItem("admin_token")||"";
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setWorkspaceOpen(false);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);
 useEffect(()=>{setWorkspaceOpen(false);},[location.pathname]);
 function logout(){localStorage.removeItem("gradly_admin_token");localStorage.removeItem("admin_token");navigate("/admin/login",{replace:true});}
 async function load(){setLoading(true);try{const t=token();if(!t)throw new Error("Admin session missing. Sign in again.");const r=await fetch(API_ROOT+"/admin/platform-requests",{headers:{Authorization:"Bearer "+t,Accept:"application/json"}});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||"Could not load requests.");setRows(Array.isArray(d.requests)?d.requests:[]);setUnread(Number(d.unreadCount)||0);setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load requests.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try{const r=await fetch(API_ROOT+"/admin/platform-requests",{method:"POST",headers:{Authorization:"Bearer "+token(),"Content-Type":"application/json"},body:JSON.stringify({requestType,title,description,targetUserId:targetUserId.trim()||null,priority})});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||"Could not submit request.");setNotice("Request submitted to Super Admin.");setTitle("");setDescription("");setTarget("");await load();}catch(e){setError(e instanceof Error?e.message:"Could not submit request.");}finally{setBusy(false);}}
 return <div className="admin-request-shell" data-theme={localStorage.getItem("gradly_admin_theme")==="dark"?"dark":"light"}>
  <header className="admin-request-topbar">
   <div className="admin-request-brand"><span className="admin-request-brand-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></div>
   <div className="admin-request-topbar-context"><span className="admin-request-online-dot"/><span>ADMINISTRATION / REQUEST LOG</span></div>
   <button type="button" className="admin-request-menu-toggle" aria-label={workspaceOpen?"Close workspace navigation":"Open workspace navigation"} aria-expanded={workspaceOpen} aria-controls="admin-request-navigation" onClick={()=>setWorkspaceOpen(open=>!open)}>{workspaceOpen?<X size={20}/>:<Menu size={20}/>}<span>Workspace</span></button>
  </header>
  {workspaceOpen&&<button type="button" className="admin-request-backdrop" aria-label="Close workspace navigation" onClick={()=>setWorkspaceOpen(false)}/>}
  <aside id="admin-request-navigation" className={"admin-request-drawer"+(workspaceOpen?" is-open":"")} aria-label="Admin workspace navigation">
   <div className="admin-request-drawer-heading">WORKSPACE</div>
   <nav>{adminNavigation.map(item=>{const Icon=item.icon;return <Link key={item.to} to={item.to} onClick={()=>setWorkspaceOpen(false)} className={"admin-request-nav-link"+(location.pathname===item.to?" is-active":"")}><Icon size={17}/><span>{item.label}</span><ChevronRight size={14} className="admin-request-nav-arrow"/></Link>;})}</nav>
   <div className="admin-request-drawer-spacer"/>
   <div className="admin-request-secure"><ShieldCheck size={18}/><span><strong>Scoped access</strong><small>Assigned department only</small></span></div>
   <Link to="/admin/change-password" className="admin-request-nav-link" onClick={()=>setWorkspaceOpen(false)}><ShieldCheck size={17}/><span>Account security</span><ChevronRight size={14} className="admin-request-nav-arrow"/></Link>
   <button type="button" className="admin-request-logout" onClick={logout}><LogOut size={17}/><span>Sign out</span></button>
   <div className="admin-request-drawer-foot">GRADLY ECOSYSTEM<br/>ADMIN SYSTEM / V2</div>
  </aside>
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
    <footer className="ad-footer"><span>Gradly · Request tracking</span><Link to="/admin/dashboard">Back to overview</Link></footer>
   </div>
  </main>
 </div>;
}
