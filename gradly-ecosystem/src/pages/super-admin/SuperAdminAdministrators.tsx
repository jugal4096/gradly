import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search, ShieldCheck, Eye, Activity, Bell, SlidersHorizontal, CalendarDays } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import "../../styles/super-admin-dashboard.css";

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

const statusOptions = ["ALL", "ACTIVE", "SUSPENDED", "DISABLED", "DELETED"];

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
  const [institution, setInstitution] = useState("ALL");
  const [program, setProgram] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [selected, setSelected] = useState<Administrator | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastLoadedCount, setLastLoadedCount] = useState<number | null>(null);

  const loadAdministrators = useCallback(async (): Promise<{ ok: true; count: number } | { ok: false; message: string }> => {
    setLoading(true);
    setError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (status !== "ALL") query.set("status", status);
      if (institution !== "ALL") query.set("institutionId", institution);
      if (program !== "ALL") query.set("programId", program);
      if (branch !== "ALL") query.set("branchId", branch);
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
      return { ok: true, count: result.administrators.length };
    } catch (caught) {
      setRecords([]);
      setLastLoadedCount(null);
      const message = caught instanceof Error ? caught.message : "Unable to load administrators.";
      setError(message);
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  }, [navigate, search, status, institution, program, branch]);

  useEffect(() => {
    void Promise.resolve().then(() => loadAdministrators());
  }, [loadAdministrators]);

  const institutions = useMemo(() => [...new Map(records.map(r => [r.institution_id || r.institution_name, { id: r.institution_id || r.institution_name, name: r.institution_name }])).values()], [records]);
  const programs = useMemo(() => [...new Map(records.filter(r => r.program_id || r.program_name).map(r => [r.program_id || r.program_name, { id: r.program_id || r.program_name || "", name: r.program_name || "Unknown program" }])).values()], [records]);
  const branches = useMemo(() => [...new Map(records.filter(r => r.branch_id || r.branch_name).map(r => [r.branch_id || r.branch_name, { id: r.branch_id || r.branch_name || "", name: r.branch_name || "Unknown branch" }])).values()], [records]);
  const sortedRecords = useMemo(() => [...records].sort((a,b) => sortBy === "graduation" ? (a.graduation_date || "9999").localeCompare(b.graduation_date || "9999") : sortBy === "institution" ? (a.institution_name || "").localeCompare(b.institution_name || "") : sortBy === "program" ? (a.program_name || "").localeCompare(b.program_name || "") : sortBy === "branch" ? (a.branch_name || "").localeCompare(b.branch_name || "") : (a.full_name || "").localeCompare(b.full_name || "")), [records, sortBy]);

  async function adminAction(path: string, method = "GET", body?: unknown) {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token || !selected) throw new Error("Select an administrator and sign in again if needed.");
    const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators/${encodeURIComponent(selected.id)}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  }
  async function openAdmin(record: Administrator) {
    setSelected(record); setExpiryDate(record.adminship_expires_at?.slice(0,10) || ""); setGraduationDate(record.graduation_date?.slice(0,10) || ""); setActivity([]); setPermissions([]);
    try { const [a,p] = await Promise.all([adminAction("activity"), adminAction("permissions")]); setActivity(a.activity || []); setPermissions((p.permissions || []).filter((x: any) => x.granted).map((x: any) => x.permission_code)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load administrator data."); }
  }
  const summary = useMemo(() => ({
    active: records.filter((record) => record.status === "ACTIVE").length,
    suspended: records.filter((record) => record.status === "SUSPENDED").length,
    disabled: records.filter((record) => record.status === "DISABLED").length,
  }), [records]);

  async function changeStatus(record: Administrator, nextStatus: "ACTIVE" | "SUSPENDED" | "DISABLED" | "DELETED") {
    const action = nextStatus.toLowerCase();
    if (!window.confirm(`Are you sure you want to ${action} ${record.full_name}? ${nextStatus === "DELETED" ? "This account cannot be reactivated." : ""}`)) return;
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
      setError("");
      const refresh = await loadAdministrators();
      setNotice(refresh.ok
        ? `${record.full_name} is now ${nextStatus.toLowerCase()}.`
        : `${record.full_name} status was updated, but the list could not be refreshed: ${refresh.message}`);
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
              : sortedRecords.map((record) => <tr key={record.id}>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><strong>{record.full_name || "Unnamed administrator"}</strong><div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{record.email || "No email"} · {record.admin_code}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{record.institution_name || "Unassigned"}<div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{record.program_name || "No program"} · {record.branch_name || "No branch"}</div><div style={{ color: "#737d91", fontSize: 12 }}>Graduation: {displayDate(record.graduation_date || null)}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><span>{record.status || "Unknown"}</span><div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{record.registration_status || "Registration status unavailable"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{displayDate(record.last_login_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{displayDate(record.adminship_expires_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>
                  <select aria-label={`Change status for ${record.full_name}`} value={record.status} disabled={savingId === record.id} onChange={(event) => { const value = event.target.value; if (value === "ACTIVE" || value === "SUSPENDED" || value === "DISABLED" || value === "DELETED") void changeStatus(record, value); }} style={{ minHeight: 36, maxWidth: 140, border: "1px solid #e0e3ef", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                    {["ACTIVE","SUSPENDED","DISABLED","DELETED"].map((value) => <option key={value} value={value}>{value}</option>)}
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
