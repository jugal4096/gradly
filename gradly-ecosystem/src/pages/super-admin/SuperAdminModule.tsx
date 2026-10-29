import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity, ArrowLeft, ArrowUpRight, BookOpen, Building2, Check, ClipboardList,
  FileText, LockKeyhole, Megaphone, MessageSquare, Moon, RefreshCw, Search,
  Settings, ShieldAlert, ShieldCheck, Sun, Users
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import "../../styles/super-admin-modules.css";

type Row = Record<string, unknown>;
type ModuleInfo = {
  title: string; eyebrow: string; description: string; icon: typeof Building2;
  scope: string; capabilities: string[]; route: string; apiKey?: string;
};

const modules: Record<string, ModuleInfo> = {
  institutions: { title: "Institution Management", eyebrow: "ACADEMIC GOVERNANCE", description: "View the institutions registered in Gradly and their connected academic structure.", icon: Building2, scope: "Global institution registry", capabilities: ["Institution directory", "Programs and branches", "Institution onboarding", "Institution-admin assignments"], route: "/super-admin/institutions", apiKey: "institutions" },
  curriculum: { title: "Curriculum & Courses", eyebrow: "ACADEMIC GOVERNANCE", description: "Review curriculum-change requests currently stored in the academic system.", icon: BookOpen, scope: "Cross-institution curriculum", capabilities: ["Curriculum change requests", "Request status and timestamps", "Institution and branch references", "Request follow-up"], route: "/super-admin/curriculum", apiKey: "curriculum" },
  audit: { title: "Audit Logs", eyebrow: "SECURITY & COMPLIANCE", description: "Search recent administrative events recorded by the backend audit trail.", icon: Activity, scope: "Platform-wide event trail", capabilities: ["Actor and action history", "Timestamped events", "Affected entity tracking", "Searchable event records"], route: "/super-admin/audit", apiKey: "audit" },
  feedback: { title: "Feedback & Support", eyebrow: "SERVICE OPERATIONS", description: "View feedback requests that have been persisted by the current backend.", icon: MessageSquare, scope: "Feedback requests", capabilities: ["Feedback request list", "Current status", "Creation and update timestamps", "Search and triage"], route: "/super-admin/feedback", apiKey: "feedback" },
  settings: { title: "System Settings", eyebrow: "PLATFORM CONFIGURATION", description: "Global configuration requires a persisted settings API before values can safely be changed.", icon: Settings, scope: "Global configuration", capabilities: ["Platform defaults", "Session and access policies", "Notification preferences", "Configuration history"], route: "/super-admin/settings" },
  safety: { title: "Security Alarm", eyebrow: "TRUST & PROTECTION", description: "Review security-related records and alerts exposed by the connected backend. Sensitive response actions require audited server-side policy.", icon: ShieldAlert, scope: "Platform-wide safeguards", capabilities: ["Security event review", "Account restrictions", "Suspicious activity triage", "Audited action history"], route: "/super-admin/safety" },
  announcements: { title: "Super Admin Announcements for Admins", eyebrow: "PLATFORM COMMUNICATIONS", description: "Central announcements intended for institution administrators. Publishing requires a persistent announcement store and an audience-delivery API.", icon: Megaphone, scope: "Targeted ecosystem notices", capabilities: ["Draft and publish", "Audience targeting", "Scheduling", "Publication history"], route: "/super-admin/announcements" },
  "password-resets": { title: "Password Requests", eyebrow: "ACCOUNT SUPPORT", description: "Review password-reset requests when a verified recovery-request API is connected. Identity verification and audited resolution are required before account recovery actions can be enabled.", icon: LockKeyhole, scope: "Eligible user accounts", capabilities: ["Pending recovery requests", "Identity verification", "Decision with reason", "Resolution history"], route: "/super-admin/password-resets" },
  requests: { title: "Request Centre", eyebrow: "OPERATIONS", description: "A unified queue requires a normalized API across the existing application and curriculum workflows.", icon: ClipboardList, scope: "Cross-module requests", capabilities: ["Institution requests", "Curriculum changes", "Admin applications", "Account and support requests"], route: "/super-admin/requests" }
};

