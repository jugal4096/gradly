import { useCallback, useEffect, useState } from "react";
import { Settings2, ShieldCheck, Server, RefreshCw, CheckCircle2, AlertCircle, MonitorCog, LogOut, Sun, Moon, Type, Palette, Layout, RotateCcw, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./SuperAdminSettings.css";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "") + "/api";
type CheckState={state:"checking"|"ok"|"error";detail:string};
type Theme="light"|"dark";
type FontChoice="system"|"modern"|"serif";
const read=(key:string,fallback:string)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};

export default function SuperAdminSettings(){
 const navigate=useNavigate();
 const [checks,setChecks]=useState<{session:CheckState;database:CheckState}>({session:{state:"checking",detail:"Not checked yet"},database:{state:"checking",detail:"Not checked yet"}});
 const [theme,setTheme]=useState<Theme>(()=>read("gradly_sa_theme","light")==="dark"?"dark":"light");
 const [font,setFont]=useState<FontChoice>(()=>{const v=read("gradly_sa_font","system");return (["system","modern","serif"].includes(v)?v:"system") as FontChoice;});
 const [fontSize,setFontSize]=useState(()=>read("gradly_sa_font_size","normal"));
 const [compact,setCompact]=useState(()=>read("gradly_sa_compact_tables","false")==="true");
 const [reducedMotion,setReducedMotion]=useState(()=>read("gradly_sa_reduced_motion","false")==="true");
 const [confirmLogout,setConfirmLogout]=useState(false);
 const [saved,setSaved]=useState(false);

 const runChecks=useCallback(async()=>{
  const token=localStorage.getItem("gradly_super_admin_token");
  if(!token){setChecks({session:{state:"error",detail:"No Super Admin token found"},database:{state:"error",detail:"Sign in to test API connectivity"}});return;}
  setChecks({session:{state:"checking",detail:"Validating session…"},database:{state:"checking",detail:"Contacting backend…"}});
  try{const response=await fetch(API_ROOT+"/super-admin/me",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Session validation failed");setChecks(prev=>({...prev,session:{state:"ok",detail:"Authenticated Super Admin session is valid"}}));}
  catch(e){setChecks(prev=>({...prev,session:{state:"error",detail:e instanceof Error?e.message:"Session validation failed"}}));}
  try{const response=await fetch(API_ROOT+"/super-admin/dashboard/stats",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Backend health check failed");setChecks(prev=>({...prev,database:{state:"ok",detail:"Authenticated API responded successfully"}}));}
  catch(e){setChecks(prev=>({...prev,database:{state:"error",detail:e instanceof Error?e.message:"API health check failed"}}));}
 },[]);
 useEffect(()=>{void runChecks();},[runChecks]);
 useEffect(()=>{
  const root=document.documentElement;
  root.dataset.saTheme=theme;root.dataset.saFont=font;root.dataset.saFontSize=fontSize;
  root.classList.toggle("sa-compact-tables",compact);root.classList.toggle("sa-reduced-motion",reducedMotion);
  localStorage.setItem("gradly_sa_theme",theme);localStorage.setItem("gradly_sa_font",font);
  localStorage.setItem("gradly_sa_font_size",fontSize);localStorage.setItem("gradly_sa_compact_tables",String(compact));
  localStorage.setItem("gradly_sa_reduced_motion",String(reducedMotion));
  setSaved(true);const timer=window.setTimeout(()=>setSaved(false),1400);return()=>window.clearTimeout(timer);
 },[theme,font,fontSize,compact,reducedMotion]);
 function reset(){setTheme("light");setFont("system");setFontSize("normal");setCompact(false);setReducedMotion(false);}
 function logout(){localStorage.removeItem("gradly_super_admin_token");navigate("/super-admin/login",{replace:true});}
 const StatusIcon=({state}:{state:CheckState["state"]})=>state==="ok"?<CheckCircle2 size={18}/>:state==="error"?<AlertCircle size={18}/>:<RefreshCw size={18} className="sa-settings-spin"/>;
 return <main className="sa-settings" data-theme={theme}>
  <header className="sa-settings-head"><div><span className="sa-settings-kicker">WORKSPACE / PREFERENCES</span><h1>Settings</h1><p>Personalize the Super Admin workspace and check your current session and API connectivity.</p></div><button onClick={()=>void runChecks()} className="sa-settings-refresh"><RefreshCw size={15}/> Run checks</button></header>
  <section className="sa-settings-section"><div className="sa-settings-section-title"><Palette size={19}/><div><h2>Appearance</h2><p>Choose the theme and typography used across supported Super Admin pages.</p></div></div>
   <div className="sa-settings-theme-options">
    <button type="button" className={"sa-settings-theme-option"+(theme==="light"?" selected":"")} aria-pressed={theme==="light"} onClick={()=>setTheme("light")}><Sun size={22}/><strong>White / Light mode</strong><span>Clean bright workspace</span>{theme==="light"&&<Check size={17}/>}</button>
    <button type="button" className={"sa-settings-theme-option"+(theme==="dark"?" selected":"")} aria-pressed={theme==="dark"} onClick={()=>setTheme("dark")}><Moon size={22}/><strong>Dark mode</strong><span>Comfortable in low light</span>{theme==="dark"&&<Check size={17}/>}</button>
   </div>
   <div className="sa-settings-preference-grid">
    <label className="sa-settings-control"><span><Type size={15}/> Font family</span><select value={font} onChange={e=>setFont(e.target.value as FontChoice)}><option value="system">System default</option><option value="modern">Modern (DM Sans)</option><option value="serif">Classic (Georgia)</option></select><small>Applies to pages that use workspace typography.</small></label>
    <label className="sa-settings-control"><span>Text size</span><select value={fontSize} onChange={e=>setFontSize(e.target.value)}><option value="small">Small</option><option value="normal">Default</option><option value="large">Large</option></select><small>Adjusts general workspace text sizing.</small></label>
   </div>
   <label className="sa-settings-toggle-row"><div><strong><Layout size={16}/> Compact data tables</strong><span>Reduce row spacing on supported tables.</span></div><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/></label>
   <label className="sa-settings-toggle-row"><div><strong><MonitorCog size={16}/> Reduce animations</strong><span>Limit decorative movement and transitions.</span></div><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/></label>
   <div className="sa-settings-preference-footer">{saved&&<p className="sa-settings-saved" role="status"><Check size={15}/> Preferences saved automatically.</p>}<button className="sa-settings-reset" onClick={reset}><RotateCcw size={14}/> Reset defaults</button></div>
   <div className="sa-settings-info"><Settings2 size={17}/><p>These are local browser preferences for this device, not organization-wide settings. Some pages may need their theme styles wired to these preferences to reflect every change.</p></div>
  </section>
  <section className="sa-settings-section"><div className="sa-settings-section-title"><Server size={19}/><div><h2>System diagnostics</h2><p>Live checks against the authenticated Gradly API.</p></div></div><div className="sa-settings-checks">{([{key:"session",title:"Super Admin session",icon:ShieldCheck,check:checks.session},{key:"database",title:"Backend / dashboard API",icon:Server,check:checks.database}] as const).map(item=>{const Icon=item.icon;return <article className={"sa-settings-check "+item.check.state} key={item.key}><div className="sa-settings-check-icon"><Icon size={19}/></div><div className="sa-settings-check-copy"><strong>{item.title}</strong><span>{item.check.detail}</span></div><StatusIcon state={item.check.state}/></article>})}</div><p className="sa-settings-hint">A successful API response does not independently verify every database table or feature.</p></section>
  <section className="sa-settings-section sa-settings-danger"><div className="sa-settings-section-title"><LogOut size={19}/><div><h2>Session</h2><p>End the current Super Admin session on this device.</p></div></div>{!confirmLogout?<button className="sa-settings-logout" onClick={()=>setConfirmLogout(true)}>Sign out</button>:<div className="sa-settings-confirm"><span>Sign out of Gradly Super Admin?</span><button onClick={logout}>Confirm sign out</button><button onClick={()=>setConfirmLogout(false)}>Cancel</button></div>}</section>
 </main>;
}
