import { useCallback, useEffect, useState } from "react";
import { Activity, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams } from "react-router-dom";
import "./SuperAdminAudit.css";

type AuditEvent = {
  id: string | number; actor_id: string | null; actor_role: string | null; action: string;
  entity_table: string | null; entity_id: string | null; before_data: unknown; after_data: unknown;
  metadata: unknown; created_at: string; administrator_name: string | null; admin_code: string | null;
  branch_name: string | null; institution_name: string | null;
};
const apiRoot = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); };
const pretty = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const jsonText = (value: unknown) => { if (value == null) return "—"; try { return JSON.stringify(value, null, 2); } catch { return String(value); } };

export default function SuperAdminAudit() {
  const { adminId: routeAdminId } = useParams();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [adminId, setAdminId] = useState(() => routeAdminId || new URLSearchParams(window.location.search).get("adminId") || "");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const pageSize = routeAdminId ? 200 : 50;
  const isAdminDetail = Boolean(routeAdminId);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Super Admin session missing. Sign in again.");
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
      if (search.trim()) params.set("search", search.trim());
      if (adminId.trim()) params.set("adminId", adminId.trim());
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`${apiRoot}/super-admin/audit/admin-activity?${params}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Access denied. Sign in again." : "Could not load administrator audit events.");
      const data = await response.json();
      setEvents(Array.isArray(data.events) ? data.events : []); setTotal(Number(data.total) || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load audit events."); }
    finally { setLoading(false); }
  }, [search, action, from, to, page, adminId, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) return;
    fetch(`${apiRoot}/super-admin/audit/admin-actions`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { actions: [] }).then((d) => setActions(Array.isArray(d.actions) ? d.actions : [])).catch(() => setActions([]));
  }, []);

  return <section className="admin-audit-page">
    <header className="admin-audit-header"><div><span className="admin-audit-kicker">SECURITY / OVERSIGHT</span><h1>{isAdminDetail ? "Administrator activity" : "Admin Activity &amp; Audit Logs"}</h1><p>{isAdminDetail ? "A visual view of recorded activity, access events and recent administrator actions." : "Review recorded administrator actions, decisions, and changes across Gradly."}</p></div><div className="admin-audit-header-actions">{isAdminDetail && <button type="button" onClick={() => window.history.back()}>Back to admins</button>}<button type="button" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div></header>
    <div className="admin-audit-stats"><article><span>{isAdminDetail ? "Total recorded activity" : "Matching events"}</span><strong>{total.toLocaleString()}</strong><small>Across the selected audit scope</small></article><article><span>Events loaded</span><strong>{events.length}</strong><small>Available for this view</small></article><article><span>Distinct action types</span><strong>{new Set(events.map(event => event.action)).size}</strong><small>Unique recorded actions</small></article></div>
    {isAdminDetail && <div className="admin-activity-analytics">
      <section className="admin-activity-chart-card"><div className="admin-activity-card-heading"><div><span className="admin-audit-kicker">ACTIVITY OVER TIME</span><h2>Last 7 days</h2><p>Recorded actions grouped by day</p></div><strong>{events.length} events</strong></div>
        {(() => { const days = Array.from({length:7},(_,index)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-index));const key=d.toLocaleDateString("en-CA");return {key,label:d.toLocaleDateString("en-IN",{weekday:"short"}),count:events.filter(event=>new Date(event.created_at).toLocaleDateString("en-CA")===key).length};}); const max=Math.max(1,...days.map(day=>day.count)); return <div className="admin-activity-bars">{days.map(day=><div className="admin-activity-bar-column" key={day.key}><strong>{day.count}</strong><div className="admin-activity-bar-track"><span style={{height:Math.max(5,day.count/max*100)+"%"}}/></div><small>{day.label}</small></div>)}</div>; })()}
      </section>
      <section className="admin-activity-breakdown"><div className="admin-audit-card-heading"><div><span className="admin-audit-kicker">ACTION MIX</span><h2>Most frequent actions</h2><p>Based on the events currently loaded</p></div></div>
        {(() => {const groups=events.reduce<Record<string,number>>((acc,event)=>{acc[event.action]=(acc[event.action]||0)+1;return acc;},{});const rows=Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,6);const max=Math.max(1,...rows.map(row=>row[1]));return rows.length?rows.map(([name,count])=><div className="admin-activity-action-row" key={name}><div><span>{pretty(name)}</span><strong>{count}</strong></div><div className="admin-activity-action-track"><i style={{width:(count/max*100)+"%"}}/></div></div>):<p className="admin-activity-no-data">No recorded actions available for this administrator yet.</p>;})()}
      </section>
    </div>}
    <div className="admin-audit-filters">{adminId && <div className="admin-audit-admin-filter">Filtered to administrator ID: <strong>{adminId}</strong><button type="button" onClick={() => { setAdminId(""); window.history.replaceState({}, "", window.location.pathname); setPage(0); }}>Clear filter</button></div>}<label className="admin-audit-search"><Search size={16}/><input value={search} onChange={(e) => {setSearch(e.target.value);setPage(0);}} placeholder="Search action, request ID, record or metadata"/></label><label>Action<select value={action} onChange={(e) => {setAction(e.target.value);setPage(0);}}><option value="">All actions</option>{actions.map((a) => <option key={a} value={a}>{pretty(a)}</option>)}</select></label><label>From<input type="date" value={from} onChange={(e) => {setFrom(e.target.value);setPage(0);}}/></label><label>To<input type="date" value={to} onChange={(e) => {setTo(e.target.value);setPage(0);}}/></label></div>
    {error && <div className="admin-audit-error">{error}</div>}
    <div className="admin-audit-table-wrap"><table className="admin-audit-table"><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Target</th><th>Department</th><th>Details</th></tr></thead><tbody>
      {!loading && !error && events.length === 0 && <tr><td colSpan={6} className="admin-audit-empty">No recorded administrator events match these filters.</td></tr>}
      {events.map((event) => <tr key={String(event.id)}><td className="admin-audit-time">{formatDate(event.created_at)}</td><td><strong>{event.administrator_name || "Unresolved administrator"}</strong><small>{event.admin_code || event.actor_id || "No actor ID"}</small></td><td><span className="admin-audit-action"><Activity size={13}/>{pretty(event.action)}</span><small>{event.actor_role || "Role not recorded"}</small></td><td><strong>{event.entity_table || "System"}</strong><small>{event.entity_id || "No record ID"}</small></td><td>{event.branch_name || "—"}<small>{event.institution_name || ""}</small></td><td><button className="admin-audit-details" type="button" onClick={() => setSelected(event)}>Inspect event</button></td></tr>)}
    </tbody></table>{loading && <div className="admin-audit-empty">Loading audit history…</div>}</div>
    <footer className="admin-audit-pagination"><span>Showing {total ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize,total)} of {total}</span><div><button disabled={page===0} onClick={() => setPage((p)=>Math.max(0,p-1))}><ChevronLeft size={16}/> Previous</button><button disabled={(page+1)*pageSize>=total} onClick={() => setPage((p)=>p+1)}>Next <ChevronRight size={16}/></button></div></footer>
    {selected && <div className="admin-audit-overlay" onClick={() => setSelected(null)}><section className="admin-audit-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-audit-drawer-title" onClick={(e)=>e.stopPropagation()}><header><div><span className="admin-audit-kicker">AUDIT EVENT</span><h2 id="admin-audit-drawer-title">{pretty(selected.action)}</h2><p>{formatDate(selected.created_at)}</p></div><button onClick={()=>setSelected(null)}>Close</button></header><dl><div><dt>Administrator</dt><dd>{selected.administrator_name || "Unresolved"} ({selected.admin_code || selected.actor_id || "unknown"})</dd></div><div><dt>Actor role / type</dt><dd>{selected.actor_role || "—"}</dd></div><div><dt>Target</dt><dd>{selected.entity_table || "System"} / {selected.entity_id || "—"}</dd></div><div><dt>Branch / Institution</dt><dd>{selected.branch_name || "—"} / {selected.institution_name || "—"}</dd></div><div><dt>Before</dt><dd><pre>{jsonText(selected.before_data)}</pre></dd></div><div><dt>After</dt><dd><pre>{jsonText(selected.after_data)}</pre></dd></div><div><dt>Metadata</dt><dd><pre>{jsonText(selected.metadata)}</pre></dd></div></dl></section></div>}
  </section>;
}
