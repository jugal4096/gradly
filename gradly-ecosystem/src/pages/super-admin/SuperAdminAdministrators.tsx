import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search, ShieldCheck } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

type Administrator = {
  id: string;
  admin_code: string;
  admin_username: string | null;
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  status: string;
  registration_status: string;
  institution_name: string;
  branch_name: string | null;
  last_login_at: string | null;
  adminship_expires_at: string | null;
};

type ListResponse = { administrators?: Administrator[]; message?: string };

const statusOptions = ["ALL", "ACTIVE", "SUSPENDED", "DISABLED"];

function displayDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SuperAdminAdministrators() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Administrator[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastLoadedCount, setLastLoadedCount] = useState<number | null>(null);

  const loadAdministrators = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (status !== "ALL") query.set("status", status);
      const encodedQuery = query.toString();
      const suffix = encodedQuery ? `?${encodedQuery}` : "";
      const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators${suffix}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const result = await response.json().catch(() => null) as ListResponse | null;
      if (response.status === 401) {
        localStorage.removeItem("gradly_super_admin_token");
        navigate("/super-admin/login", { replace: true });
        throw new Error("Your session expired. Please sign in again.");
      }
      if (response.status === 403) throw new Error("This account is not authorized to manage administrators.");
      if (!response.ok) throw new Error(result?.message || `Unable to load administrators (HTTP ${response.status}).`);
      if (!Array.isArray(result?.administrators)) throw new Error("The API returned an unexpected administrator list.");
      setRecords(result.administrators);
      setLastLoadedCount(result.administrators.length);
    } catch (caught) {
      setRecords([]);
      setLastLoadedCount(null);
      setError(caught instanceof Error ? caught.message : "Unable to load administrators.");
    } finally {
      setLoading(false);
    }
  }, [navigate, search, status]);

  useEffect(() => { void loadAdministrators(); }, [loadAdministrators]);

  const summary = useMemo(() => ({
    active: records.filter((record) => record.status === "ACTIVE").length,
    suspended: records.filter((record) => record.status === "SUSPENDED").length,
    disabled: records.filter((record) => record.status === "DISABLED").length,
  }), [records]);

  async function changeStatus(record: Administrator, nextStatus: "ACTIVE" | "SUSPENDED" | "DISABLED") {
    const action = nextStatus.toLowerCase();
    if (!window.confirm(`Are you sure you want to ${action} ${record.full_name}?`)) return;
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { setError("Your Super Admin session is missing. Please sign in again."); return; }
    setSavingId(record.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators/${encodeURIComponent(record.id)}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (response.status === 401) {
        localStorage.removeItem("gradly_super_admin_token");
        navigate("/super-admin/login", { replace: true });
        throw new Error("Your session expired. Please sign in again.");
      }
      if (response.status === 403) throw new Error("This account is not authorized to change administrator status.");
      if (!response.ok) throw new Error(result?.message || `Unable to update status (HTTP ${response.status}).`);
      setNotice(`${record.full_name} is now ${nextStatus.toLowerCase()}.`);
      setError("");
      await loadAdministrators();
      // loadAdministrators handles its own failures and updates the error state.
      // Do not erase a successful mutation notice if the follow-up GET fails.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update administrator status.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <main className="super-dashboard" style={{ minHeight: "70vh" }}>
      <header className="sd-header">
        <div className="sd-header-copy">
          <div className="sd-eyebrow"><ShieldCheck size={14} /> GRADLY / ACCESS GOVERNANCE</div>
          <h1>Administrator management</h1>
          <p>Review administrator accounts, institution assignments and access status.</p>
        </div>
        <button className="sd-refresh-button" type="button" onClick={() => void loadAdministrators()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "sd-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <section className="sd-metrics-grid" aria-label="Administrator status summary">
        {([{label:"Active",value:summary.active},{label:"Suspended",value:summary.suspended},{label:"Disabled",value:summary.disabled}] as const).map((item) => (
          <div className="sd-metric-card" key={item.label}>
            <span className="sd-metric-label">{item.label}</span>
            <strong className="sd-metric-value">{loading || error ? "—" : item.value}</strong>
            <span className="sd-metric-bottom"><span>In the current result set</span></span>
          </div>
        ))}
      </section>

      <section className="sd-section" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 240px" }}>
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search administrators</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, username or email" style={{ width: "100%", minHeight: 42, border: "1px solid #e0e3ef", borderRadius: 10, padding: "8px 12px", background: "#fff" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ minHeight: 42, border: "1px solid #e0e3ef", borderRadius: 10, padding: "8px 12px", background: "#fff" }}>
              {statusOptions.map((option) => <option key={option} value={option}>{option === "ALL" ? "All statuses" : option}</option>)}
            </select>
          </label>
        </div>

        {error && <div role="alert" className="sd-error"><div className="sd-error-copy"><strong>Administrators could not be loaded</strong><p>{error}</p></div><button className="sd-error-retry" type="button" onClick={() => void loadAdministrators()}>Retry</button></div>}
        {notice && <p role="status" style={{ padding: 12, borderRadius: 10, background: "#edf9f2", color: "#17643b" }}>{notice}</p>}

        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e8eaf3", borderRadius: 14 }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["Administrator","Institution / branch","Status","Last login","Adminship expiry","Actions"].map((heading) => <th key={heading} scope="col" style={{ padding: 14, borderBottom: "1px solid #e8eaf3", color: "#69738a", fontSize: 12 }}>{heading}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading administrator records…</td></tr>
              : records.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>No administrators match these filters.</td></tr>
              : records.map((record) => <tr key={record.id}>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><strong>{record.full_name || "Unnamed administrator"}</strong><div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{record.email || "No email"} · {record.admin_code}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{record.institution_name || "Unassigned"}<div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{record.branch_name || "No branch assigned"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><span>{record.status || "Unknown"}</span><div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{record.registration_status || "Registration status unavailable"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{displayDate(record.last_login_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{displayDate(record.adminship_expires_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>
                  <select aria-label={`Change status for ${record.full_name}`} value={record.status} disabled={savingId === record.id} onChange={(event) => { const value = event.target.value; if (value === "ACTIVE" || value === "SUSPENDED" || value === "DISABLED") void changeStatus(record, value); }} style={{ minHeight: 36, maxWidth: 140, border: "1px solid #e0e3ef", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                    {["ACTIVE","SUSPENDED","DISABLED"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#737d91", fontSize: 12, marginTop: 12 }}>{loading ? "Loading matching records…" : error || lastLoadedCount === null ? "Record count unavailable." : `Showing ${lastLoadedCount} matching records returned by the API. Counts reflect current filters, not platform-wide totals.`} Status changes require Super Admin authorization.</p>
      </section>
    </main>
  );
}
