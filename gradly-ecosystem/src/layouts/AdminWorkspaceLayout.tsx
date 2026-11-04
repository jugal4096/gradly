import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Bell, BookOpen, Building2, ClipboardList, LayoutDashboard, LogOut, Menu, MessageSquareText, Settings, ShieldCheck, UserRound, Users, X, ChevronRight } from "lucide-react";
import "./AdminWorkspaceLayout.css";

const navigation=[
 {to:"/admin/dashboard",label:"Overview",icon:LayoutDashboard},
 {to:"/admin/curriculum",label:"My curriculum",icon:BookOpen},
 {to:"/admin/requests",label:"Request log",icon:ClipboardList},
 {to:"/admin/notifications",label:"Super Admin inbox",icon:Bell},
 {to:"/admin/activity",label:"User activity",icon:Users},
 {to:"/admin/feedback",label:"Student feedback",icon:MessageSquareText},
 {to:"/admin/department",label:"My assignment",icon:Building2},
 {to:"/admin/profile",label:"My profile",icon:UserRound},
 {to:"/admin/settings",label:"Settings",icon:Settings},
 {to:"/admin/change-password",label:"Account security",icon:ShieldCheck},
];
const titles:Record<string,string>={"/admin/dashboard":"Overview","/admin/curriculum":"My curriculum","/admin/requests":"Request log","/admin/notifications":"Super Admin inbox","/admin/activity":"User activity","/admin/feedback":"Student feedback","/admin/department":"My assignment","/admin/profile":"My profile","/admin/settings":"Settings","/admin/change-password":"Account security"};
export default function AdminWorkspaceLayout(){
 const location=useLocation(),navigate=useNavigate();
 const [open,setOpen]=useState(false);
 useEffect(()=>{setOpen(false);},[location.pathname]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);
 useEffect(()=>{if(!localStorage.getItem("gradly_admin_token")&&!localStorage.getItem("admin_token"))navigate("/admin/login",{replace:true});},[navigate]);
 const logout=()=>{localStorage.removeItem("gradly_admin_token");localStorage.removeItem("admin_token");navigate("/admin/login",{replace:true});};
 const title=titles[location.pathname]||"Admin workspace";
 return <div className="admin-unified-workspace" data-theme={localStorage.getItem("gradly_admin_theme")==="dark"?"dark":"light"} data-palette={localStorage.getItem("gradly_admin_palette")||"green"} data-font={localStorage.getItem("gradly_admin_font")||"system"} data-font-size={localStorage.getItem("gradly_admin_font_size")||"normal"} data-compact={localStorage.getItem("gradly_admin_compact")||"false"} data-reduced-motion={localStorage.getItem("gradly_admin_reduced_motion")||"false"}>
  <header className="auw-header">
   <button className="auw-menu" type="button" onClick={()=>setOpen(v=>!v)} aria-label={open?"Close workspace menu":"Open workspace menu"} aria-expanded={open}>{open?<X size={20}/>:<Menu size={20}/>}<span>Workspace</span></button>
   <Link to="/admin/dashboard" className="auw-brand"><span className="auw-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></Link>
   <div className="auw-context"><Activity size={14}/><span>ADMINISTRATION</span><i>/</i><strong>{title.toUpperCase()}</strong></div>
   <button className="auw-signout" type="button" onClick={logout}><LogOut size={16}/><span>Sign out</span></button>
  </header>
  {open&&<button className="auw-backdrop" type="button" aria-label="Close workspace menu" onClick={()=>setOpen(false)}/>}
  <aside className={"auw-drawer"+(open?" is-open":"")} aria-label="Admin workspace navigation">
   <div className="auw-drawer-title">YOUR WORKSPACE</div>
   <nav>{navigation.map(item=>{const Icon=item.icon;return <Link key={item.to} to={item.to} onClick={()=>setOpen(false)} className={"auw-link"+(location.pathname===item.to?" active":"")}><Icon size={17}/><span>{item.label}</span><ChevronRight size={14} className="auw-chevron"/></Link>;})}</nav>
   <div className="auw-security"><ShieldCheck size={18}/><span><strong>Scoped access</strong><small>Assigned department only</small></span></div>
   <div className="auw-foot">GRADLY ECOSYSTEM<br/>ADMIN SYSTEM / V2</div>
  </aside>
  <div className="auw-page"><Outlet/></div>
 </div>;
}
