import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, BookOpen, CheckCircle2, ClipboardList, GraduationCap, LayoutDashboard, LogOut, RefreshCw, ShieldCheck, Building2, Layers3 } from "lucide-react";
import "./AdminDashboard.css";

const API_ROOT = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";
type Profile = { admin_code?: string; adminCode?: string; full_name?: string; fullName?: string; role?: string; status?: string; institution_id?: string; institutionId?: string; institution_name?: string; institutionName?: string; program_id?: string | null; program_name?: string | null; branch_id?: string | null; branchId?: string | null; branch_name?: string | null; branchName?: string | null; };
type Course = { id: string; code?: string; name?: string; credits?: number | string; semester?: number | string; scheme?: string | null; branch?: string | null; program?: string | null; };
type RequestItem = { id: string; status: string; };
type NotificationItem = { id: string; readAt?: string | null; };

const clean=(value:unknown)=>String(value??"").trim();
const display=(value:unknown)=>clean(value)||"Not assigned";
const unique=(rows:Course[],key:keyof Course)=>new Set(rows.map(row=>clean(row[key])).filter(Boolean)).size;

export default function AdminDashboard() {
  const navigate=useNavigate();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [courses,setCourses]=useState<Course[]>([]);
  const [requests,setRequests]=useState<RequestItem[]>([]);
  const [notifications,setNotifications]=useState<NotificationItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const logout=useCallback(()=>{localStorage.removeItem("gradly_admin_token");navigate("/admin/login",{replace:true});},[navigate]);
  const load=useCallback(async()=>{
    const token=localStorage.getItem("gradly_admin_token");
    if(!token){navigate("/admin/login",{replace:true});return;}
    setLoading(true);setError("");
    try {
      const headers={Authorization:"Bearer "+token,Accept:"application/json"};
      const endpoints=["/admin/me","/admin/curriculum","/admin/subject-change-requests","/admin/workspace-notifications"];
      const responses=await Promise.all(endpoints.map(path=>fetch(API_ROOT+path,{headers})));
      if(responses.some(r=>r.status===401)){logout();return;}
      const data=await Promise.all(responses.map(r=>r.json().catch(()=>({}))));
      if(!responses[0].ok)throw new Error(data[0].message||"Unable to verify your Admin session.");
      setProfile(data[0].admin||data[0].data?.admin||null);
      if(responses[1].ok)setCourses(Array.isArray(data[1].curriculum)?data[1].curriculum:[]);
      if(responses[2].ok)setRequests(Array.isArray(data[2].requests)?data[2].requests:[]);
      if(responses[3].ok)setNotifications(Array.isArray(data[3].notifications)?data[3].notifications:[]);
      if(!responses[1].ok)throw new Error(data[1].message||"Unable to load your assigned curriculum.");
    } catch(e){setError(e instanceof Error?e.message:"Unable to load the Admin workspace.");}
    finally{setLoading(false);}
  },[logout,navigate]);
  useEffect(()=>{void load();},[load]);

  const adminName=display(profile?.full_name||profile?.fullName||profile?.admin_code||profile?.adminCode);
  const institution=display(profile?.institution_name||profile?.institutionName||courses[0]?.branch);
  const program=display(profile?.program_name||courses[0]?.program);
  const department=display(profile?.branch_name||profile?.branchName||courses[0]?.branch);
  const unread=notifications.filter(n=>!n.readAt).length;
  const pending=requests.filter(r=>String(r.status).toUpperCase()==="PENDING").length;

  const navItems=[
    {to:"/admin/dashboard",label:"Overview",icon:LayoutDashboard,active:true},
    {to:"/admin/curriculum",label:"My curriculum",icon:BookOpen},
    {to:"/admin/requests",label:"Change requests",icon:ClipboardList,badge:pending},
    {to:"/admin/notifications",label:"Super Admin inbox",icon:Bell,badge:unread},
    {to:"/admin/department",label:"My assignment",icon:Building2},
  ];

  return <main className="admin-dashboard">
    <aside className="ad-sidebar">
      <Link to="/admin/dashboard" className="ad-brand"><span className="ad-brand-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></Link>
      <p className="ad-sidebar-label">WORKSPACE</p>
      <nav className="ad-sidebar-nav" aria-label="Admin navigation">{navItems.map(item=><Link key={item.to} to={item.to} className={"ad-nav-link"+(item.active?" active":"")}><item.icon size={17}/><span>{item.label}</span>{Boolean(item.badge)&&<em>{item.badge}</em>}</Link>)}</nav>
      <div className="ad-sidebar-bottom"><div className="ad-secure-card"><ShieldCheck size={19}/><span><strong>Scoped access</strong><small>Assigned department only</small></span></div><Link to="/admin/change-password" className="ad-nav-link"><ShieldCheck size={17}/><span>Account security</span></Link><button type="button" className="ad-logout" onClick={logout}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <section className="ad-main-column">
      <header className="ad-topbar"><div className="ad-breadcrumb"><span>Admin workspace</span><span>/</span><strong>Overview</strong></div><div className="ad-topbar-right"><span className="ad-live-dot"/><span>Signed in as {adminName}</span><button type="button" className="ad-icon-button" onClick={()=>void load()} disabled={loading} aria-label="Refresh workspace"><RefreshCw size={16}/></button><span className="ad-avatar">{adminName.slice(0,1).toUpperCase()}</span></div></header>
      <div className="ad-content">
        <section className="ad-hero"><div className="ad-hero-content"><span className="ad-eyebrow"><CheckCircle2 size={14}/> DEPARTMENT ADMINISTRATION</span><h1>Good to see you, <span>{adminName.split(" ")[0]}</span>.</h1><p>Your Gradly workspace, focused on the academic program and department assigned to you. Review curriculum, submit change requests and stay in touch with Super Admin.</p><div className="ad-assignment-line"><Building2 size={15}/><span>{institution}</span><i>·</i><span>{program}</span><i>·</i><span>{department}</span></div><Link to="/admin/curriculum" className="ad-primary-action">Review my curriculum <ArrowRight size={16}/></Link></div><div className="ad-hero-art" aria-hidden="true"><div className="ad-art-ring"/><div className="ad-art-card"><div className="ad-art-icon"><GraduationCap size={27}/></div><span className="ad-art-line wide"/><span className="ad-art-line"/><div className="ad-art-bars"><i/><i/><i/><i/><i/><i/></div><small>Academic workspace</small></div></div></section>
        {error&&<div className="ad-alert" role="alert"><ShieldCheck size={18}/><div><strong>Workspace data could not be fully loaded</strong><p>{error}</p><button type="button" onClick={()=>void load()}>Try again</button></div></div>}
        <section className="ad-section"><div className="ad-section-heading"><div><span className="ad-section-kicker">YOUR WORKSPACE</span><h2>Academic overview</h2><p>Live figures are based only on records returned for your assigned academic scope.</p></div><button type="button" className="ad-text-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
          <div className="ad-metric-grid">
            <article className="ad-metric-card"><span className="ad-metric-icon"><BookOpen size={20}/></span><span className="ad-metric-label">Assigned curriculum</span><strong>{loading?"—":courses.length.toLocaleString("en-IN")}</strong><small>Courses visible to your assignment</small><Link to="/admin/curriculum">View curriculum <ArrowRight size={13}/></Link></article>
            <article className="ad-metric-card"><span className="ad-metric-icon sage"><Layers3 size={20}/></span><span className="ad-metric-label">Semesters covered</span><strong>{loading?"—":unique(courses,"semester")}</strong><small>Across your assigned curriculum</small><Link to="/admin/curriculum">Browse semesters <ArrowRight size={13}/></Link></article>
            <article className="ad-metric-card"><span className="ad-metric-icon amber"><ClipboardList size={20}/></span><span className="ad-metric-label">Pending requests</span><strong>{loading?"—":pending}</strong><small>Your requests awaiting review</small><Link to="/admin/requests">Track requests <ArrowRight size={13}/></Link></article>
            <article className="ad-metric-card"><span className="ad-metric-icon blue"><Bell size={20}/></span><span className="ad-metric-label">Unread messages</span><strong>{loading?"—":unread}</strong><small>Updates from Super Admin</small><Link to="/admin/notifications">Open inbox <ArrowRight size={13}/></Link></article>
          </div>
        </section>
        <section className="ad-section"><div className="ad-section-heading"><div><span className="ad-section-kicker">QUICK ACCESS</span><h2>What would you like to do?</h2><p>Common tasks for department administrators.</p></div></div><div className="ad-quick-grid">
          <Link to="/admin/curriculum" className="ad-quick-card"><span><BookOpen size={20}/></span><strong>Review curriculum</strong><p>Find subjects, semester allocation, credits and schemes in your assigned department.</p><b>Open curriculum <ArrowRight size={14}/></b></Link>
          <Link to="/admin/requests" className="ad-quick-card"><span><ClipboardList size={20}/></span><strong>Request a subject change</strong><p>Submit add, remove or modify proposals for Super Admin review.</p><b>Manage requests <ArrowRight size={14}/></b></Link>
          <Link to="/admin/notifications" className="ad-quick-card"><span><Bell size={20}/></span><strong>Super Admin inbox</strong><p>Read official announcements and action notes sent to your account.</p><b>View messages <ArrowRight size={14}/></b></Link>
        </div></section>
        <footer className="ad-footer"><span><ShieldCheck size={15}/> Gradly · Department-scoped administration</span><span>Academic changes require Super Admin approval.</span></footer>
      </div>
    </section>
  </main>;
}
