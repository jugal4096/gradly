import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ShieldCheck, UserRound, Users, RotateCcw, AlertTriangle } from "lucide-react";

type Account = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  active: boolean;
  created_at: string;
  last_login_at?: string | null;
  institution_name?: string | null;
  program_name?: string | null;
  branch_name?: string | null;
};

type RoleFilter = "ALL" | "STUDENT" | "ADMIN";

const apiRoot = ((import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "")) + "/api";

export default function SuperAdminBlacklist() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) {
      setError("Your Super Admin session is missing. Please sign in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`${apiRoot}/super-admin/users/disabled?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Unable to load blacklist (HTTP ${response.status}).`);
      setAccounts(Array.isArray(data.students) ? data.students : Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load disabled accounts.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const visibleAccounts = useMemo(() => accounts.filter((account) => {
    const accountRole = String(account.role || "").toUpperCase();
    if (role === "STUDENT" && accountRole !== "STUDENT" && accountRole !== "USER") return false;
    if (role === "ADMIN" && accountRole !== "ADMIN") return false;
    return true;
  }), [accounts, role]);

  async function reactivate(account: Account) {
    const label = account.display_name || account.email || account.id;
    if (!window.confirm(`Reactivate ${label} and remove this account from the blacklist?`)) return;
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { setError("Your Super Admin session is missing. Please sign in again."); return; }
    setBusyId(account.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${apiRoot}/super-admin/users/${encodeURIComponent(account.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to reactivate this account.");
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setNotice(`${label} has been reactivated and removed from the blacklist.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reactivate this account.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="system-kicker">ACCOUNT RECOVERY</div>
          <h1 style={{ margin: "8px 0" }}>Blacklist</h1>
          <p style={{ margin: 0, opacity: 0.72 }}>Review disabled User and Admin accounts. Reactivating an account removes it from this list.</p>
        </div>
        <button type="button" className="hardware-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 520 }}>
          <Search size={17} style={{ position: "absolute", left: 13, top: 13, opacity: 0.55 }} />
          <input aria-label="Search disabled accounts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email or account ID" style={{ width: "100%", padding: "11px 14px 11px 40px", borderRadius: 10, border: "1px solid var(--border, #d5d5df)", background: "var(--surface, white)", color: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ALL", "STUDENT", "ADMIN"] as RoleFilter[]).map((item) => (
            <button key={item} type="button" className={role === item ? "action-button" : "hardware-button"} onClick={() => setRole(item)}>{item === "ALL" ? "All" : item === "STUDENT" ? "Users" : "Admins"}</button>
          ))}
        </div>
      </section>

      {error && <div role="alert" className="application-error"><AlertTriangle size={17} /> {error}</div>}
      {notice && <div role="status" className="application-notice"><ShieldCheck size={17} /> {notice}</div>}

      <section style={{ border: "1px solid var(--border, #dedee6)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: 16, borderBottom: "1px solid var(--border, #dedee6)" }}>
          <strong>Disabled accounts</strong>
          <span>{visibleAccounts.length} listed</span>
        </div>
        {loading ? <div style={{ padding: 28, textAlign: "center" }}>Loading disabled accounts…</div> : visibleAccounts.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", opacity: 0.72 }}>
            <Users size={30} />
            <p>No disabled accounts found for this filter.</p>
            <small>Only accounts with active = false and deleted_at is empty are listed. Soft-deleted accounts are intentionally excluded.</small>
          </div>
        ) : visibleAccounts.map((account) => (
          <article key={account.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 16, borderBottom: "1px solid var(--border, #dedee6)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--surface-muted, #f0eff8)" }}>
                {account.role === "ADMIN" ? <ShieldCheck size={20} /> : <UserRound size={20} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <strong>{account.display_name || "Unnamed account"}</strong>
                <div style={{ opacity: 0.72, overflowWrap: "anywhere" }}>{account.email || "No email"}</div>
                <small style={{ opacity: 0.65 }}>{account.role} · {account.institution_name || "Institution not linked"}{account.branch_name ? ` · ${account.branch_name}` : ""}</small>
              </div>
            </div>
            <button type="button" className="action-button" onClick={() => void reactivate(account)} disabled={busyId === account.id}>
              <RotateCcw size={15} /> {busyId === account.id ? "Reactivating…" : "Reactivate"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
