import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, Bell, CalendarDays, MoreVertical, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import "../../styles/super-admin-dashboard.css";

type Administrator = {
  id: string; admin_code: string; admin_username: string | null; full_name: string;
  email: string; phone_number: string; role: string; status: string; registration_status: string;
  institution_id: string; institution_name: string; program_id: string | null; program_name: string | null;
  branch_id: string | null; branch_name: string | null; graduation_date: string | null;
  last_login_at: string | null; adminship_started_at: string | null; adminship_expires_at: string | null;
  enrollment_number?: string | null; created_at?: string;
};
type ApiResult = { administrators?: Administrator[]; message?: string };
type CatalogItem = { id: string; name: string; institution_id?: string; institution_name?: string; program_id?: string; program_name?: string };
type CatalogResult = { institutions?: CatalogItem[]; programs?: CatalogItem[]; branches?: CatalogItem[]; message?: string };
type ActivityItem = { id: string; action: string; actor_role?: string; actor_type?: string; created_at: string; metadata?: unknown };
type AdminPageMode = "profile" | "permissions" | "activity" | "notice" | "access";
const adminPageModes: Record<string, AdminPageMode> = { profile: "profile", permissions: "permissions", activity: "activity", notice: "notice", access: "access" };

const statuses = ["ACTIVE", "SUSPENDED", "DISABLED", "DELETED"] as const;
const permissionOptions = [
  { code: "VIEW_USERS", label: "View users" },
  { code: "MANAGE_USERS", label: "Manage users" },
  { code: "VIEW_STUDENTS", label: "View students" },
  { code: "MANAGE_STUDENTS", label: "Manage students" },
  { code: "VIEW_RESULTS", label: "View results" },
  { code: "MANAGE_RESULTS", label: "Manage results" },
  { code: "MANAGE_SUBJECTS", label: "Manage subjects" },
  { code: "MANAGE_APPLICATIONS", label: "Manage applications" },
  { code: "VIEW_ANALYTICS", label: "View analytics" },
  { code: "MANAGE_NOTICES", label: "Manage notices" },
  { code: "MANAGE_SETTINGS", label: "Manage settings" },
] as const;
function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function dateInput(value: string | null | undefined) { return value ? value.slice(0, 10) : ""; }

