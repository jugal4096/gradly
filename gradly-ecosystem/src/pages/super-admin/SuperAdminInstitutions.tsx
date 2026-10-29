import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, Building2, ChevronDown, ChevronRight, GitBranch, GraduationCap, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

type Institution = { id: string; name: string; active_admins: number; active_users: number; curriculum_count: number; program_count: number; branch_count: number };
type Program = { id: string; name: string; branch_count: number; branches: { id: string; name: string }[] };
const panel: React.CSSProperties = { background: "linear-gradient(145deg,#201735,#151123)", border: "1px solid #49356d", borderRadius: 18, padding: 20, color: "#f7f2ff", boxShadow: "0 14px 35px #09061155" };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid #584578", background: "#100c1d", color: "#fff", outlineColor: "#b99aff" };
const primary: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 15px", border: 0, borderRadius: 10, background: "linear-gradient(110deg,#8b5cf6,#c084fc)", color: "#fff", fontWeight: 750, cursor: "pointer" };

export default function SuperAdminInstitutions() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [programs, setPrograms] = useState<Record<string, Program[]>>({});
  const [expanded, setExpanded] = useState<string>("");
  const [name, setName] = useState("");
  const [programName, setProgramName] = useState<Record<string, string>>({});
  const [branchName, setBranchName] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (path: string, method = "GET", body?: unknown) => {
    if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { navigate("/super-admin/login", { replace: true }); throw new Error("Your Super Admin session is missing. Sign in again."); }
    const response = await fetch(`${API_BASE_URL}/api/super-admin${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => null) as { success?: boolean; data?: unknown; message?: string } | null;
    if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); }
    if (!response.ok || !result?.success) throw new Error(result?.message || `Request failed (HTTP ${response.status}).`);
    return result.data;
  }, [navigate]);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await request(`/institutions?search=${encodeURIComponent(search)}`);
      setInstitutions(Array.isArray(data) ? data as Institution[] : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load institutions."); }
  }, [request, search]);

  useEffect(() => { void load(); }, [load]);

  async function loadPrograms(id: string) {
    try {
      const data = await request(`/institutions/${encodeURIComponent(id)}/programs`);
      setPrograms(old => ({ ...old, [id]: Array.isArray(data) ? data as Program[] : [] }));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load programs."); }
  }

  async function submitInstitution(event: FormEvent) {
    event.preventDefault(); setSaving("institution"); setError(""); setNotice("");
    try {
      await request("/institutions", "POST", { name });
      setName(""); setAdding(false); setNotice("Institution added successfully."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create institution."); }
    finally { setSaving(""); }
  }

  async function submitProgram(event: FormEvent, institutionId: string) {
    event.preventDefault(); const value = (programName[institutionId] || "").trim();
    if (!value) return;
    setSaving(`program-${institutionId}`); setError(""); setNotice("");
    try {
      await request(`/institutions/${encodeURIComponent(institutionId)}/programs`, "POST", { name: value });
      setProgramName(old => ({ ...old, [institutionId]: "" })); setNotice("Program added to the selected institution.");
      await Promise.all([load(), loadPrograms(institutionId)]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create program."); }
    finally { setSaving(""); }
  }

  async function submitBranch(event: FormEvent, institutionId: string, programId: string) {
    event.preventDefault(); const value = (branchName[programId] || "").trim();
    if (!value) return;
    setSaving(`branch-${programId}`); setError(""); setNotice("");
    try {
      await request(`/institutions/${encodeURIComponent(institutionId)}/programs/${encodeURIComponent(programId)}/branches`, "POST", { name: value });
      setBranchName(old => ({ ...old, [programId]: "" })); setNotice("Branch added to the selected program.");
      await Promise.all([load(), loadPrograms(institutionId)]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create branch."); }
    finally { setSaving(""); }
  }

  const metrics = [
    { label: "Active admins", key: "active_admins" as const, icon: ShieldCheck },
    { label: "Active users", key: "active_users" as const, icon: Users },
    { label: "Curricula", key: "curriculum_count" as const, icon: BookOpen },
    { label: "Programs", key: "program_count" as const, icon: GraduationCap },
    { label: "Branches", key: "branch_count" as const, icon: GitBranch }
  ];

  return <main style={{ minHeight: "100vh", padding: "clamp(18px,3vw,38px)", background: "radial-gradient(ellipse at 15% 0%,#38215a 0%,#171126 42%,#0c0915 100%)", color: "#f7f2ff" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 26 }}>
      <div><Link to="/super-admin" style={{ color: "#cbb6ff", textDecoration: "none", display: "inline-flex", gap: 7, alignItems: "center", marginBottom: 15 }}><ArrowLeft size={16}/> Command centre</Link>
        <div style={{ color: "#c4a9ff", fontSize: 11, letterSpacing: 2.5, fontWeight: 800 }}>ACADEMIC GOVERNANCE</div>
        <h1 style={{ margin: "8px 0", fontSize: "clamp(28px,4vw,42px)", letterSpacing: -1 }}>Institution Management</h1>
        <p style={{ margin: 0, color: "#bdb0d2", maxWidth: 700 }}>Register institutions and manage their programs and branches. Institutions are protected from deletion.</p>
      </div>
      <button style={primary} onClick={() => setAdding(v => !v)}><Plus size={18}/> Add institution</button>
    </header>

    {error && <div role="alert" style={{ ...panel, borderColor: "#ef6b8d", color: "#ffc2d1", marginBottom: 16 }}>{error}</div>}
    {notice && <div role="status" style={{ ...panel, borderColor: "#3fba8d", color: "#9df2ce", marginBottom: 16 }}>{notice}</div>}

    {adding && <form onSubmit={submitInstitution} style={{ ...panel, marginBottom: 20, display: "grid", gap: 12, maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>Register a new institution</h2><label htmlFor="institution-name">Official institution name</label>
      <input id="institution-name" required minLength={2} maxLength={180} style={field} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Government College of Engineering, Aurangabad"/>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button disabled={saving === "institution"} style={primary} type="submit">{saving === "institution" ? "Creating…" : "Create institution"}</button><button type="button" onClick={() => setAdding(false)} style={{ ...primary, background: "#342849" }}>Cancel</button></div>
    </form>}

    <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
      <input aria-label="Search institutions" style={{ ...field, maxWidth: 460 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search institution name…"/>
      <button style={{ ...primary, background: "#342849" }} onClick={() => void load()}><RefreshCw size={16}/> Refresh</button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,390px),1fr))", gap: 18 }}>
      {institutions.map(inst => <article key={inst.id} style={panel}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 14, background: "#6c43a855", border: "1px solid #9874d5" }}><Building2 size={23}/></span>
          <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 18, margin: "2px 0 6px", overflowWrap: "anywhere" }}>{inst.name}</h2><div style={{ color: "#a99bbb", fontSize: 12 }}>Institution ID · {inst.id}</div></div>
          <span title="Institutions cannot be deleted" style={{ color: "#a5e7c9", fontSize: 11, border: "1px solid #347a62", borderRadius: 20, padding: "5px 8px", whiteSpace: "nowrap" }}>Protected</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 9, margin: "18px 0" }}>
          {metrics.map(metric => { const MetricIcon = metric.icon; return <div key={metric.key} style={{ background: "#100c1c", border: "1px solid #3c2d55", borderRadius: 12, padding: 11 }}><MetricIcon size={16} color="#c5a8ff"/><div style={{ fontSize: 23, fontWeight: 800, marginTop: 5 }}>{Number(inst[metric.key] || 0).toLocaleString("en-IN")}</div><div style={{ color: "#b8a9cb", fontSize: 11 }}>{metric.label}</div></div>; })}
        </div>
        <button style={{ ...primary, width: "100%", background: "#392650", border: "1px solid #65458c" }} onClick={() => { const next = expanded === inst.id ? "" : inst.id; setExpanded(next); if (next) void loadPrograms(inst.id); }}>{expanded === inst.id ? <ChevronDown size={17}/> : <ChevronRight size={17}/>} {expanded === inst.id ? "Hide academic structure" : "Manage programs & branches"}</button>
        {expanded === inst.id && <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
          <form onSubmit={e => void submitProgram(e, inst.id)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input aria-label={`New program for ${inst.name}`} style={{ ...field, flex: "1 1 190px" }} required minLength={2} maxLength={180} value={programName[inst.id] || ""} onChange={e => setProgramName(old => ({ ...old, [inst.id]: e.target.value }))} placeholder="New program name"/>
            <button style={primary} disabled={saving === `program-${inst.id}`}><Plus size={15}/> Add program</button>
          </form>
          {(programs[inst.id] || []).map(program => <section key={program.id} style={{ border: "1px solid #45345f", background: "#110d1d", borderRadius: 12, padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{program.name}</strong><span style={{ color: "#cbb5f7", fontSize: 12 }}>{program.branch_count} branches</span></div>
            {program.branches?.length > 0 && <ul style={{ margin: "9px 0", paddingLeft: 22, color: "#c6bad5" }}>{program.branches.map(branch => <li key={branch.id}>{branch.name}</li>)}</ul>}
            <form onSubmit={e => void submitBranch(e, inst.id, program.id)} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <input aria-label={`New branch for ${program.name}`} style={{ ...field, flex: "1 1 160px" }} required minLength={2} maxLength={180} value={branchName[program.id] || ""} onChange={e => setBranchName(old => ({ ...old, [program.id]: e.target.value }))} placeholder="New branch name"/>
              <button style={{ ...primary, background: "#60418b" }} disabled={saving === `branch-${program.id}`}><Plus size={14}/> Add branch</button>
            </form>
          </section>)}
          {programs[inst.id]?.length === 0 && <div style={{ color: "#b8a9cb", fontSize: 13 }}>No programs yet. Add the first program above.</div>}
        </div>}
      </article>)}
    </div>
    {institutions.length === 0 && !error && <div style={{ ...panel, marginTop: 12, textAlign: "center" }}><Building2 size={28}/><h3>No institutions found</h3><p style={{ color: "#b8a9cb" }}>Try another search or add an institution manually.</p></div>}
    <footer style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 28, color: "#aa9abb", fontSize: 12 }}><ShieldCheck size={15}/> Super Admin only · No institution deletion endpoint or control is provided.</footer>
  </main>;
}
