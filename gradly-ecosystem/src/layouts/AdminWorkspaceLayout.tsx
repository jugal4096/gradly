import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Bell, BookOpen, Building2, ClipboardList, LayoutDashboard, LogOut, Menu, MessageSquareText, Settings, ShieldCheck, UserRound, Users, X, ChevronRight } from "lucide-react";
import "./AdminWorkspaceLayout.css";

const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"").replace(/\/api$/i,""))+"/api";

const navigation=[
 {to:"/admin/dashboard",label:"Overview",icon:LayoutDashboard},
 {to:"/admin/curriculum",label:"My curriculum",icon:BookOpen},
 {to:"/admin/requests",label:"Request log",icon:ClipboardList},
 {to:"/admin/notifications",label:"Notifications",icon:Bell},
 {to:"/admin/activity",label:"User activity",icon:Users},
 {to:"/admin/feedback",label:"Student feedback",icon:MessageSquareText},
 {to:"/admin/department",label:"My assignment",icon:Building2},
 {to:"/admin/profile",label:"My profile",icon:UserRound},
 {to:"/admin/settings",label:"Settings",icon:Settings},
 {to:"/admin/change-password",label:"Account security",icon:ShieldCheck},
];
const titles:Record<string,string>={"/admin/dashboard":"Overview","/admin/curriculum":"My curriculum","/admin/requests":"Request log","/admin/notifications":"Notifications","/admin/activity":"User activity","/admin/feedback":"Student feedback","/admin/department":"My assignment","/admin/profile":"My profile","/admin/settings":"Settings","/admin/change-password":"Account security"};
export default function AdminWorkspaceLayout(){
 const location=useLocation(),navigate=useNavigate();
 const [open,setOpen]=useState(false);
 const [unreadCount,setUnreadCount]=useState(0);
 const [settingsTick,setSettingsTick]=useState(0);
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.("(prefers-color-scheme: dark)").matches??false);
 const themePreference=localStorage.getItem("gradly_admin_theme")||"light";
 const effectiveTheme=themePreference==="system"?(systemDark?"dark":"light"):themePreference;
 useEffect(()=>{setOpen(false);},[location.pathname]);
 useEffect(()=>{const refreshSettings=()=>setSettingsTick(v=>v+1);window.addEventListener("gradly-admin-settings-change",refreshSettings);return()=>window.removeEventListener("gradly-admin-settings-change",refreshSettings);},[]);
 useEffect(()=>{
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const update=()=>setSystemDark(media.matches);
  update();media.addEventListener?.("change",update);
  return()=>media.removeEventListener?.("change",update);
 },[]);
 useEffect(()=>{
  let active=true;
  const refreshUnread=async()=>{
   const token=localStorage.getItem("gradly_admin_token");
   if(!token){if(active)setUnreadCount(0);return;}
   try{
    const response=await fetch(API_ROOT+"/admin/workspace-notifications",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
    if(!response.ok)return;
    const data=await response.json().catch(()=>({}));
    if(active)setUnreadCount(Array.isArray(data.notifications)?data.notifications.filter((item:any)=>!item.readAt).length:0);
   }catch{/* Keep the last known badge count while offline. */}
  };
  void refreshUnread();
  const interval=window.setInterval(refreshUnread,60000);
  window.addEventListener("focus",refreshUnread);
  window.addEventListener("gradly-admin-notifications-updated",refreshUnread);
  return()=>{active=false;window.clearInterval(interval);window.removeEventListener("focus",refreshUnread);window.removeEventListener("gradly-admin-notifications-updated",refreshUnread);};
 },[location.pathname]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);
 useEffect(()=>{if(!localStorage.getItem("gradly_admin_token")&&!localStorage.getItem("admin_token"))navigate("/admin/login",{replace:true});},[navigate]);
 const logout=()=>{localStorage.removeItem("gradly_admin_token");localStorage.removeItem("admin_token");navigate("/admin/login",{replace:true});};
 const title=titles[location.pathname]||"Admin workspace";
 return <div className="admin-unified-workspace" data-theme={effectiveTheme} data-palette={localStorage.getItem("gradly_admin_palette")||"green"} data-font={localStorage.getItem("gradly_admin_font")||"system"} data-font-size={localStorage.getItem("gradly_admin_font_size")||"normal"} data-compact={localStorage.getItem("gradly_admin_compact")||"false"} data-reduced-motion={localStorage.getItem("gradly_admin_reduced_motion")||"false"}>
  <header className="auw-header">
   <button className="auw-menu" type="button" onClick={()=>setOpen(v=>!v)} aria-label={open?"Close workspace menu":"Open workspace menu"} aria-expanded={open}>{open?<X size={20}/>:<Menu size={20}/>}<span>Workspace</span></button>
   <Link to="/admin/dashboard" className="auw-brand"><span className="auw-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></Link>
   <div className="auw-context"><Activity size={14}/><span>ADMINISTRATION</span><i>/</i><strong>{title.toUpperCase()}</strong></div>
   <button className="auw-signout" type="button" onClick={logout}><LogOut size={16}/><span>Sign out</span></button>
  </header>
  {open&&<button className="auw-backdrop" type="button" aria-label="Close workspace menu" onClick={()=>setOpen(false)}/>}
  <aside className={"auw-drawer"+(open?" is-open":"")} aria-label="Admin workspace navigation">
   <div className="auw-drawer-title">YOUR WORKSPACE</div>
   <nav>{navigation.map(item=>{const Icon=item.icon;return <Link key={item.to} to={item.to} onClick={()=>setOpen(false)} className={"auw-link"+(location.pathname===item.to?" active":"")}><Icon size={17}/><span>{item.label}</span>{item.to==="/admin/notifications"&&unreadCount>0&&<em className="auw-unread-badge" aria-label={`${unreadCount} unseen notifications`}>{unreadCount>99?"99+":unreadCount}</em>}<ChevronRight size={14} className="auw-chevron"/></Link>;})}</nav>
   <div className="auw-security"><ShieldCheck size={18}/><span><strong>Scoped access</strong><small>Assigned department only</small></span></div>
   <div className="auw-foot">GRADLY ECOSYSTEM<br/>ADMIN SYSTEM / V2</div>
  </aside>
  <div className="auw-page"><Outlet/></div>
 </div>;
}
