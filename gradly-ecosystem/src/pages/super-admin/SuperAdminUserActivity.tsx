import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Clock3, RefreshCw, ShieldCheck, UserRound, Users } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, getToken } from "../../lib/superAdminSession";
import "../../styles/super-admin-dashboard.css";

type Row = Record<string, unknown>;
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
function date(value: unknown): string {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? display(value) : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
const hiddenKeys = new Set(["password", "password_hash", "passwordHash", "token", "access_token", "refresh_token", "secret"]);
function fieldsOf(record: Row): [string, unknown][] {
  return Object.entries(record).filter(([key, value]) => !hiddenKeys.has(key) && value !== undefined && typeof value !== "function");
}
export default function SuperAdminUserActivity() {
  const { userId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as { account?: Row; accountType?: "students" | "guests" };
  const accountType = state.accountType ?? "students";
  const [account, setAccount] = useState<Row>(state.account ?? {});
  const [events, setEvents] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const token = getToken();
        if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
        const headers = { Accept: "application/json", Authorization: "Bearer " + token };
        const activityPath = accountType === "students"
          ? "/api/super-admin/users/" + encodeURIComponent(userId) + "/activity"
          : "/api/super-admin/users/guests/" + encodeURIComponent(userId) + "/activity";
        const tasks: Promise<Response>[] = [fetch(API_BASE_URL + activityPath, { headers })];
        if (accountType === "students") tasks.push(fetch(API_BASE_URL + "/api/super-admin/users/" + encodeURIComponent(userId), { headers }));
        const responses = await Promise.all(tasks);
        const activityData = await responses[0].json().catch(() => ({}));
        if (!responses[0].ok) throw new Error(activityData.message || "Could not load activity history.");
        const rawEvents = activityData.events ?? activityData.activity ?? activityData.logs ?? [];
        if (alive) setEvents(Array.isArray(rawEvents) ? rawEvents : []);
        if (accountType === "students" && responses[1]) {
          const detailData = await responses[1].json().catch(() => ({}));
          if (responses[1].ok && alive) setAccount(previous => ({ ...previous, ...(detailData.student ?? detailData.user ?? detailData.data ?? detailData) }));
          else if (!responses[1].ok && alive) setError(detailData.message || "Activity loaded, but the full student profile could not be retrieved.");
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load this account's activity.");
      } finally { if (alive) setLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [userId, accountType]);

  const profileFields = useMemo(() => fieldsOf(account), [account]);
  const title = display(account.display_name ?? account.name ?? account.college_name ?? account.guest_id ?? userId);
  return <main className="super-dashboard sa-activity-page">
    <header className="sd-header">
      <div className="sd-header-copy">
        <div className="sd-eyebrow"><span className="sd-eyebrow-dot"/> GRADLY <span className="sd-slash">/</span> ACCOUNT AUDIT</div>
        <h1>Account activity</h1>
        <p>Full available account details and activity history for this {accountType === "students" ? "student" : "guest session"}.</p>
      </div>
      <button className="sd-refresh-button" type="button" onClick={() => navigate("/super-admin/users")}><ArrowLeft size={15}/> Back to users</button>
    </header>
    <section className="sua-profile">
      <div className="sua-avatar">{accountType === "students" ? <UserRound size={25}/> : <Users size={25}/>}</div>
      <div className="sua-profile-main"><span>{accountType === "students" ? "STUDENT ACCOUNT" : "GUEST SESSION"}</span><h2>{title}</h2><p>{display(account.email)} · ID: {userId}</p></div>
      <div className={"sua-status " + (account.active === false ? "inactive" : "active")}>{account.active === false ? "Inactive / Suspended" : "Account record"}</div>
    </section>
    {error && <div className="sd-error" role="alert"><ShieldCheck size={18}/><div className="sd-error-copy"><strong>Some information could not be loaded</strong><p>{error}</p></div></div>}
    <section className="sua-section">
      <div className="sua-section-heading"><div><span>ACCOUNT RECORD</span><h2>All available details</h2></div><span>{profileFields.length} fields</span></div>
      {profileFields.length ? <div className="sua-detail-grid">{profileFields.map(([key,value])=><div className="sua-detail-item" key={key}><span>{key.replace(/([A-Z])/g," $1").replace(/[_-]+/g," ").replace(/^./,s=>s.toUpperCase())}</span><strong>{display(value)}</strong></div>)}</div> : <p className="sua-empty">No account details were passed to this page.</p>}
    </section>
    <section className="sua-section">
      <div className="sua-section-heading"><div><span>AUDIT TRAIL</span><h2><Activity size={18}/> Activity history</h2></div><span>{loading ? "Loading…" : events.length + " events"}</span></div>
      {loading ? <div className="sua-empty"><RefreshCw size={18} className="sd-spin"/> Loading account and activity records…</div> : events.length ? <div className="sua-timeline">{events.map((event,index)=><article className="sua-event" key={display(event.id ?? event.created_at ?? event.timestamp ?? index)}><div className="sua-event-icon"><Activity size={16}/></div><div className="sua-event-body"><h3>{display(event.action ?? event.event_type ?? event.title ?? event.event ?? "Activity event")}</h3><p>{display(event.description ?? event.details ?? event.entity_table ?? event.type)}</p><div className="sua-event-meta"><Clock3 size={13}/>{date(event.created_at ?? event.createdAt ?? event.timestamp ?? event.occurred_at)}</div><details><summary>View complete event data</summary><pre>{JSON.stringify(event,null,2)}</pre></details></div></article>)}</div> : <div className="sua-empty"><Activity size={22}/><strong>No activity events returned</strong><span>The activity endpoint returned no events for this account.</span></div>}
    </section>
    <footer className="sc-foot"><ShieldCheck size={14}/> Protected Super Admin view · Sensitive authentication secrets are excluded from account details</footer>
  </main>;
}
