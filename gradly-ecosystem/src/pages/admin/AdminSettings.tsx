import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Moon, Sun, ShieldCheck, UserRound, Bell, Palette } from "lucide-react";
import "./AdminDashboard.css";

export default function AdminSettings() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("gradly_admin_theme") === "dark" ? "dark" : "light"));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    localStorage.setItem("gradly_admin_theme", theme);
  }, [theme]);
  const toggleTheme = (next: "light" | "dark") => { setTheme(next); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  return <main className="admin-dashboard" data-theme={theme}>
    <aside className="ad-sidebar">
      <Link to="/admin/dashboard" className="ad-brand"><span className="ad-brand-mark">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></Link>
      <p className="ad-sidebar-label">PREFERENCES</p>
      <nav className="ad-sidebar-nav">
        <Link to="/admin/profile" className="ad-nav-link"><UserRound size={17}/> My profile</Link>
        <Link to="/admin/notifications" className="ad-nav-link"><Bell size={17}/> Notifications</Link>
        <Link to="/admin/change-password" className="ad-nav-link"><ShieldCheck size={17}/> Account security</Link>
      </nav>
      <div className="ad-sidebar-bottom"><Link to="/admin/dashboard" className="ad-nav-link"><ArrowLeft size={16}/> Back to workspace</Link></div>
    </aside>
    <section className="ad-main-column"><header className="ad-topbar"><div className="ad-breadcrumb"><Link to="/admin/dashboard">Admin workspace</Link><span>/</span><strong>Settings</strong></div></header>
      <div className="ad-content"><section className="ad-page-heading"><div><span className="ad-section-kicker">PREFERENCES</span><h1>Settings</h1><p>Customize how your Admin workspace looks and works.</p></div></section>
        <section className="ad-panel"><div className="ad-panel-heading"><div><span className="ad-section-kicker">APPEARANCE</span><h2><Palette size={20}/> Theme</h2><p>Choose a theme for this browser. Your preference is saved locally on this device.</p></div></div>
          <div className="ad-theme-options">
            <button type="button" className={"ad-theme-option"+(theme==="light"?" selected":"")} aria-pressed={theme==="light"} onClick={()=>toggleTheme("light")}><Sun size={22}/><strong>Light mode</strong><span>Clean, bright workspace</span>{theme==="light"&&<Check size={17}/>}</button>
            <button type="button" className={"ad-theme-option"+(theme==="dark"?" selected":"")} aria-pressed={theme==="dark"} onClick={()=>toggleTheme("dark")}><Moon size={22}/><strong>Dark mode</strong><span>Comfortable low-light view</span>{theme==="dark"&&<Check size={17}/>}</button>
          </div>{saved&&<p className="ad-success" role="status"><Check size={16}/> Appearance saved.</p>}
        </section>
        <section className="ad-panel"><div className="ad-panel-heading"><div><span className="ad-section-kicker">ACCOUNT</span><h2><UserRound size={20}/> Profile and security</h2><p>Review your profile and manage account security.</p></div></div><div className="ad-settings-actions"><Link className="ad-secondary-button" to="/admin/profile">View my profile</Link><Link className="ad-secondary-button" to="/admin/change-password">Change password</Link><Link className="ad-secondary-button" to="/admin/notifications">Open notifications</Link></div></section>
      </div>
    </section>
  </main>;
}
