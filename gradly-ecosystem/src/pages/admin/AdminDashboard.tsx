import { useCallback, useEffect, useState } from "react";
import { Activity, BookOpen, Bell, ClipboardList, LogOut, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
type RecordItem = Record<string, unknown>;
type AdminProfile = { full_name?: string; admin_code?: string; institution_name?: string; branch_name?: string; permissions?: string[] };
function countFrom(data: unknown, keys: string[]): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) if (Array.isArray(record[key])) return (record[key] as unknown[]).length;
    if (record.data && Array.isArray(record.data)) return record.data.length;
  }
  return 0;
}
function readableDate(value: unknown) {
  if (typeof value !== "string" || !value) return "Recently";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [curriculumCount, setCurriculumCount] = useState<number | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const logout = () => { localStorage.removeItem("gradly_admin_token"); navigate("/admin/login", { replace: true }); };
  const load = useCallback(async () => {
    const token = localStorage.getItem("gradly_admin_token");
    if (!token) { navigate("/admin/login", { replace: true }); return; }
    setLoading(true); setError("");
    try {
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const endpoints = await Promise.all([
        fetch(`${API_BASE}/admin/me`, { headers }),
        fetch(`${API_BASE}/admin/curriculum`, { headers }),
        fetch(`${API_BASE}/admin/subject-change-requests`, { headers }),
        fetch(`${API_BASE}/admin/workspace-notifications`, { headers }),
      ]);
      if (endpoints[0].status === 401 || endpoints[0].status === 403) { localStorage.removeItem("gradly_admin_token"); navigate("/admin/login", { replace: true }); return; }
      const payloads = await Promise.all(endpoints.map(r => r.json().catch(() => ({}))));
      if (!endpoints[0].ok) throw new Error(payloads[0]?.message || "Unable to verify Admin session.");
      setProfile(payloads[0]?.admin || null);
      setCurriculumCount(endpoints[1].ok ? countFrom(payloads[1], ["curriculum", "curricula", "data", "items"]) : null);
      setRequestCount(endpoints[2].ok ? countFrom(payloads[2], ["requests", "changeRequests", "data", "items"]) : null);
      setNotifications(endpoints[3].ok ? (Array.isArray(payloads[3]?.notifications) ? payloads[3].notifications : Array.isArray(payloads[3]?.data) ? payloads[3].data : []) : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your workspace."); }
    finally { setLoading(false); }
  }, [navigate]);
  useEffect(() => { void load(); }, [load]);

  const name = profile?.full_name?.trim() || "Administrator";
  return <div className="admin-dashboard">
    <aside className="admin-dashboard-sidebar">
      <div className="admin-dashboard-brand"><span className="admin-dashboard-logo">G</span><span><strong>GRADLY</strong><small>ADMIN WORKSPACE</small></span></div>
      <div className="admin-dashboard-side-label">WORKSPACE</div>
      <a className="admin-dashboard-nav active" href="#overview"><Activity size={18}/> Overview</a>
      <a className="admin-dashboard-nav" href="#academic"><BookOpen size={18}/> Academic data</a>
      <a className="admin-dashboard-nav" href="#requests"><ClipboardList size={18}/> Change requests</a>
      <a className="admin-dashboard-nav" href="#notifications"><Bell size={18}/> Notifications</a>
      <div className="admin-dashboard-sidebar-bottom"><div className="admin-dashboard-secure"><ShieldCheck size={17}/><span><strong>Protected access</strong><small>Role-based permissions</small></span></div><button type="button" className="admin-dashboard-logout" onClick={logout}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="admin-dashboard-main" id="overview">
      <header className="admin-dashboard-topbar"><span>Gradly <span className="admin-dashboard-slash">/</span> Admin workspace</span><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> {loading ? "Refreshing…" : "Refresh data"}</button></header>
      <div className="admin-dashboard-content">
        {error && <div className="admin-dashboard-error" role="alert">{error}</div>}
        <section className="admin-dashboard-hero"><div><span className="admin-dashboard-eyebrow">YOUR ACADEMIC WORKSPACE</span><h1>Welcome back, {name.split(" ")[0]}.</h1><p>Keep academic operations organised and requests moving forward.</p><div className="admin-dashboard-identity">{profile?.institution_name || "Assigned institution"}{profile?.branch_name ? ` · ${profile.branch_name}` : ""}{profile?.admin_code ? ` · ${profile.admin_code}` : ""}</div></div><div className="admin-dashboard-hero-icon"><ShieldCheck size={54}/></div></section>
        <section className="admin-dashboard-metrics" aria-label="Workspace summary">
          <article><span className="admin-dashboard-metric-icon"><BookOpen size={20}/></span><span className="admin-dashboard-metric-label">Curriculum items</span><strong>{loading ? "—" : curriculumCount === null ? "Unavailable" : curriculumCount}</strong><small>From your authorized scope</small></article>
          <article><span className="admin-dashboard-metric-icon"><ClipboardList size={20}/></span><span className="admin-dashboard-metric-label">Change requests</span><strong>{loading ? "—" : requestCount === null ? "Unavailable" : requestCount}</strong><small>Requests in your workspace</small></article>
          <article><span className="admin-dashboard-metric-icon"><Bell size={20}/></span><span className="admin-dashboard-metric-label">Notifications</span><strong>{loading ? "—" : notifications.length}</strong><small>Updates available to you</small></article>
        </section>
        <section className="admin-dashboard-panels">
          <article className="admin-dashboard-panel" id="academic"><div className="admin-dashboard-panel-heading"><span className="admin-dashboard-panel-icon"><BookOpen size={20}/></span><div><h2>Academic workspace</h2><p>Review the academic information available to your assigned role.</p></div></div><ul><li>View curriculum and semester information available to your scope.</li><li>Use the request workflow to propose academic corrections.</li><li>Only actions allowed by your backend permissions can be performed.</li></ul><button type="button" onClick={() => document.getElementById("academic")?.scrollIntoView({ behavior: "smooth" })}>Open academic data <span>→</span></button></article>
          <article className="admin-dashboard-panel" id="requests"><div className="admin-dashboard-panel-heading"><span className="admin-dashboard-panel-icon"><ClipboardList size={20}/></span><div><h2>Change requests</h2><p>Propose changes for Super Admin review.</p></div></div><ul><li>Request subject additions, removals or credit corrections.</li><li>Track the status of submitted requests.</li><li>System-wide changes require approval.</li></ul><button type="button" onClick={() => document.getElementById("requests")?.scrollIntoView({ behavior: "smooth" })}>Open requests <span>→</span></button></article>
        </section>
        <section className="admin-dashboard-panel admin-dashboard-notifications" id="notifications"><div className="admin-dashboard-panel-heading"><span className="admin-dashboard-panel-icon"><Bell size={20}/></span><div><h2>Recent notifications</h2><p>Updates returned by the Admin workspace API.</p></div></div>{notifications.length ? <ul className="admin-dashboard-notification-list">{notifications.slice(0,6).map((item,i)=><li key={String(item.id ?? i)}><span className="admin-dashboard-notification-dot"/><div><strong>{String(item.title ?? item.message ?? item.type ?? "Workspace update")}</strong><small>{readableDate(item.created_at ?? item.createdAt)}</small></div></li>)}</ul> : <p className="admin-dashboard-muted">{loading ? "Loading notifications…" : "No notifications are available right now."}</p>}</section>
        <footer className="admin-dashboard-footer"><span>GRADLY ECOSYSTEM</span><span><ShieldCheck size={14}/> Administrator access · Server verified</span></footer>
      </div>
    </main>
  </div>;
}