export default function SuperAdminAdministrators() {
  const navigate = useNavigate();
  const { adminId, adminPage } = useParams<{ adminId?: string; adminPage?: string }>();
  const pageMode: AdminPageMode = adminPage && adminPageModes[adminPage] ? adminPageModes[adminPage] : "profile";
  const [records, setRecords] = useState<Administrator[]>([]);
  const [institutionOptions, setInstitutionOptions] = useState<CatalogItem[]>([]);
  const [programOptions, setProgramOptions] = useState<CatalogItem[]>([]);
  const [branchOptions, setBranchOptions] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [institution, setInstitution] = useState("ALL");
  const [program, setProgram] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [selected, setSelected] = useState<Administrator | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [permissions, setPermissions] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [count, setCount] = useState<number | null>(null);

  const loadAdministrators = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (status !== "ALL") query.set("status", status);
      const queryString = query.toString();
      const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators${queryString ? `?${queryString}` : ""}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
      });
      const result = await response.json().catch(() => null) as ApiResult | null;
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); throw new Error("Session expired. Please sign in again."); }
      if (!response.ok) throw new Error(result?.message || `Unable to load administrators (HTTP ${response.status}).`);
      if (!Array.isArray(result?.administrators)) throw new Error("The API returned an unexpected administrator list.");
      setRecords(result.administrators); setCount(result.administrators.length);
    } catch (caught) {
      setRecords([]); setCount(null); setError(caught instanceof Error ? caught.message : "Unable to load administrators.");
    } finally { setLoading(false); }
  }, [navigate, search, status]);

  useEffect(() => { void Promise.resolve().then(loadAdministrators); }, [loadAdministrators]);

  useEffect(() => {
    if (!adminId || loading) return;
    const match = records.find(item => item.id === adminId);
    if (match && selected?.id !== match.id) void openProfile(match);
  }, [adminId, loading, records]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const token = localStorage.getItem("gradly_super_admin_token");
        if (!token) throw new Error("Sign in to load institution and program options.");
        const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators/catalog`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
        });
        const result = await response.json().catch(() => null) as CatalogResult | null;
        if (response.status === 401) {
          localStorage.removeItem("gradly_super_admin_token");
          navigate("/super-admin/login", { replace: true });
          throw new Error("Session expired. Please sign in again.");
        }
        if (!response.ok) throw new Error(result?.message || `Could not load database filters (HTTP ${response.status}).`);
        if (!Array.isArray(result?.institutions) || !Array.isArray(result?.programs) || !Array.isArray(result?.branches)) {
          throw new Error("The database filter catalog response was incomplete.");
        }
        if (!cancelled) {
          setInstitutionOptions(result.institutions);
          setProgramOptions(result.programs);
          setBranchOptions(result.branches);
        }
      } catch (caught) {
        if (!cancelled) setCatalogError(caught instanceof Error ? caught.message : "Could not load database filters.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => { cancelled = true; };
  }, [navigate]);


  const visibleBranches = useMemo(() => branchOptions.filter(item =>
    (institution === "ALL" || item.institution_id === institution) &&
    (program === "ALL" || item.program_id === program)
  ), [branchOptions, institution, program]);

  const visibleRecords = useMemo(() => {
    const filtered = records.filter(r =>
      (institution === "ALL" || (r.institution_id || r.institution_name) === institution) &&
      (program === "ALL" || (r.program_id || r.program_name) === program) &&
      (branch === "ALL" || (r.branch_id || r.branch_name) === branch)
    );
    return filtered.sort((a, b) => {
      const av = sortBy === "institution" ? a.institution_name : sortBy === "program" ? a.program_name : sortBy === "branch" ? a.branch_name : sortBy === "expiry" ? a.adminship_expires_at : a.full_name;
      const bv = sortBy === "institution" ? b.institution_name : sortBy === "program" ? b.program_name : sortBy === "branch" ? b.branch_name : sortBy === "expiry" ? b.adminship_expires_at : b.full_name;
      return (av || "9999").localeCompare(bv || "9999");
    });
  }, [records, institution, program, branch, sortBy]);

  const summary = useMemo(() => ({
    active: records.filter(r => r.status === "ACTIVE").length,
    suspended: records.filter(r => r.status === "SUSPENDED").length,
    disabled: records.filter(r => r.status === "DISABLED").length,
    deleted: records.filter(r => r.status === "DELETED").length
  }), [records]);

  async function requestFor(admin: Administrator, path: string, method = "GET", body?: unknown) {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) throw new Error("Your Super Admin session is missing. Please sign in again.");
    const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators/${encodeURIComponent(admin.id)}/${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); }
    if (!response.ok) throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  async function openProfile(admin: Administrator) {
    setSelected(admin); setActivity([]); setPermissions(""); setExpiryDate(dateInput(admin.adminship_expires_at)); setDetailLoading(true); setError(""); setSuccess("");
    try {
      const [details, logs, perms] = await Promise.all([
        requestFor(admin, ""), requestFor(admin, "activity"), requestFor(admin, "permissions")
      ]);
      const full = details.administrator || admin;
      setSelected(full);
      setExpiryDate(dateInput(full.adminship_expires_at));
      setActivity(Array.isArray(logs.activity) ? logs.activity : []);
      setPermissions(Array.isArray(perms.permissions) ? perms.permissions.filter((p: { granted?: boolean }) => p.granted !== false).map((p: { permission_code: string }) => p.permission_code).join(", ") : "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load administrator details."); }
    finally { setDetailLoading(false); }
  }

  async function changeStatus(admin: Administrator, nextStatus: typeof statuses[number]) {
    const verb = nextStatus === "ACTIVE" ? "reactivate" : nextStatus === "DELETED" ? "mark as deleted (the account cannot be reactivated)" : nextStatus.toLowerCase();
    if (!window.confirm(`Are you sure you want to ${verb} ${admin.full_name}? ${nextStatus === "DELETED" ? "Deleted accounts cannot be reactivated." : ""}`)) return;
    setSavingId(admin.id); setError(""); setSuccess("");
    try {
      const token = localStorage.getItem("gradly_super_admin_token");
      const response = await fetch(`${API_BASE_URL}/api/super-admin/administrators/${encodeURIComponent(admin.id)}/status`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ status: nextStatus })
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); }
      if (!response.ok) throw new Error(result.message || `Status update failed (HTTP ${response.status}).`);
      setSuccess(`${admin.full_name} status updated to ${nextStatus}.`); setSelected(current => current?.id === admin.id ? { ...current, status: nextStatus } : current); setRecords(current => current.map(item => item.id === admin.id ? { ...item, status: nextStatus } : item)); await loadAdministrators();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update status."); }
    finally { setSavingId(""); }
  }

  async function saveDates() {
    if (!selected) return;
    setSavingId(selected.id); setError(""); setSuccess("");
    try {
      if (expiryDate) await requestFor(selected, "adminship", "PATCH", { expiresAt: expiryDate });
      setSuccess("Administrator dates saved."); await loadAdministrators();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save dates."); }
    finally { setSavingId(""); }
  }

  async function savePermissions() {
    if (!selected) return;
    const values = [...new Set(permissions.split(",").map(v => v.trim()).filter(Boolean))];
    setSavingId(selected.id); setError(""); setSuccess("");
    try { await requestFor(selected, "permissions", "PUT", { permissions: values }); setSuccess("Permissions saved."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save permissions."); }
    finally { setSavingId(""); }
  }

  async function sendNotice() {
    if (!selected) return;
    setSavingId(selected.id); setError(""); setSuccess("");
    try {
      await requestFor(selected, "notices", "POST", { title: noticeTitle, body: noticeBody });
      setSuccess(`Notice saved for ${selected.full_name}.`); setNoticeTitle(""); setNoticeBody("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send notice."); }
    finally { setSavingId(""); }
  }

  return (
    <main className="super-dashboard sd-admin-management" style={{ minHeight: "70vh" }}>
      <header className="sd-header">
        <div className="sd-header-copy">
          <div className="sd-eyebrow"><ShieldCheck size={14} /> GRADLY / ACCESS GOVERNANCE</div>
          <h1>Administrator management</h1>
          <p>Filter, review and manage administrator accounts across institutions, programs and branches.</p>
        </div>
        <button className="sd-refresh-button" type="button" onClick={() => void loadAdministrators()} disabled={loading}><RefreshCw size={16} className={loading ? "sd-spin" : ""} /> {loading ? "Loading…" : "Refresh"}</button>
      </header>

      <section className="sd-metrics-grid" aria-label="Administrator status summary">
        {([{ label: "Active", value: summary.active }, { label: "Suspended", value: summary.suspended }, { label: "Disabled", value: summary.disabled }, { label: "Deleted", value: summary.deleted }] as const).map(item =>
          <div className="sd-metric-card" key={item.label}><span className="sd-metric-label">{item.label}</span><strong className="sd-metric-value">{loading || error ? "—" : item.value}</strong><span className="sd-metric-bottom"><span>Loaded records</span></span></div>
        )}
      </section>

      <section className="sd-section" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 240px" }}><Search size={17} aria-hidden="true" /><span className="sr-only">Search administrators</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, username or email" style={{ width: "100%", minHeight: 42, border: "1px solid #e0e3ef", borderRadius: 10, padding: "8px 12px", background: "#fff" }} /></label>
          <label>Status <select value={status} onChange={e => setStatus(e.target.value)}>{["ALL", ...statuses].map(s => <option key={s} value={s}>{s === "ALL" ? "All statuses" : s}</option>)}</select></label>
          <label>Institution <select value={institution} onChange={e => { setInstitution(e.target.value); setProgram("ALL"); setBranch("ALL"); }}><option value="ALL">{catalogLoading ? "Loading institutions…" : "All institutions"}</option>{institutionOptions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Program <select value={program} onChange={e => { setProgram(e.target.value); setBranch("ALL"); }}><option value="ALL">{catalogLoading ? "Loading programs…" : "All programs"}</option>{programOptions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Branch <select value={branch} onChange={e => setBranch(e.target.value)}><option value="ALL">{catalogLoading ? "Loading branches…" : "All matching branches"}</option>{visibleBranches.map(x => <option key={x.id} value={x.id}>{x.name} · {x.program_name || "Program"} · {x.institution_name || "Institution"}</option>)}</select></label>
          <label>Sort by <select value={sortBy} onChange={e => setSortBy(e.target.value)}>{[["name","Name"],["institution","Institution"],["program","Program"],["branch","Branch"],["expiry","Adminship expiry"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button type="button" onClick={() => { setInstitution("ALL"); setProgram("ALL"); setBranch("ALL"); setSortBy("name"); setStatus("ALL"); setSearch(""); }}>Reset filters</button>
        </div>

        {catalogError && <div role="alert" className="sd-error"><div className="sd-error-copy"><strong>Database filter options unavailable</strong><p>{catalogError}</p></div><button className="sd-error-retry" type="button" onClick={() => { setCatalogError(""); setCatalogLoading(true); const token = localStorage.getItem("gradly_super_admin_token"); void fetch(`${API_BASE_URL}/api/super-admin/administrators/catalog`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not load database filters."); setInstitutionOptions(data.institutions || []); setProgramOptions(data.programs || []); setBranchOptions(data.branches || []); }).catch(caught => setCatalogError(caught instanceof Error ? caught.message : "Could not load database filters.")).finally(() => setCatalogLoading(false)); }}>Retry options</button></div>}
        {error && <div role="alert" className="sd-error"><div className="sd-error-copy"><strong>Administrator management error</strong><p>{error}</p></div><button className="sd-error-retry" type="button" onClick={() => void loadAdministrators()}>Retry</button></div>}
        {success && <p role="status" style={{ padding: 12, borderRadius: 10, background: "#edf9f2", color: "#17643b" }}>{success}</p>}
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e8eaf3", borderRadius: 14 }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["Administrator","Institution / program / branch","Status","Last login","Adminship expiry","Actions"].map(h => <th key={h} scope="col" style={{ padding: 14, borderBottom: "1px solid #e8eaf3", color: "#69738a", fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: 32, textAlign: "center" }}>Loading administrator records…</td></tr>
              : visibleRecords.length === 0 ? <tr><td colSpan={6} style={{ padding: 32, textAlign: "center" }}>No administrators match these filters.</td></tr>
              : visibleRecords.map(admin => <tr key={admin.id}>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><strong>{admin.full_name || "Unnamed administrator"}</strong><div style={{ color: "#737d91", fontSize: 12, marginTop: 4 }}>{admin.email || "No email"} · {admin.admin_code}</div><div style={{ color: "#737d91", fontSize: 12 }}>{admin.role}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{admin.institution_name || "Unassigned"}<div style={{ color: "#737d91", fontSize: 12 }}>{admin.program_name || "No program"} · {admin.branch_name || "No branch"}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}><strong>{admin.status}</strong><div style={{ color: "#737d91", fontSize: 12 }}>{admin.registration_status}</div></td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{dateLabel(admin.last_login_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6" }}>{dateLabel(admin.adminship_expires_at)}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #f0f1f6", whiteSpace: "nowrap" }}>
                  <div style={{position:"relative",display:"inline-block"}}><button type="button" onClick={() => setOpenMenuId(current => current === admin.id ? null : admin.id)} aria-label={"More actions for " + admin.full_name} aria-expanded={openMenuId===admin.id} title="More administrator actions" style={{padding:9,borderRadius:9,border:"1px solid #ded7f5",background:"#f8f5ff",color:"#5b21b6"}}><MoreVertical size={18}/></button>{openMenuId===admin.id && <div role="menu" style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:30,minWidth:220,padding:6,borderRadius:12,background:"#fff",border:"1px solid #e4def4",boxShadow:"0 14px 36px #24124b24"}}>{[{label:"View profile",path:"profile"},{label:"Manage permissions",path:"permissions"},{label:"View activity",path:"activity"},{label:"Send notice",path:"notice"},{label:"Access & account status",path:"access"}].map(item=><button key={item.path} type="button" role="menuitem" onClick={()=>{setOpenMenuId(null);navigate(`/super-admin/admins/${encodeURIComponent(admin.id)}/${item.path}`);void openProfile(admin);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 9px",border:0,borderRadius:8,background:"transparent",color:"#28203f"}}>{item.label}</button>)}</div>}</div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#737d91", fontSize: 12, marginTop: 12 }}>{loading ? "Loading matching records…" : count === null ? "Record count unavailable." : `Showing ${visibleRecords.length} of ${count} records returned by the API.`} Sorting and additional filters apply to the loaded result set.</p>
      </section>

      {selected && <div role="dialog" aria-modal="true" aria-label={`Administrator profile: ${selected.full_name}`} style={{ position: "fixed", inset: 0, zIndex: 1000, background: adminId ? "#100b20" : "rgba(12,8,30,.72)", display: "flex", justifyContent: adminId ? "center" : "flex-end" }}>
        <section style={{ width: adminId ? "min(1100px,100%)" : "min(760px,100%)", height: "100%", overflowY: "auto", background: "#17122b", color: "#fff", padding: 24, boxShadow: "-20px 0 70px #0008" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><p style={{ color: "#c4b5fd", letterSpacing: 2, fontSize: 12 }}>GRADLY · ADMINISTRATOR MANAGEMENT / {pageMode.toUpperCase()}</p><button type="button" onClick={() => navigate("/super-admin/admins")} style={{marginBottom:16}}>← Back to administrators</button><h2>{pageMode === "profile" ? "Administrator profile" : pageMode === "permissions" ? "Manage permissions" : pageMode === "activity" ? "Activity history" : pageMode === "notice" ? "Send notice" : "Account access"} </h2><p>{selected.full_name}</p><p>{selected.email} · {selected.admin_code}</p></div><button type="button" onClick={() => { setSelected(null); navigate("/super-admin/admins"); }} aria-label="Close profile"><X/></button></div>
          {detailLoading && <p>Loading profile and activity…</p>}
          {(pageMode === "profile") && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, margin: "20px 0" }}>
            {[["Institution",selected.institution_name],["Program",selected.program_name || "—"],["Branch",selected.branch_name || "—"],["Status",selected.status],["Role",selected.role],["Enrollment",selected.enrollment_number || "—"],["Created",dateLabel(selected.created_at)],["Last login",dateLabel(selected.last_login_at)]].map(([k,v]) => <div key={k} style={{ padding: 14, borderRadius: 12, background: "#28203f", border: "1px solid #55427a" }}><small style={{ color: "#c4b5fd" }}>{k}</small><p>{v}</p></div>)}
          </div>}
          {pageMode === "profile" && <><h3 style={{ display: "flex", gap: 8, alignItems: "center" }}><CalendarDays size={17}/> Adminship validity</h3>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr)", marginBottom: 14 }}>
            <label>Adminship expiry date<input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={{ display: "block", width: "100%", padding: 14, marginTop: 8 }}/></label>
          </div>
          <button type="button" disabled={savingId === selected.id} onClick={() => void saveDates()}>Save dates</button></>}
          {pageMode === "permissions" && <><h3 style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 24 }}><SlidersHorizontal size={17}/> Permissions</h3>
          <p style={{ color: "#c4b5fd" }}>Choose the permissions to grant, then save your changes. Backend routes must enforce each permission code for it to control access.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,margin:"16px 0"}}>{permissionOptions.map(option=>{const codes=permissions.split(",").map(v=>v.trim()).filter(Boolean);const checked=codes.includes(option.code);return <label key={option.code} style={{display:"flex",gap:10,alignItems:"center",padding:13,borderRadius:10,border:checked?"1px solid #a78bfa":"1px solid #55427a",background:checked?"#38265d":"#28203f",cursor:"pointer"}}><input type="checkbox" checked={checked} onChange={e=>{const next=new Set(permissions.split(",").map(v=>v.trim()).filter(Boolean));if(e.target.checked)next.add(option.code);else next.delete(option.code);setPermissions([...next].join(", "));}}/><strong>{option.label}</strong></label>})}</div>
          <label style={{display:"block",marginBottom:8}}>Other permission codes<input value={permissions.split(",").map(v=>v.trim()).filter(v=>v&&!permissionOptions.some(o=>o.code===v)).join(", ")} onChange={e=>{const extras=e.target.value.split(",").map(v=>v.trim()).filter(Boolean);const selected=permissions.split(",").map(v=>v.trim()).filter(v=>permissionOptions.some(o=>o.code===v));setPermissions([...selected,...extras].join(", "));}} placeholder="CUSTOM_PERMISSION_CODE" style={{display:"block",width:"100%",padding:12,marginTop:8}}/></label>
          <button type="button" disabled={savingId === selected.id} onClick={() => void savePermissions()}>Save permissions</button></>}
          {pageMode === "notice" && <><h3 style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 24 }}><Bell size={17}/> Send a targeted notice</h3>
          <div style={{ padding: 16, margin: "12px 0 18px", borderRadius: 14, border: "1px solid #6d4ca5", background: "linear-gradient(135deg,#30204f,#211735)" }}><small style={{ color: "#c4b5fd", textTransform: "uppercase", letterSpacing: 1.2 }}>Recipient administrator</small><strong style={{ display: "block", fontSize: 18, marginTop: 6 }}>{selected.full_name}</strong><span style={{ color: "#ddd6fe" }}>{selected.email || "No email on record"} · {selected.institution_name || "Unassigned institution"}</span><p style={{ color: "#ddd6fe", marginBottom: 0 }}>This notice will be addressed only to this administrator.</p></div>
          <label style={{ display: "block", marginBottom: 12 }}>Notice title<input value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} maxLength={160} required placeholder="e.g. Adminship renewal required" style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 13, marginTop: 6, borderRadius: 10 }}/><small style={{ color: "#c4b5fd" }}>{noticeTitle.length}/160 characters</small></label>
          <label style={{ display: "block", marginBottom: 12 }}>Message<textarea value={noticeBody} onChange={e => setNoticeBody(e.target.value)} maxLength={5000} required rows={7} placeholder={`Write a notice for ${selected.full_name}…`} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 13, marginTop: 6, borderRadius: 10, resize: "vertical" }}/><small style={{ color: "#c4b5fd" }}>{noticeBody.length}/5000 characters</small></label>
          <button type="button" disabled={savingId === selected.id || !noticeTitle.trim() || !noticeBody.trim()} onClick={() => { if (window.confirm(`Send this notice to ${selected.full_name}?`)) void sendNotice(); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 10, border: "1px solid #a78bfa", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff", fontWeight: 700 }}><Bell size={16}/>{savingId === selected.id ? "Sending…" : `Send notice to ${selected.full_name}`}</button></>}
          {pageMode === "activity" && <><h3 style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 24 }}><Activity size={17}/> Recorded activity ({activity.length})</h3>
          {activity.length ? activity.map(item => <article key={item.id} style={{ padding: 12, margin: "8px 0", borderRadius: 10, background: "#28203f", border: "1px solid #55427a" }}><strong>{item.action || "Activity"}</strong><p>{dateLabel(item.created_at)} · {item.actor_role || item.actor_type || "System"}</p><small>{typeof item.metadata === "string" ? item.metadata : JSON.stringify(item.metadata || {})}</small></article>) : <p>No activity records were returned. This can mean no matching audit entries exist or the audit-log schema needs adjustment.</p>}
          </>}
          {pageMode === "access" && <><h3 style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 24 }}><ShieldCheck size={17}/> Account access controls</h3><p style={{ color: "#c4b5fd" }}>Block or suspend access temporarily, disable an account, or reactivate a non-deleted account. Deleted accounts are permanent.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" disabled={savingId === selected.id || selected.status === "DELETED" || selected.status === "SUSPENDED"} onClick={() => void changeStatus(selected, "SUSPENDED")}>Block access</button><button type="button" disabled={savingId === selected.id || selected.status === "DELETED" || selected.status === "DISABLED"} onClick={() => void changeStatus(selected, "DISABLED")}>Disable account</button><button type="button" disabled={savingId === selected.id || selected.status === "DELETED"} onClick={() => void changeStatus(selected, "DELETED")}>Delete account</button>{selected.status !== "DELETED" && selected.status !== "ACTIVE" && <button type="button" disabled={savingId === selected.id} onClick={() => void changeStatus(selected, "ACTIVE")}>Reactivate account</button>}</div></>}
        </section>
      </div>}
    </main>
  );
}
