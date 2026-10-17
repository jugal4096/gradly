import { useCallback, useEffect, useState } from "react";
import { Activity, Search, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
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
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Super Admin session missing. Sign in again.");
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
      if (search.trim()) params.set("search", search.trim());
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`${apiRoot}/super-admin/audit/admin-activity?${params}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Access denied. Sign in again." : "Could not load administrator audit events.");
      const data = await response.json();
      setEvents(Array.isArray(data.events) ? data.events : []); setTotal(Number(data.total) || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load audit events."); }
    finally { setLoading(false); }
  }, [search, action, from, to, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) return;
    fetch(`${apiRoot}/super-admin/audit/admin-actions`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { actions: [] }).then((d) => setActions(Array.isArray(d.actions) ? d.actions : [])).catch(() => setActions([]));
  }, []);

  return <section className="admin-audit-page">
    <header className="admin-audit-header"><div><span className="admin-audit-kicker">SECURITY / OVERSIGHT</span><h1>Admin Activity &amp; Audit Logs</h1><p>Review recorded administrator actions, decisions, and changes across Gradly.</p></div><button type="button" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></header>
    <div className="admin-audit-stats"><article><span>Matching events</span><strong>{total.toLocaleString()}</strong></article><article><span>Events on this page</span><strong>{events.length}</strong></article><article><span>Page</span><strong>{page + 1}</strong></article></div>
    <div className="admin-audit-filters"><label className="admin-audit-search"><Search size={16}/><input value={search} onChange={(e) => {setSearch(e.target.value);setPage(0);}} placeholder="Search action, request ID, record or metadata"/></label><label>Action<select value={action} onChange={(e) => {setAction(e.target.value);setPage(0);}}><option value="">All actions</option>{actions.map((a) => <option key={a} value={a}>{pretty(a)}</option>)}</select></label><label>From<input type="date" value={from} onChange={(e) => {setFrom(e.target.value);setPage(0);}}/></label><label>To<input type="date" value={to} onChange={(e) => {setTo(e.target.value);setPage(0);}}/></label></div>
    {error && <div className="admin-audit-error">{error}</div>}
    <div className="admin-audit-table-wrap"><table className="admin-audit-table"><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Target</th><th>Department</th><th>Details</th></tr></thead><tbody>
      {!loading && !error && events.length === 0 && <tr><td colSpan={6} className="admin-audit-empty">No recorded administrator events match these filters.</td></tr>}
      {events.map((event) => <tr key={String(event.id)}><td className="admin-audit-time">{formatDate(event.created_at)}</td><td><strong>{event.administrator_name || "Unresolved administrator"}</strong><small>{event.admin_code || event.actor_id || "No actor ID"}</small></td><td><span className="admin-audit-action"><Activity size={13}/>{pretty(event.action)}</span><small>{event.actor_role || "Role not recorded"}</small></td><td><strong>{event.entity_table || "System"}</strong><small>{event.entity_id || "No record ID"}</small></td><td>{event.branch_name || "—"}<small>{event.institution_name || ""}</small></td><td><button className="admin-audit-details" type="button" onClick={() => setSelected(event)}>Inspect event</button></td></tr>)}
    </tbody></table>{loading && <div className="admin-audit-empty">Loading audit history…</div>}</div>
    <footer className="admin-audit-pagination"><span>Showing {total ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize,total)} of {total}</span><div><button disabled={page===0} onClick={() => setPage((p)=>Math.max(0,p-1))}><ChevronLeft size={16}/> Previous</button><button disabled={(page+1)*pageSize>=total} onClick={() => setPage((p)=>p+1)}>Next <ChevronRight size={16}/></button></div></footer>
    {selected && <div className="admin-audit-overlay" onClick={() => setSelected(null)}><section className="admin-audit-drawer" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}><header><div><span className="admin-audit-kicker">AUDIT EVENT</span><h2>{pretty(selected.action)}</h2><p>{formatDate(selected.created_at)}</p></div><button onClick={()=>setSelected(null)}>Close</button></header><dl><div><dt>Administrator</dt><dd>{selected.administrator_name || "Unresolved"} ({selected.admin_code || selected.actor_id || "unknown"})</dd></div><div><dt>Actor role / type</dt><dd>{selected.actor_role || "—"}</dd></div><div><dt>Target</dt><dd>{selected.entity_table || "System"} / {selected.entity_id || "—"}</dd></div><div><dt>Branch / Institution</dt><dd>{selected.branch_name || "—"} / {selected.institution_name || "—"}</dd></div><div><dt>Before</dt><dd><pre>{jsonText(selected.before_data)}</pre></dd></div><div><dt>After</dt><dd><pre>{jsonText(selected.after_data)}</pre></dd></div><div><dt>Metadata</dt><dd><pre>{jsonText(selected.metadata)}</pre></dd></div></dl></section></div>}
  </section>;
}
