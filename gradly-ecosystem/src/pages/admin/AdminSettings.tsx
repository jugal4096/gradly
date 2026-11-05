import { useEffect, useState } from "react";
import AdminWorkspaceMenu from "./AdminWorkspaceMenu";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Moon, Sun, ShieldCheck, UserRound, Bell, Palette, Type, LogOut, Layout, RotateCcw } from "lucide-react";
import "./AdminDashboard.css";

type Theme = "light" | "dark" | "system";
type PaletteChoice = "green" | "blue" | "yellow";
type FontChoice = "system" | "inter" | "roboto" | "lato" | "poppins" | "nunito" | "opensans" | "montserrat" | "dm-sans" | "manrope" | "source-sans" | "raleway" | "ubuntu" | "georgia" | "times" | "verdana" | "tahoma" | "trebuchet" | "mono";
const getSetting = (key: string, fallback: string) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};

export default function AdminSettings() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => (["light","dark","system"].includes(getSetting("gradly_admin_theme","light")) ? getSetting("gradly_admin_theme","light") : "light") as Theme);
  const [palette, setPalette] = useState<PaletteChoice>(() => {
    const value = getSetting("gradly_admin_palette", "green");
    return (["green", "blue", "yellow"].includes(value) ? value : "green") as PaletteChoice;
  });
  const [font, setFont] = useState<FontChoice>(() => (["system","inter","roboto","lato","poppins","nunito","opensans","montserrat","dm-sans","manrope","source-sans","raleway","ubuntu","georgia","times","verdana","tahoma","trebuchet","mono"].includes(getSetting("gradly_admin_font","system")) ? getSetting("gradly_admin_font","system") : "system") as FontChoice);
  const [fontSize, setFontSize] = useState(() => (["xs","small","normal","large","xlarge","xxlarge"].includes(getSetting("gradly_admin_font_size","normal"))?getSetting("gradly_admin_font_size","normal"):"normal"));
  const [compact, setCompact] = useState(() => getSetting("gradly_admin_compact","false") === "true");
  const [reducedMotion, setReducedMotion] = useState(() => getSetting("gradly_admin_reduced_motion","false") === "true");
  const [saved, setSaved] = useState(false);

  const [systemDark,setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => {
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const update=()=>setSystemDark(media.matches);
    update();
    media.addEventListener("change",update);
    return()=>media.removeEventListener("change",update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.adminTheme = effectiveTheme;
    document.documentElement.dataset.adminFont = font;
    document.documentElement.dataset.adminFontSize = fontSize;
    document.documentElement.dataset.adminReducedMotion = String(reducedMotion);
    document.documentElement.dataset.adminPalette = palette;
    localStorage.setItem("gradly_admin_palette", palette);
    document.documentElement.dataset.adminFont = font;
    document.documentElement.dataset.adminFontSize = fontSize;
    document.documentElement.dataset.adminCompact = String(compact);
    document.documentElement.dataset.adminReducedMotion = String(reducedMotion);
    localStorage.setItem("gradly_admin_theme", theme);
    localStorage.setItem("gradly_admin_font", font);
    localStorage.setItem("gradly_admin_font_size", fontSize);
    localStorage.setItem("gradly_admin_compact", String(compact));
    localStorage.setItem("gradly_admin_reduced_motion", String(reducedMotion));
    window.dispatchEvent(new Event("gradly-admin-settings-change"));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 1500);
    return () => window.clearTimeout(timer);
  }, [theme,effectiveTheme,palette,font,fontSize,compact,reducedMotion]);

  const signOut = () => {
    if (!window.confirm("Sign out of your Gradly Admin account?")) return;
    localStorage.removeItem("gradly_admin_token");
    navigate("/admin/login", { replace: true });
  };
  const reset = () => {
    setTheme("light"); setPalette("green"); setFont("system"); setFontSize("normal"); setCompact(false); setReducedMotion(false);
  };

  return <><AdminWorkspaceMenu/><main className="admin-dashboard" data-theme={effectiveTheme} data-palette={palette} data-font={font} data-font-size={fontSize} data-compact={String(compact)} data-reduced-motion={String(reducedMotion)}>
    <aside className="ad-sidebar">
      <Link to="/admin/dashboard" className="ad-brand"><span className="ad-brand-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></Link>
      <p className="ad-sidebar-label">PREFERENCES</p>
      <nav className="ad-sidebar-nav">
        <Link to="/admin/profile" className="ad-nav-link"><UserRound size={17}/> My profile</Link>
        <Link to="/admin/notifications" className="ad-nav-link"><Bell size={17}/> Notifications</Link>
        <Link to="/admin/change-password" className="ad-nav-link"><ShieldCheck size={17}/> Account security</Link>
        <Link to="/admin/settings" className="ad-nav-link active"><Palette size={17}/> Settings</Link>
      </nav>
      <div className="ad-sidebar-bottom">
        <div className="ad-secure-card"><ShieldCheck size={18}/><span><strong>Your account is protected</strong><small>Academic access is controlled by Super Admin.</small></span></div>
        <Link to="/admin/dashboard" className="ad-nav-link"><ArrowLeft size={16}/> Back to workspace</Link>
        <button type="button" className="ad-logout" onClick={signOut}><LogOut size={16}/> Sign out</button>
      </div>
    </aside>
    <section className="ad-main-column">
      <header className="ad-topbar"><div className="ad-breadcrumb"><Link to="/admin/dashboard">Admin workspace</Link><span>/</span><strong>Settings</strong></div><button type="button" className="ad-icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={16}/></button></header>
      <div className="ad-content ad-settings-content">
        <section className="ad-page-heading"><div><span className="ad-section-kicker">PERSONALIZE YOUR WORKSPACE</span><h1>Settings</h1><p>Make Gradly comfortable to use. Your preferences are saved on this device.</p></div><button type="button" className="ad-secondary-button" onClick={reset}><RotateCcw size={14}/> Reset defaults</button></section>
        <section className="ad-panel">
          <div className="ad-panel-heading"><div><span className="ad-section-kicker">APPEARANCE</span><h2><Palette size={19}/> Appearance</h2><p>Choose the workspace appearance. Changes apply across the entire Admin application, not only this page.</p></div></div>
          <div className="ad-theme-options">
            <button type="button" className={"ad-theme-option"+(theme==="light"?" selected":"")} aria-pressed={theme==="light"} onClick={()=>setTheme("light")}><Sun size={22}/><strong>Light</strong><span>Bright, neutral surfaces</span>{theme==="light"&&<Check size={17}/>}</button>
            <button type="button" className={"ad-theme-option"+(theme==="dark"?" selected":"")} aria-pressed={theme==="dark"} onClick={()=>setTheme("dark")}><Moon size={22}/><strong>Dark</strong><span>Balanced low-light surfaces</span>{theme==="dark"&&<Check size={17}/>}</button>
            <button type="button" className={"ad-theme-option"+(theme==="system"?" selected":"")} aria-pressed={theme==="system"} onClick={()=>setTheme("system")}><Layout size={22}/><strong>Use device setting</strong><span>Follow Windows / device appearance</span>{theme==="system"&&<Check size={17}/>}</button>
          </div>
        </section>
        <section className="ad-panel">
          <div className="ad-panel-heading"><div><span className="ad-section-kicker">WORKSPACE IDENTITY</span><h2><Palette size={19}/> Accent colour</h2><p>Choose the colour identity for your Admin workspace. This preference is saved on this device.</p></div></div>
          <div className="ad-palette-options" role="group" aria-label="Admin workspace accent colour">
            <button type="button" className={"ad-palette-option palette-green"+(palette==="green"?" selected":"")} aria-pressed={palette==="green"} onClick={()=>setPalette("green")}><span className="ad-palette-swatch" aria-hidden="true"/><strong>Academic green</strong><small>Calm and familiar</small>{palette==="green"&&<Check size={17}/>}</button>
            <button type="button" className={"ad-palette-option palette-blue"+(palette==="blue"?" selected":"")} aria-pressed={palette==="blue"} onClick={()=>setPalette("blue")}><span className="ad-palette-swatch" aria-hidden="true"/><strong>Professional blue</strong><small>Clear and confident</small>{palette==="blue"&&<Check size={17}/>}</button>
            <button type="button" className={"ad-palette-option palette-yellow"+(palette==="yellow"?" selected":"")} aria-pressed={palette==="yellow"} onClick={()=>setPalette("yellow")}><span className="ad-palette-swatch" aria-hidden="true"/><strong>Warm yellow</strong><small>Bright and focused</small>{palette==="yellow"&&<Check size={17}/>}</button>
          </div>
        </section>
        <section className="ad-panel">
          <div className="ad-panel-heading"><div><span className="ad-section-kicker">READABILITY</span><h2><Type size={19}/> Font and layout</h2><p>Adjust typography and page density to your preference.</p></div></div>
          <div className="ad-settings-grid">
            <label className="ad-setting-control"><span>Font family</span><select value={font} onChange={e=>setFont(e.target.value as FontChoice)}><option value="system">System default</option><option value="inter">Inter</option><option value="roboto">Roboto</option><option value="lato">Lato</option><option value="poppins">Poppins</option><option value="nunito">Nunito</option><option value="opensans">Open Sans</option><option value="montserrat">Montserrat</option><option value="dm-sans">DM Sans</option><option value="manrope">Manrope</option><option value="source-sans">Source Sans 3</option><option value="raleway">Raleway</option><option value="ubuntu">Ubuntu</option><option value="georgia">Georgia / serif</option><option value="times">Times New Roman</option><option value="verdana">Verdana</option><option value="tahoma">Tahoma</option><option value="trebuchet">Trebuchet MS</option><option value="mono">Monospace</option></select><small>Applies across Admin workspace pages.</small></label>
            <label className="ad-setting-control"><span>Text size</span><select value={fontSize} onChange={e=>setFontSize(e.target.value)}><option value="xs">Extra small</option><option value="small">Small</option><option value="normal">Default</option><option value="large">Large</option><option value="xlarge">Extra large</option><option value="xxlarge">XXL / Very large</option></select><small>Changes general workspace text size.</small></label>
          </div>
          <label className="ad-setting-toggle"><span><Layout size={18}/><span><strong>Compact layout</strong><small>Reduce spacing so more content fits on screen.</small></span></span><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/></label>
          <label className="ad-setting-toggle"><span><Palette size={18}/><span><strong>Reduce animations</strong><small>Limit decorative movement and transitions.</small></span></span><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/></label>
          {saved&&<p className="ad-settings-saved" role="status"><Check size={15}/> Preferences saved automatically.</p>}
        </section>
        <section className="ad-panel">
          <div className="ad-panel-heading"><div><span className="ad-section-kicker">ACCOUNT AND SECURITY</span><h2><ShieldCheck size={19}/> Account actions</h2><p>Manage your account without changing your assigned academic permissions.</p></div></div>
          <div className="ad-settings-actions"><Link className="ad-secondary-button" to="/admin/profile"><UserRound size={15}/> View profile</Link><Link className="ad-secondary-button" to="/admin/change-password"><ShieldCheck size={15}/> Change password</Link><Link className="ad-secondary-button" to="/admin/notifications"><Bell size={15}/> Notifications</Link><button className="ad-danger-button" type="button" onClick={signOut}><LogOut size={15}/> Sign out</button></div>
          <p className="ad-settings-note">Your institution, program and department assignment can only be changed by Super Admin.</p>
        </section>
      </div>
    </section>
  </main></> ;
}