const quickLinks = [
  { label: "Dashboard", to: "/super-admin", icon: ArrowUpRight },
  { label: "Institutions", to: "/super-admin/institutions", icon: Building2 },
  { label: "Curriculum", to: "/super-admin/curriculum", icon: BookOpen },
  { label: "Audit logs", to: "/super-admin/audit", icon: FileText },
  { label: "Users & guests", to: "/super-admin/users", icon: Users },
  { label: "Administrators", to: "/super-admin/admins", icon: ShieldCheck },
  { label: "Applications", to: "/super-admin/applications", icon: ClipboardList },
  { label: "Feedback", to: "/super-admin/feedback", icon: MessageSquare },
  { label: "Announcements", to: "/super-admin/announcements", icon: Megaphone },
  { label: "Safety", to: "/super-admin/safety", icon: ShieldAlert },
  { label: "Password resets", to: "/super-admin/password-resets", icon: LockKeyhole },
  { label: "Settings", to: "/super-admin/settings", icon: Settings }
];

function readable(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  const raw = String(value);
  if (/created_at|updated_at/i.test(raw)) return raw;
  return raw;
}
function labelFor(key: string): string {
  return key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (m) => m.toUpperCase());
}
function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (/(created_at|updated_at|reviewed_at)$/i.test(key)) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }
  return readable(value);
}

