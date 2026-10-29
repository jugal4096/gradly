import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import { clearToken, getToken } from "../../lib/superAdminSession";
import "./SuperAdminSecurity.css";

type SecurityEvent = {
  id: string | number;
  principalType?: string | null;
  principalId?: string | null;
  success: boolean;
  ipAddress?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
  lockoutLevel?: number | null;
  lockedUntil?: string | null;
  severity: "INFO" | "MEDIUM" | "HIGH";
};
type SecurityResponse = {
  success?: boolean;
  message?: string;
  data?: {
    items?: SecurityEvent[];
    summary?: { failedLast24Hours?: number; successfulLast24Hours?: number };
    page?: { limit: number; offset: number; total: number; hasMore: boolean };
  };
};

function formatDate(value?: string | null) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Timestamp unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function SuperAdminSecurity() {
  const [items, setItems] = useState<SecurityEvent[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [principalType, setPrincipalType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState({ failedLast24Hours: 0, successfulLast24Hours: 0 });
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
      if (principalType) params.set("principalType", principalType);
      if (outcome) params.set("outcome", outcome);
      const response = await fetch(`${API_BASE_URL}/api/super-admin/security/events?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }
      const result = (await response.json().catch(() => ({}))) as SecurityResponse;
      if (!response.ok || result.success === false) throw new Error(result.message || "Could not load security events.");
      const data = result.data;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setSummary({
        failedLast24Hours: Number(data?.summary?.failedLast24Hours ?? 0),
        successfulLast24Hours: Number(data?.summary?.successfulLast24Hours ?? 0),
      });
      setTotal(Number(data?.page?.total ?? 0));
      setHasMore(Boolean(data?.page?.hasMore));
      setOffset(nextOffset);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load security events.");
    } finally {
      setLoading(false);
    }
  }, [outcome, principalType, search]);

  useEffect(() => {
    // This effect starts an asynchronous API request; state updates happen after it settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  return (
    <section className="sa-security-page">
      <header className="sa-security-header">
        <div>
          <div className="sa-security-eyebrow">SECURITY / MONITORING</div>
          <h1>Security center</h1>
          <p>Monitor recorded authentication attempts and persisted account lockouts. This feed reflects available backend telemetry only.</p>
        </div>
        <button type="button" className="sa-security-refresh" onClick={() => void load(offset)} disabled={loading}>
          <RefreshCw size={16} className={loading ? "sa-security-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="sa-security-summary">
        <article><span className="sa-security-summary-icon failed"><AlertTriangle size={18} /></span><div><span>Failed attempts · 24 hours</span><strong>{loading ? "…" : summary.failedLast24Hours.toLocaleString("en-IN")}</strong></div></article>
        <article><span className="sa-security-summary-icon success"><CheckCircle2 size={18} /></span><div><span>Successful attempts · 24 hours</span><strong>{loading ? "…" : summary.successfulLast24Hours.toLocaleString("en-IN")}</strong></div></article>
        <article><span className="sa-security-summary-icon total"><ShieldCheck size={18} /></span><div><span>Matching events</span><strong>{loading ? "…" : total.toLocaleString("en-IN")}</strong></div></article>
      </div>

      <div className="sa-security-notice"><ShieldCheck size={17} /><span>High severity means the associated account currently has an active persisted lockout. Events are read-only; acknowledgement and investigation status are not yet stored by the current schema.</span></div>

      <form className="sa-security-toolbar" onSubmit={submitSearch}>
        <label className="sa-security-search"><Search size={16} /><span className="sr-only">Search security events</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search account ID, IP address, or failure reason" /><button type="submit">Search</button></label>
        <label className="sa-security-filter"><span>Account type</span><select value={principalType} onChange={(event) => setPrincipalType(event.target.value)}><option value="">All types</option><option value="SUPER_ADMIN">Super Admin</option><option value="ADMIN">Administrator</option><option value="USER">User</option></select></label>
        <label className="sa-security-filter"><span>Outcome</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="failed">Failed</option><option value="success">Successful</option></select></label>
      </form>

      {error && <div className="sa-security-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load(offset)}>Retry</button></div>}

      <div className="sa-security-table-wrap">
        <table className="sa-security-table">
          <thead><tr><th>Severity</th><th>Account</th><th>Outcome</th><th>IP address</th><th>Reason</th><th>Time</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="sa-security-empty"><RefreshCw size={20} className="sa-security-spin" />Loading security events…</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="sa-security-empty"><ShieldCheck size={22} /><strong>No matching security events</strong><span>Try different filters or refresh the event feed.</span></td></tr>
              : items.map((item) => <tr key={String(item.id)}><td><span className={`sa-security-severity sa-security-severity-${item.severity.toLowerCase()}`}>{item.severity}</span></td><td><strong>{item.principalType || "Unknown type"}</strong><small>{item.principalId || "Account ID unavailable"}</small></td><td><span className={item.success ? "sa-security-outcome success" : "sa-security-outcome failed"}>{item.success ? "Successful" : "Failed"}</span></td><td>{item.ipAddress || "Not recorded"}</td><td>{item.failureReason || (item.success ? "—" : "Failure reason not recorded")}{item.severity === "HIGH" && item.lockedUntil ? <small>Locked until {formatDate(item.lockedUntil)}</small> : null}</td><td>{formatDate(item.createdAt)}</td></tr>)}
          </tbody>
        </table>
      </div>

      <footer className="sa-security-pagination"><span>Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + items.length, total)} of {total.toLocaleString("en-IN")}</span><div><button type="button" onClick={() => void load(Math.max(0, offset - 25))} disabled={loading || offset === 0}><ChevronLeft size={15} /> Previous</button><button type="button" onClick={() => void load(offset + 25)} disabled={loading || !hasMore}>Next <ChevronRight size={15} /></button></div></footer>
    </section>
  );
}
