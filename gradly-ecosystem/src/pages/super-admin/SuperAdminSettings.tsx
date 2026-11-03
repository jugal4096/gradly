import { useCallback, useEffect, useState } from "react";
import { Settings2, ShieldCheck, Server, RefreshCw, CheckCircle2, AlertCircle, MonitorCog, LogOut, Sun, Moon, Type, Palette, Layout, RotateCcw, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./SuperAdminSettings.css";
import SuperAdminBlacklist from "./SuperAdminBlacklist";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "") + "/api";
type CheckState={state:"checking"|"ok"|"warning"|"error";detail:string};
type Theme="light"|"dark"|"system";
type PaletteChoice="purple"|"green";
type FontChoice="system"|"segoe"|"inter"|"roboto"|"arial"|"verdana"|"tahoma"|"trebuchet"|"georgia"|"mono";
const read=(key:string,fallback:string)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};

export default function SuperAdminSettings(){
 const navigate=useNavigate();
 const [checks,setChecks]=useState<{session:CheckState;database:CheckState;security:CheckState}>({session:{state:"checking",detail:"Not checked yet"},database:{state:"checking",detail:"Not checked yet"},security:{state:"checking",detail:"Not checked yet"}});
 const [theme,setTheme]=useState<Theme>(()=>{const v=read("gradly_sa_theme","light");return v==="dark"||v==="system"?v:"light";});
 const [palette,setPalette]=useState<PaletteChoice>(()=>read("gradly_sa_palette","purple")==="green"?"green":"purple");
 const [font,setFont]=useState<FontChoice>(()=>{const v=read("gradly_sa_font","system");return (["system","segoe","inter","roboto","arial","verdana","tahoma","trebuchet","georgia","mono"].includes(v)?v:"system") as FontChoice;});
 const [fontSize,setFontSize]=useState(()=>read("gradly_sa_font_size","normal"));
 const [compact,setCompact]=useState(()=>read("gradly_sa_compact_tables","false")==="true");
 const [reducedMotion,setReducedMotion]=useState(()=>read("gradly_sa_reduced_motion","false")==="true");
 const [confirmLogout,setConfirmLogout]=useState(false);
 const [saved,setSaved]=useState(false);

 const runChecks=useCallback(async()=>{
  const token=localStorage.getItem("gradly_super_admin_token");
  if(!token){setChecks({session:{state:"error",detail:"No Super Admin token found"},database:{state:"error",detail:"Sign in to test API connectivity"},security:{state:"error",detail:"Sign in to run authenticated security checks"}});return;}
  setChecks({session:{state:"checking",detail:"Validating session…"},database:{state:"checking",detail:"Contacting backend…"},security:{state:"checking",detail:"Reviewing transport and response security headers…"}});
  try{const response=await fetch(API_ROOT+"/super-admin/me",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Session validation failed");setChecks(prev=>({...prev,session:{state:"ok",detail:"Authenticated Super Admin session is valid"}}));
   const apiUrl = new URL(API_ROOT);
   const localHosts = ["localhost", "127.0.0.1", "::1"];
   const appTransportSecure = window.location.protocol === "https:" || localHosts.includes(window.location.hostname);
   const apiTransportSecure = apiUrl.protocol === "https:" || localHosts.includes(apiUrl.hostname);
   const secureTransport = appTransportSecure && apiTransportSecure;
   const headerNames = ["content-security-policy","x-content-type-options","referrer-policy"];
   const missingHeaders = headerNames.filter(name => !response.headers.get(name));
   const securityIssues = [...(!secureTransport ? ["Workspace is not using HTTPS"] : []), ...(missingHeaders.length ? ["Missing or browser-hidden response headers: " + missingHeaders.join(", ")] : [])];
   setChecks(prev=>({...prev,security:{state:securityIssues.length?"warning":"ok",detail:securityIssues.length?securityIssues.join(" · "):"HTTPS/local development transport and baseline security response headers detected"}}));}
  catch(e){setChecks(prev=>({...prev,session:{state:"error",detail:e instanceof Error?e.message:"Session validation failed"},security:{state:"error",detail:"Could not inspect authenticated response security headers"}}));}
  try{const response=await fetch(API_ROOT+"/super-admin/dashboard/stats",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Backend health check failed");setChecks(prev=>({...prev,database:{state:"ok",detail:"Authenticated API responded successfully"}}));}
  catch(e){setChecks(prev=>({...prev,database:{state:"error",detail:e instanceof Error?e.message:"API health check failed"}}));}
 },[]);
 useEffect(()=>{void runChecks();},[runChecks]);
 useEffect(()=>{
  const root=document.documentElement;
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme=()=>{const effective=theme==="system"?(media.matches?"dark":"light"):theme;root.dataset.saTheme=effective;root.dataset.saThemePreference=theme;root.style.colorScheme=effective;};
  applyTheme();
  if(theme==="system"){media.addEventListener("change",applyTheme);}
  root.dataset.saPalette=palette;root.dataset.saFont=font;
  localStorage.setItem("gradly_sa_palette",palette);root.dataset.saFontSize=fontSize;
  root.classList.toggle("sa-compact-tables",compact);root.classList.toggle("sa-reduced-motion",reducedMotion);
  localStorage.setItem("gradly_sa_theme",theme);localStorage.setItem("gradly_sa_font",font);
  window.dispatchEvent(new Event("gradly:appearance-updated"));
  localStorage.setItem("gradly_sa_font_size",fontSize);localStorage.setItem("gradly_sa_compact_tables",String(compact));
  localStorage.setItem("gradly_sa_reduced_motion",String(reducedMotion));
  setSaved(true);const timer=window.setTimeout(()=>setSaved(false),1400);return()=>{window.clearTimeout(timer);if(theme==="system")window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change",applyTheme);};
 },[theme,palette,font,fontSize,compact,reducedMotion]);
 function reset(){setTheme("system");setPalette("purple");setFont("system");setFontSize("normal");setCompact(false);setReducedMotion(false);}
 function logout(){localStorage.removeItem("gradly_super_admin_token");navigate("/super-admin/login",{replace:true});}
 const StatusIcon=({state}:{state:CheckState["state"]})=>state==="ok"?<CheckCircle2 size={18}/>:state==="error"||state==="warning"?<AlertCircle size={18}/>:<RefreshCw size={18} className="sa-settings-spin"/>;
 return <main className="sa-settings" data-theme={theme}>
  <header className="sa-settings-head"><div><span className="sa-settings-kicker">WORKSPACE / PREFERENCES</span><h1>Settings</h1><p>Personalize the Super Admin workspace and check your current session and API connectivity.</p></div><button onClick={()=>void runChecks()} className="sa-settings-refresh"><RefreshCw size={15}/> Run security scan</button></header>
  <section className="sa-settings-section"><div className="sa-settings-section-title"><Palette size={19}/><div><h2>Appearance</h2><p>Choose the workspace appearance. Changes apply across the Super Admin application, not only this page.</p></div></div>
   <div className="sa-settings-theme-options">
    <button type="button" className={"sa-settings-theme-option"+(theme==="light"?" selected":"")} aria-pressed={theme==="light"} onClick={()=>setTheme("light")}><Sun size={22}/><strong>Light</strong><span>Bright, neutral surfaces</span>{theme==="light"&&<Check size={17}/>}</button>
    <button type="button" className={"sa-settings-theme-option"+(theme==="dark"?" selected":"")} aria-pressed={theme==="dark"} onClick={()=>setTheme("dark")}><Moon size={22}/><strong>Dark</strong><span>Balanced low-light surfaces</span>{theme==="dark"&&<Check size={17}/>}</button>
    <button type="button" className={"sa-settings-theme-option"+(theme==="system"?" selected":"")} aria-pressed={theme==="system"} onClick={()=>setTheme("system")}><MonitorCog size={22}/><strong>Use device setting</strong><span>Follow Windows / device appearance</span>{theme==="system"&&<Check size={17}/>}</button>
   </div>
   <div className="sa-settings-palette-block">
    <div className="sa-settings-palette-heading"><strong>Workspace accent colour</strong><span>Choose the accent colour used by navigation, buttons, links, focus states and status highlights.</span></div>
    <div className="sa-settings-palette-options" role="group" aria-label="Super Admin workspace accent colour">
     <button type="button" className={"sa-settings-palette-option palette-purple"+(palette==="purple"?" selected":"")} aria-pressed={palette==="purple"} onClick={()=>setPalette("purple")}><span className="sa-settings-palette-swatch" aria-hidden="true"/><strong>Governance purple</strong><small>Platform identity</small>{palette==="purple"&&<Check size={17}/>}</button>
     <button type="button" className={"sa-settings-palette-option palette-green"+(palette==="green"?" selected":"")} aria-pressed={palette==="green"} onClick={()=>setPalette("green")}><span className="sa-settings-palette-swatch" aria-hidden="true"/><strong>Enterprise green</strong><small>Alternative identity</small>{palette==="green"&&<Check size={17}/>}</button>
    </div>
   </div>
   <div className="sa-settings-preference-grid">
    <label className="sa-settings-control"><span><Type size={15}/> Font family</span><select value={font} onChange={e=>setFont(e.target.value as FontChoice)}><option value="system">System default</option><option value="segoe">Segoe UI (Windows)</option><option value="inter">Inter</option><option value="roboto">Roboto</option><option value="arial">Arial</option><option value="verdana">Verdana</option><option value="tahoma">Tahoma</option><option value="trebuchet">Trebuchet MS</option><option value="georgia">Georgia</option><option value="mono">Consolas (Monospace)</option></select><small>Applies across the Super Admin workspace.</small></label>
    <label className="sa-settings-control"><span>Text size</span><select value={fontSize} onChange={e=>setFontSize(e.target.value)}><option value="small">Small</option><option value="normal">Default</option><option value="large">Large</option></select><small>Adjusts general workspace text sizing.</small></label>
   </div>
   <label className="sa-settings-toggle-row"><div><strong><Layout size={16}/> Compact data tables</strong><span>Reduce row spacing on supported tables.</span></div><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/></label>
   <label className="sa-settings-toggle-row"><div><strong><MonitorCog size={16}/> Reduce animations</strong><span>Limit decorative movement and transitions.</span></div><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/></label>
   <div className="sa-settings-preference-footer">{saved&&<p className="sa-settings-saved" role="status"><Check size={15}/> Preferences saved automatically.</p>}<button className="sa-settings-reset" onClick={reset}><RotateCcw size={14}/> Reset defaults</button></div>
   <div className="sa-settings-info"><Settings2 size={17}/><p>Preferences are saved automatically in this browser and applied throughout the Super Admin workspace. They do not change the student website or other users’ settings.</p></div>
  </section>
  <section id="account-restrictions" className="sa-settings-section"><div className="sa-settings-section-title"><ShieldCheck size={19}/><div><h2>Account restrictions</h2><p>Review disabled accounts and restore access when appropriate. This replaces the separate Blacklist navigation page.</p></div></div><SuperAdminBlacklist /></section>
  <section className="sa-settings-section"><div className="sa-settings-section-title"><Server size={19}/><div><h2>Security scan</h2><p>Run a practical workspace security check covering your session, API connectivity and browser transport. This is a configuration check, not a penetration test.</p></div></div><div className="sa-settings-checks">{([{key:"session",title:"Super Admin session",icon:ShieldCheck,check:checks.session},{key:"database",title:"Backend / dashboard API",icon:Server,check:checks.database},{key:"security",title:"Transport & security headers",icon:ShieldCheck,check:checks.security}] as const).map(item=>{const Icon=item.icon;return <article className={"sa-settings-check "+item.check.state} key={item.key}><div className="sa-settings-check-icon"><Icon size={19}/></div><div className="sa-settings-check-copy"><strong>{item.title}</strong><span>{item.check.detail}</span></div><StatusIcon state={item.check.state}/></article>})}</div><p className="sa-settings-hint">A successful scan is not a full vulnerability assessment. Review hosting, database permissions, dependency advisories and server-side security controls separately before production release.</p></section>
  <section className="sa-settings-section sa-settings-danger"><div className="sa-settings-section-title"><LogOut size={19}/><div><h2>Session</h2><p>End the current Super Admin session on this device.</p></div></div>{!confirmLogout?<button className="sa-settings-logout" onClick={()=>setConfirmLogout(true)}>Sign out</button>:<div className="sa-settings-confirm"><span>Sign out of Gradly Super Admin?</span><button onClick={logout}>Confirm sign out</button><button onClick={()=>setConfirmLogout(false)}>Cancel</button></div>}</section>
 </main>;
}