export default function SuperAdminModule() {
  const location = useLocation();
  const navigate = useNavigate();
  const key = location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const info = modules[key] ?? modules.requests;
  const Icon = info.icon;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("gradly_super_admin_theme") === "dark" ? "dark" : "light");

  function chooseTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    localStorage.setItem("gradly_super_admin_theme", nextTheme);
    window.dispatchEvent(new CustomEvent("gradly-super-admin-theme-change", { detail: nextTheme }));
  }

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!info.apiKey) { setRows([]); setLoading(false); setError(""); return; }
    setLoading(true);
    setError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Sign in again.");
      const params = new URLSearchParams({ limit: "100" });
      if (submittedSearch.trim()) params.set("search", submittedSearch.trim());
      const response = await fetch(`${API_BASE_URL}/api/super-admin/workspace/${info.apiKey}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal
      });
      const result = await response.json().catch(() => null) as { data?: Row[]; message?: string; count?: number } | null;
      if (response.status === 401) {
        localStorage.removeItem("gradly_super_admin_token");
        navigate("/super-admin/login", { replace: true });
        throw new Error("Your session expired. Sign in again.");
      }
      if (!response.ok) throw new Error(result?.message || `Unable to load workspace data (HTTP ${response.status}).`);
      if (!Array.isArray(result?.data)) throw new Error("The API response did not contain a valid data list.");
      setRows(result.data);
      setLoadedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setRows([]);
      setError(caught instanceof Error ? caught.message : "Unable to load workspace data.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [info.apiKey, navigate, submittedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search);
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];
  const live = Boolean(info.apiKey);

  if (key === "settings") {
    return (
      <main className="sam-page sam-settings-page">
        <header className="sam-header">
          <div>
            <span className="sam-eyebrow">PERSONALIZATION</span>
            <h1>Settings</h1>
            <p>Make the Gradly Super Admin workspace comfortable for you. Your appearance preference is saved in this browser and applies across the admin sections.</p>
          </div>
          <div className="sam-header-icon"><Settings size={27} /></div>
        </header>
        <section className="sam-settings-card" aria-labelledby="appearance-heading">
          <div className="sam-settings-section-icon"><Sun size={20} /></div>
          <div className="sam-settings-copy">
            <span className="sam-eyebrow">DISPLAY & ACCESSIBILITY</span>
            <h2 id="appearance-heading">Appearance</h2>
            <p>Choose a white workspace or a dark midnight workspace. White mode is the default for new browsers.</p>
            <div className="sam-theme-options" role="group" aria-label="Choose appearance theme">
              <button type="button" className={`sam-theme-option ${theme === "light" ? "is-selected" : ""}`} aria-pressed={theme === "light"} onClick={() => chooseTheme("light")}>
                <span className="sam-theme-preview sam-theme-preview-light"><Sun size={22} /><span /><span /></span>
                <span className="sam-theme-option-text"><strong>White mode</strong><small>Bright, clean and easy to read</small></span>
                {theme === "light" && <Check className="sam-theme-check" size={18} />}
              </button>
              <button type="button" className={`sam-theme-option ${theme === "dark" ? "is-selected" : ""}`} aria-pressed={theme === "dark"} onClick={() => chooseTheme("dark")}>
                <span className="sam-theme-preview sam-theme-preview-dark"><Moon size={22} /><span /><span /></span>
                <span className="sam-theme-option-text"><strong>Dark mode</strong><small>Low-glare midnight purple surfaces</small></span>
                {theme === "dark" && <Check className="sam-theme-check" size={18} />}
              </button>
            </div>
            <p className="sam-settings-saved"><Check size={14} /> Preference saves automatically on this browser.</p>
          </div>
        </section>
        <footer className="sam-footer"><span><LockKeyhole size={14} /> Protected Super Admin workspace</span><span>Gradly Ecosystem · Settings</span></footer>
      </main>
    );
  }

  return (
    <main className="sam-page">
      <header className="sam-header">
        <div>
          <Link className="sam-back" to="/super-admin"><ArrowLeft size={15} /> Back to command centre</Link>
          <span className="sam-eyebrow">{info.eyebrow}</span>
          <h1>{info.title}</h1>
          <p>{info.description}</p>
        </div>
        <div className="sam-header-icon"><Icon size={27} /></div>
      </header>

      {live ? (
        <section className="sam-data-panel">
          <div className="sam-data-toolbar">
            <div>
              <span className="sam-eyebrow">LIVE DATABASE VIEW</span>
              <h2>{rows.length} {rows.length === 1 ? "record" : "records"} returned</h2>
              <p>{loadedAt ? `Last refreshed at ${loadedAt}` : "Read-only view from the authenticated Gradly API."}</p>
            </div>
            <button type="button" className="sam-refresh" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={15} className={loading ? "sam-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <form className="sam-search" onSubmit={submitSearch}>
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={key === "audit" ? "Search action, actor or entity…" : "Search records…"} aria-label="Search records" />
            <button type="submit">Search</button>
          </form>
          {error && <div className="sam-error" role="alert"><strong>Could not load live data</strong><span>{error}</span><button type="button" onClick={() => void loadData()}>Try again</button></div>}
          {!error && loading && <div className="sam-empty"><RefreshCw size={18} className="sam-spin" /> Fetching authorized records…</div>}
          {!error && !loading && rows.length === 0 && <div className="sam-empty"><FileText size={22} /><strong>No matching records</strong><span>The API returned no records for this view. Try another search or refresh.</span></div>}
          {!error && !loading && rows.length > 0 && (
            <div className="sam-table-wrap"><table className="sam-table"><thead><tr>{columns.map((column) => <th key={column}>{labelFor(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column} title={readable(row[column])}>{formatCell(column, row[column])}</td>)}</tr>)}</tbody></table></div>
          )}
          <p className="sam-readonly-note"><ShieldCheck size={14} /> Authenticated, read-only view. No data is fabricated and no destructive action is exposed here.</p>
        </section>
      ) : (
        <section className="sam-status-card" aria-live="polite">
          <div className="sam-status-icon"><ShieldAlert size={20} /></div>
          <div className="sam-status-copy">
            <strong>Backend workflow integration required</strong>
            <p>This module does not yet have a verified persistent API. Controls that could alter accounts, settings or announcements are intentionally disabled rather than pretending an action succeeded.</p>
            <span>Not connected to a live data source</span>
          </div>
          <span className="sam-status-pill">Integration required</span>
        </section>
      )}

      <section className="sam-overview">
        <div className="sam-section-heading"><div><span>MODULE SCOPE</span><h2>What belongs here</h2></div><span className="sam-scope"><ShieldCheck size={14} /> {info.scope}</span></div>
        <div className="sam-capability-grid">{info.capabilities.map((item, index) => <article className="sam-capability" key={item}><span className="sam-capability-number">{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><span>{live ? "Read-only API connected" : "Requires persisted API support"}</span></article>)}</div>
      </section>

      <section className="sam-navigation">
        <div className="sam-section-heading"><div><span>WORKSPACE</span><h2>Go to another section</h2></div></div>
        <div className="sam-link-grid">{quickLinks.filter((link) => link.to !== info.route).map((link) => { const LinkIcon = link.icon; return <Link className="sam-workspace-link" to={link.to} key={link.to}><span><LinkIcon size={17} /></span><strong>{link.label}</strong><ArrowUpRight size={15} /></Link>; })}</div>
      </section>
      <footer className="sam-footer"><span><LockKeyhole size={14} /> Protected Super Admin workspace</span><span>Gradly Ecosystem · Administration</span></footer>
    </main>
  );
}
