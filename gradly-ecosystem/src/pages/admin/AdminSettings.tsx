import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Moon, Sun, ShieldCheck, UserRound, Bell, Palette, Type, LogOut, Layout, RotateCcw } from "lucide-react";
import "./AdminDashboard.css";

type Theme = "light" | "dark";
type FontChoice = "system" | "modern" | "serif";
const getSetting = (key: string, fallback: string) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};

export default function AdminSettings() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => getSetting("gradly_admin_theme", "light") === "dark" ? "dark" : "light");
  const [font, setFont] = useState<FontChoice>(() => (["system","modern","serif"].includes(getSetting("gradly_admin_font","system")) ? getSetting("gradly_admin_font","system") : "system") as FontChoice);
  const [fontSize, setFontSize] = useState(() => getSetting("gradly_admin_font_size","normal"));
  const [compact, setCompact] = useState(() => getSetting("gradly_admin_compact","false") === "true");
  const [reducedMotion, setReducedMotion] = useState(() => getSetting("gradly_admin_reduced_motion","false") === "true");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    document.documentElement.dataset.adminFont = font;
    document.documentElement.dataset.adminFontSize = fontSize;
    document.documentElement.dataset.adminCompact = String(compact);
    document.documentElement.dataset.adminReducedMotion = String(reducedMotion);
    localStorage.setItem("gradly_admin_theme", theme);
    localStorage.setItem("gradly_admin_font", font);
    localStorage.setItem("gradly_admin_font_size", fontSize);
    localStorage.setItem("gradly_admin_compact", String(compact));
    localStorage.setItem("gradly_admin_reduced_motion", String(reducedMotion));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 1500);
    return () => window.clearTimeout(timer);
  }, [theme,font,fontSize,compact,reducedMotion]);

  const signOut = () => {
    if (!window.confirm("Sign out of your Gradly Admin account?")) return;
    localStorage.removeItem("gradly_admin_token");
    navigate("/admin/login", { replace: true });
  };
  const reset = () => {
    setTheme("light"); setFont("system"); setFontSize("normal"); setCompact(false); setReducedMotion(false);
  };

  return <main className="admin-dashboard" data-theme={theme}>
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
          <div className="ad-panel-heading"><div><span className="ad-section-kicker">APPEARANCE</span><h2><Palette size={19}/> Colour theme</h2><p>Choose the appearance that works best for you.</p></div></div>
          <div className="ad-theme-options">
            <button type="button" className={"ad-theme-option"+(theme==="light"?" selected":"")} aria-pressed={theme==="light"} onClick={()=>setTheme("light")}><Sun size={22}/><strong>Light mode</strong><span>Bright and clean</span>{theme==="light"&&<Check size={17}/>}</button>
            <button type="button" className={"ad-theme-option"+(theme==="dark"?" selected":"")} aria-pressed={theme==="dark"} onClick={()=>setTheme("dark")}><Moon size={22}/><strong>Dark mode</strong><span>Gentler in low light</span>{theme==="dark"&&<Check size={17}/>}</button>
          </div>
        </section>
        <section className="ad-panel">
          <div className="ad-panel-heading"><div><span className="ad-section-kicker">READABILITY</span><h2><Type size={19}/> Font and layout</h2><p>Adjust typography and page density to your preference.</p></div></div>
          <div className="ad-settings-grid">
            <label className="ad-setting-control"><span>Font family</span><select value={font} onChange={e=>setFont(e.target.value as FontChoice)}><option value="system">System default</option><option value="modern">Modern (DM Sans)</option><option value="serif">Classic (Georgia)</option></select><small>Applies across Admin workspace pages.</small></label>
            <label className="ad-setting-control"><span>Text size</span><select value={fontSize} onChange={e=>setFontSize(e.target.value)}><option value="small">Small</option><option value="normal">Default</option><option value="large">Large</option></select><small>Changes general workspace text size.</small></label>
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
  </main>;
}
