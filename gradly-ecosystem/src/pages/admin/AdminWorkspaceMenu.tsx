import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, BookOpen, ClipboardList, Bell, Users, MessageSquareText, Building2, UserRound, Settings, ShieldCheck, LogOut, ChevronRight } from "lucide-react";
import "./AdminWorkspaceMenu.css";

const items=[
 {to:"/admin/dashboard",label:"Overview",icon:LayoutDashboard},
 {to:"/admin/curriculum",label:"My curriculum",icon:BookOpen},
 {to:"/admin/requests",label:"Request center",icon:ClipboardList},
 {to:"/admin/notifications",label:"Super Admin inbox",icon:Bell},
 {to:"/admin/activity",label:"User activity",icon:Users},
 {to:"/admin/feedback",label:"Student feedback",icon:MessageSquareText},
 {to:"/admin/department",label:"My assignment",icon:Building2},
 {to:"/admin/profile",label:"My profile",icon:UserRound},
 {to:"/admin/settings",label:"Settings",icon:Settings},
 {to:"/admin/change-password",label:"Account security",icon:ShieldCheck},
];
export default function AdminWorkspaceMenu(){
 const [open,setOpen]=useState(false);
 const location=useLocation(),navigate=useNavigate();
 useEffect(()=>{setOpen(false);},[location.pathname]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);
 const logout=()=>{localStorage.removeItem("gradly_admin_token");localStorage.removeItem("admin_token");navigate("/admin/login",{replace:true});};
 return <>
  <button type="button" className="admin-workspace-menu-toggle" aria-label={open?"Close workspace menu":"Open workspace menu"} aria-expanded={open} aria-controls="admin-workspace-menu-drawer" onClick={()=>setOpen(v=>!v)}>{open?<X size={21}/>:<Menu size={21}/>}</button>
  {open&&<button type="button" className="admin-workspace-menu-backdrop" aria-label="Close workspace menu" onClick={()=>setOpen(false)}/>}
  <aside id="admin-workspace-menu-drawer" className={"admin-workspace-menu-drawer"+(open?" is-open":"")} aria-hidden={!open}>
   <div className="admin-workspace-menu-brand"><span>G</span><div><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></div></div>
   <div className="admin-workspace-menu-label">WORKSPACE NAVIGATION</div>
   <nav>{items.map(item=>{const Icon=item.icon;const active=location.pathname===item.to;return <Link key={item.to} to={item.to} tabIndex={open?0:-1} className={"admin-workspace-menu-link"+(active?" active":"")}><Icon size={17}/><span>{item.label}</span><ChevronRight size={15}/></Link>;})}</nav>
   <div className="admin-workspace-menu-spacer"/>
   <div className="admin-workspace-menu-scope"><ShieldCheck size={18}/><span><strong>Scoped access</strong><small>Assigned department only</small></span></div>
   <button type="button" className="admin-workspace-menu-logout" onClick={logout}><LogOut size={17}/> Sign out</button>
   <small className="admin-workspace-menu-foot">GRADLY ECOSYSTEM · ADMIN SYSTEM</small>
  </aside>
 </>;
}
