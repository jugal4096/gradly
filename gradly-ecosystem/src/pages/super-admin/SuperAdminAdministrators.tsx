import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Search, ShieldCheck, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import { clearToken, getToken } from "../../lib/superAdminSession";
import "./SuperAdminAdministrators.css";

type Administrator = {
  id: string;
  admin_code?: string | null;
  admin_username?: string | null;
  full_name: string;
  email: string;
  role: string;
  status: string;
  registration_status?: string | null;
  institution_name?: string | null;
  branch_name?: string | null;
  adminship_expires_at?: string | null;
  last_login_at?: string | null;
};

type ListResponse = {
  administrators?: Administrator[];
  count?: number;
  total?: number;
  page?: { limit: number; offset: number; hasMore: boolean };
  message?: string;
};

function prettyStatus(value?: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export default function SuperAdminAdministrators() {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expiryTarget, setExpiryTarget] = useState<Administrator | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryBusy, setExpiryBusy] = useState(false);

  const loadAdministrators = useCallback(async (nextOffset: number) => {
    if (!isApiConfigured) {
      setError(API_CONFIGURATION_ERROR);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const token = getToken();
      if (!token) {
        setError("Your Super Admin session is missing. Sign in again.");
        return;
      }

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (registrationFilter) params.set("registrationStatus", registrationFilter);
      params.set("limit", "25");
      params.set("offset", String(nextOffset));

      const query = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/api/super-admin/administrators${query ? `?${query}` : ""}`,
        { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
      );

      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }

      const result = (await response.json().catch(() => ({}))) as ListResponse;
      if (!response.ok) {
        throw new Error(result.message || `Could not load administrators (${response.status}).`);
      }
      const rows = Array.isArray(result.administrators) ? result.administrators : [];
      setAdministrators(rows);
      setOffset(nextOffset);
      setTotal(Number(result.total ?? result.count ?? rows.length));
      setHasMore(Boolean(result.page?.hasMore));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load administrators.");
    } finally {
      setLoading(false);
    }
  }, [registrationFilter, search, statusFilter]);

  // This effect starts an asynchronous API request; state updates happen after it settles.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAdministrators(0);
  }, [loadAdministrators]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  async function changeStatus(admin: Administrator) {
    const nextStatus = admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const action = nextStatus === "SUSPENDED" ? "suspend" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${admin.full_name}?`)) return;

    const token = getToken();
    if (!token) {
      clearToken();
      window.location.assign("/super-admin/login");
      return;
    }

    setBusyId(admin.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/super-admin/administrators/${encodeURIComponent(admin.id)}/status`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }
      if (!response.ok) throw new Error(result.message || `Could not ${action} administrator.`);
      setNotice(`${admin.full_name} is now ${prettyStatus(nextStatus)}.`);
      await loadAdministrators(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} administrator.`);
    } finally {
      setBusyId(null);
    }
  }

  async function saveExpiry() {
    if (!expiryTarget) return;
    if (!expiryDate) {
      setError("Choose a new expiry date.");
      return;
    }
    const expiryInstant = new Date(`${expiryDate}T23:59:59.000Z`);
    if (Number.isNaN(expiryInstant.getTime()) || expiryInstant.getTime() <= Date.now()) {
      setError("The new expiry date must be in the future.");
      return;
    }
    if (!window.confirm(`Confirm extending adminship for ${expiryTarget.full_name} until ${expiryDate}?`)) return;
    const token = getToken();
    if (!token) {
      clearToken();
      window.location.assign("/super-admin/login");
      return;
    }
    setExpiryBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/super-admin/administrators/${encodeURIComponent(expiryTarget.id)}/adminship`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ expiresAt: expiryInstant.toISOString() }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }
      if (!response.ok) throw new Error(result.message || "Could not extend administrator expiry.");
      setNotice(`Adminship expiry updated for ${expiryTarget.full_name}.`);
      setExpiryTarget(null);
      await loadAdministrators(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not extend administrator expiry.");
    } finally {
      setExpiryBusy(false);
    }
  }

  return (
    <section className="sa-admins-page">
      <header className="sa-admins-header">
        <div>
          <div className="sa-admins-eyebrow">GOVERNANCE / ACCESS CONTROL</div>
          <h1>Administrator management</h1>
          <p>Review administrator accounts, assigned academic scope, status, and expiry.</p>
        </div>
        <button className="sa-admins-refresh" type="button" onClick={() => void loadAdministrators(offset)} disabled={loading}>
          <RefreshCw size={16} className={loading ? "sa-admins-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="sa-admins-summary">
        <div className="sa-admins-summary-icon"><ShieldCheck size={20} /></div>
        <div><span>Matching administrators</span><strong>{loading ? "…" : administrators.length.toLocaleString("en-IN")}</strong></div>
        <p>Results reflect the current filters and the server response.</p>
      </div>

      <form className="sa-admins-toolbar" onSubmit={submitSearch}>
        <label className="sa-admins-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search administrators</span>
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, email, username, or admin code" />
          <button type="submit">Search</button>
        </label>
        <label className="sa-admins-filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
        <label className="sa-admins-filter">
          <span>Registration</span>
          <select value={registrationFilter} onChange={(event) => setRegistrationFilter(event.target.value)}>
            <option value="">All registration states</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
      </form>

      {error && <div className="sa-admins-alert sa-admins-alert-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => void loadAdministrators(offset)}>Retry</button></div>}
      {notice && <div className="sa-admins-alert sa-admins-alert-success" role="status"><CheckCircle2 size={17} /><span>{notice}</span></div>}

      <div className="sa-admins-table-wrap">
        <table className="sa-admins-table">
          <thead><tr><th>Administrator</th><th>Role & scope</th><th>Account status</th><th>Adminship expiry</th><th>Last login</th><th>Action</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td className="sa-admins-state" colSpan={6}><RefreshCw size={20} className="sa-admins-spin" /> Loading administrator records…</td></tr>
            ) : administrators.length === 0 ? (
              <tr><td className="sa-admins-state" colSpan={6}><Building2 size={22} /><strong>No administrators found</strong><span>Try changing the search or filters, or refresh to load the latest records.</span></td></tr>
            ) : administrators.map((admin) => (
              <tr key={admin.id}>
                <td><div className="sa-admins-person"><span className="sa-admins-avatar">{admin.full_name.trim().slice(0, 1).toUpperCase() || "A"}</span><div><strong>{admin.full_name}</strong><span>{admin.email || "No email recorded"}</span><small>{admin.admin_code || admin.admin_username || admin.id}</small></div></div></td>
                <td><strong>{prettyStatus(admin.role)}</strong><span className="sa-admins-scope">{admin.institution_name || "Institution unavailable"}{admin.branch_name ? ` · ${admin.branch_name}` : ""}</span></td>
                <td><span className={`sa-admins-status sa-admins-status-${(admin.status || "unknown").toLowerCase()}`}>{prettyStatus(admin.status)}</span><small className="sa-admins-registration">Registration: {prettyStatus(admin.registration_status)}</small></td>
                <td>{formatDate(admin.adminship_expires_at)}</td>
                <td>{formatDate(admin.last_login_at)}</td>
                <td><div className="sa-admins-row-actions"><button className={`sa-admins-action ${admin.status === "ACTIVE" ? "sa-admins-action-warning" : "sa-admins-action-primary"}`} type="button" onClick={() => void changeStatus(admin)} disabled={busyId === admin.id || admin.status === "DISABLED"}>{busyId === admin.id ? "Saving…" : admin.status === "ACTIVE" ? "Suspend" : admin.status === "SUSPENDED" ? "Reactivate" : "Disabled"}</button><button className="sa-admins-action sa-admins-action-primary" type="button" onClick={() => { setExpiryTarget(admin); setExpiryDate(admin.adminship_expires_at ? admin.adminship_expires_at.slice(0, 10) : ""); setError(""); }} disabled={admin.status === "DISABLED"}>Extend</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="sa-admins-pagination">
        <span>Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + administrators.length, total)} of {total.toLocaleString("en-IN")}</span>
        <div>
          <button type="button" onClick={() => void loadAdministrators(Math.max(0, offset - 25))} disabled={loading || offset === 0}>Previous</button>
          <button type="button" onClick={() => void loadAdministrators(offset + 25)} disabled={loading || !hasMore}>Next</button>
        </div>
      </footer>
      <p className="sa-admins-footnote">Sensitive status changes and expiry extensions require confirmation. Backend authorization remains the source of truth.</p>
      {expiryTarget && <div className="sa-admins-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !expiryBusy) setExpiryTarget(null); }}>
        <section className="sa-admins-modal" role="dialog" aria-modal="true" aria-labelledby="sa-admins-expiry-title">
          <div className="sa-admins-modal-icon"><ShieldCheck size={21} /></div>
          <h2 id="sa-admins-expiry-title">Extend administrator access</h2>
          <p>Choose a new expiry date for <strong>{expiryTarget.full_name}</strong>. This change is recorded by the backend.</p>
          <label className="sa-admins-expiry-field"><span>New expiry date</span><input type="date" autoFocus min={new Date().toISOString().slice(0, 10)} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
          <div className="sa-admins-modal-actions"><button type="button" onClick={() => setExpiryTarget(null)} disabled={expiryBusy}>Cancel</button><button type="button" onClick={() => void saveExpiry()} disabled={expiryBusy || !expiryDate}>{expiryBusy ? "Saving…" : "Confirm extension"}</button></div>
        </section>
      </div>}
    </section>
  );
}
