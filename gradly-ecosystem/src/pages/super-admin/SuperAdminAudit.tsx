import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import { clearToken, getToken } from "../../lib/superAdminSession";
import "./SuperAdminAudit.css";

type AuditItem = {
  id: string | number;
  actorType?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityTable?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  createdAt?: string | null;
};
type AuditResponse = {
  success?: boolean;
  message?: string;
  data?: { items?: AuditItem[]; page?: { limit: number; offset: number; total: number; hasMore: boolean } };
};

function formatDate(value?: string | null) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Timestamp unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function humanize(value?: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

export default function SuperAdminAudit() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextOffset: number) => {
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      if (!token) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }
      const params = new URLSearchParams({ limit: "25", offset: String(nextOffset) });
      if (search) params.set("search", search);
      if (actorRole) params.set("actorRole", actorRole);
      const response = await fetch(`${API_BASE_URL}/api/super-admin/audit?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }
      const result = (await response.json().catch(() => ({}))) as AuditResponse;
      if (!response.ok || result.success === false) throw new Error(result.message || "Could not load audit history.");
      const data = result.data;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.page?.total ?? 0));
      setHasMore(Boolean(data?.page?.hasMore));
      setOffset(nextOffset);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load audit history.");
    } finally {
      setLoading(false);
    }
  }, [actorRole, search]);

  useEffect(() => { void load(0); }, [load]);
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  return (
    <section className="sa-audit-page">
      <header className="sa-audit-header">
        <div>
          <div className="sa-audit-eyebrow">SECURITY / ACCOUNTABILITY</div>
          <h1>Audit logs</h1>
          <p>Read-only history of recorded administrative actions. Sensitive metadata is not exposed in this feed.</p>
        </div>
        <button type="button" className="sa-audit-refresh" onClick={() => void load(offset)} disabled={loading}>
          <RefreshCw size={16} className={loading ? "sa-audit-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="sa-audit-notice"><ShieldAlert size={18} /><span>Audit records are read-only in this interface. Changes must be made through the corresponding authorized workflow.</span></div>

      <div className="sa-audit-stats">
        <div><Activity size={19} /><span>Matching records</span><strong>{loading ? "…" : total.toLocaleString("en-IN")}</strong></div>
        <p>Newest events appear first. Search and role filters are applied by the backend.</p>
      </div>

      <form className="sa-audit-toolbar" onSubmit={submitSearch}>
        <label className="sa-audit-search"><Search size={16} /><span className="sr-only">Search audit events</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search action, actor, entity, or record ID" /><button type="submit">Search</button></label>
        <label className="sa-audit-role"><span>Actor role</span><select value={actorRole} onChange={(event) => setActorRole(event.target.value)}><option value="">All roles</option><option value="SUPER_ADMIN">Super Admin</option><option value="INSTITUTION_ADMIN">Institution Admin</option><option value="DEPARTMENT_ADMIN">Department Admin</option><option value="PROGRAM_ADMIN">Program Admin</option><option value="SYSTEM">System</option></select></label>
      </form>

      {error && <div className="sa-audit-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load(offset)}>Retry</button></div>}

      <div className="sa-audit-table-wrap">
        <table className="sa-audit-table">
          <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>IP address</th><th>Timestamp</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="sa-audit-empty"><RefreshCw className="sa-audit-spin" size={20} />Loading audit records…</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="sa-audit-empty"><Activity size={22} /><strong>No audit events found</strong><span>Try another search or role filter, or refresh the feed.</span></td></tr>
              : items.map((item) => <tr key={String(item.id)}><td><strong>{humanize(item.action)}</strong><small>{item.action || "Action not recorded"}</small></td><td><strong>{humanize(item.actorRole)}</strong><small>{item.actorType ? humanize(item.actorType) : "Actor"} · {item.actorId || "ID unavailable"}</small></td><td><strong>{item.entityTable || "Target unavailable"}</strong><small>{item.entityId || "Record ID unavailable"}</small></td><td>{item.ipAddress || "Not recorded"}</td><td>{formatDate(item.createdAt)}</td></tr>)}
          </tbody>
        </table>
      </div>

      <footer className="sa-audit-pagination"><span>Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + items.length, total)} of {total.toLocaleString("en-IN")}</span><div><button type="button" onClick={() => void load(Math.max(0, offset - 25))} disabled={loading || offset === 0}><ChevronLeft size={15} /> Previous</button><button type="button" onClick={() => void load(offset + 25)} disabled={loading || !hasMore}>Next <ChevronRight size={15} /></button></div></footer>
    </section>
  );
}
