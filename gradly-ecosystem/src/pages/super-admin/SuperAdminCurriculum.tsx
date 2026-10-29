import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Building2, FilterX, GitBranch, GraduationCap, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";

type Institution = { id: string; name: string };
type Curriculum = {
  id: string; curriculum_name: string; institution_id: string; institution_name: string;
  program_id: string; program_name: string; branch_id: string | null; branch_name: string | null;
  status: string | null; academic_year: string | null; version: string | null;
};
const panel: React.CSSProperties = { background: "linear-gradient(145deg,#211638,#151022)", border: "1px solid #49356d", borderRadius: 20, padding: 22, color: "#f7f2ff", boxShadow: "0 16px 40px #09061140" };
const field: React.CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "12px 13px", borderRadius: 11, border: "1px solid #574476", background: "#100c1d", color: "#fff", outlineColor: "#b99aff" };
const label: React.CSSProperties = { display: "grid", gap: 8, color: "#d8c8f2", fontSize: 12, fontWeight: 750 };

export default function SuperAdminCurriculum() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [rows, setRows] = useState<Curriculum[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState("");

  const request = useCallback(async (path: string) => {
    if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { navigate("/super-admin/login", { replace: true }); throw new Error("Your Super Admin session is missing. Sign in again."); }
    const response = await fetch(`${API_BASE_URL}/api/super-admin${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    const result = await response.json().catch(() => null) as { success?: boolean; data?: unknown; message?: string } | null;
    if (response.status === 401) { localStorage.removeItem("gradly_super_admin_token"); navigate("/super-admin/login", { replace: true }); }
    if (!response.ok || !result?.success || !Array.isArray(result.data)) throw new Error(result?.message || `Unable to load curriculum data (HTTP ${response.status}).`);
    return result.data;
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [institutionData, curriculumData] = await Promise.all([
        request("/institutions?limit=300"),
        request("/curriculum/catalog?limit=500")
      ]);
      setInstitutions(institutionData as Institution[]);
      setRows(curriculumData as Curriculum[]);
      setLoadedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load curriculum data.");
      setRows([]);
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const programs = useMemo(() => {
    const source = rows.filter(row => !institutionId || row.institution_id === institutionId);
    return [...new Map(source.map(row => [row.program_id, { id: row.program_id, name: row.program_name }])).values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [rows, institutionId]);
  const branches = useMemo(() => {
    const source = rows.filter(row => (!institutionId || row.institution_id === institutionId) && (!programId || row.program_id === programId) && row.branch_id && row.branch_name);
    return [...new Map(source.map(row => [row.branch_id!, { id: row.branch_id!, name: row.branch_name! }])).values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [rows, institutionId, programId]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(row =>
      (!institutionId || row.institution_id === institutionId) &&
      (!programId || row.program_id === programId) &&
      (!branchId || row.branch_id === branchId) &&
      (!needle || [row.curriculum_name,row.institution_name,row.program_name,row.branch_name,row.status,row.academic_year,row.version,row.id].some(value => String(value ?? "").toLowerCase().includes(needle)))
    );
  }, [rows, institutionId, programId, branchId, search]);

  function resetFilters() { setInstitutionId(""); setProgramId(""); setBranchId(""); setSearch(""); }

  return <main style={{ maxWidth: 1440, margin: "0 auto", padding: "clamp(18px,3vw,36px)", color: "#241447" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 26 }}>
      <div>
        <Link to="/super-admin" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#7543d6", fontSize: 13, fontWeight: 750, textDecoration: "none", marginBottom: 22 }}><ArrowLeft size={15}/> Back to command centre</Link>
        <span style={{ display: "block", color: "#8b65d6", fontSize: 10, fontWeight: 850, letterSpacing: ".16em", marginBottom: 8 }}>ACADEMIC GOVERNANCE · GLOBAL VIEW</span>
        <h1 style={{ margin: "0 0 10px", fontSize: "clamp(28px,4vw,42px)", letterSpacing: "-.04em" }}>Curriculum Explorer</h1>
        <p style={{ maxWidth: 760, color: "#756b8e", lineHeight: 1.7, margin: 0 }}>Explore curriculum records across every institute, program and branch from one place. Combine filters or search by curriculum name, status, academic year or record ID.</p>
      </div>
      <div style={{ display: "grid", placeItems: "center", flex: "0 0 64px", width: 64, height: 64, borderRadius: 21, color: "white", background: "radial-gradient(circle at 25% 15%,#b79aff,#8354dc 45%,#49228e)", boxShadow: "0 14px 30px #6d42b533,inset 0 1px #ffffff75" }}><BookOpen size={27}/></div>
    </header>

    <section style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <div><span style={{ color: "#b99aff", fontSize: 10, fontWeight: 850, letterSpacing: ".14em" }}>FILTER WORKSPACE</span><h2 style={{ margin: "6px 0", fontSize: 22 }}>Narrow your curriculum view</h2><p style={{ margin: 0, color: "#b9abcF", fontSize: 13 }}>Filters can be combined. Choose an institute first to narrow programs.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #604a80", borderRadius: 11, padding: "10px 13px", color: "#f7f2ff", background: "#302147", cursor: loading ? "wait" : "pointer" }}><RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}}/>{loading ? "Loading…" : "Refresh records"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 14 }}>
        <label style={label}><span><Building2 size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>Institute</span><select style={field} value={institutionId} onChange={e => { setInstitutionId(e.target.value); setProgramId(""); setBranchId(""); }}><option value="">All institutes</option>{institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label style={label}><span><GraduationCap size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>Program</span><select style={field} value={programId} onChange={e => { setProgramId(e.target.value); setBranchId(""); }}><option value="">All programs</option>{programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label style={label}><span><GitBranch size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>Branch</span><select style={field} value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">All branches</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label style={label}><span><Search size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/>Search records</span><input style={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, status, year, ID…"/></label>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        <span style={{ color: "#d4c5e9", fontSize: 12 }}>{loadedAt ? `Last refreshed ${loadedAt}` : "Connected to the authenticated API"} · read-only catalogue</span>
        <button type="button" onClick={resetFilters} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 10, border: "1px solid #604a80", color: "#f4eaff", background: "transparent", cursor: "pointer" }}><FilterX size={15}/> Clear filters</button>
      </div>
    </section>

    <section style={{ marginTop: 22, border: "1px solid #e8e0f5", borderRadius: 20, background: "#fff", overflow: "hidden", boxShadow: "0 16px 45px #28134e08" }}>
      <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", borderBottom: "1px solid #eee8f7" }}>
        <div><span style={{ color: "#8b65d6", fontSize: 10, fontWeight: 850, letterSpacing: ".14em" }}>CURRICULUM CATALOGUE</span><h2 style={{ margin: "5px 0 0", fontSize: 21 }}>{filtered.length} {filtered.length === 1 ? "record" : "records"} match</h2></div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #e7dcf8", background: "#f7f2ff", color: "#6f43b5", padding: "7px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}><ShieldCheck size={14}/> Protected · view only</span>
      </div>
      {error ? <div role="alert" style={{ margin: 20, padding: 16, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#9f1239" }}><strong>Could not load curriculum data</strong><p style={{ marginBottom: 10 }}>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div> : loading ? <div style={{ padding: 36, textAlign: "center", color: "#756b8e" }}>Loading real curriculum records…</div> : filtered.length === 0 ? <div style={{ padding: 42, textAlign: "center", color: "#756b8e" }}><BookOpen size={28}/><h3 style={{ color: "#241447" }}>No matching curriculum records</h3><p>Try clearing one or more filters, or refresh the catalogue.</p></div> :
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850, fontSize: 13 }}><thead><tr>{["Curriculum","Institute","Program","Branch","Academic year","Status","Version"].map(title => <th key={title} style={{ textAlign: "left", padding: "13px 15px", color: "#76678e", background: "#faf8ff", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</th>)}</tr></thead><tbody>{filtered.map((row,index) => <tr key={`${row.id}-${row.branch_id ?? "none"}`} style={{ borderTop: "1px solid #f0ebf7", background: index % 2 ? "#fff" : "#fdfcff" }}><td style={{ padding: "15px", fontWeight: 750, color: "#2d1b4b" }}>{row.curriculum_name || "Curriculum"}<small style={{ display: "block", marginTop: 4, color: "#9286a6", fontWeight: 500 }}>ID: {row.id}</small></td><td style={{ padding: "15px" }}>{row.institution_name}</td><td style={{ padding: "15px" }}>{row.program_name}</td><td style={{ padding: "15px" }}>{row.branch_name || "No branch linked"}</td><td style={{ padding: "15px" }}>{row.academic_year || "—"}</td><td style={{ padding: "15px" }}><span style={{ display: "inline-flex", padding: "5px 8px", borderRadius: 8, background: row.status ? "#f1eaff" : "#f4f1f8", color: row.status ? "#7042b5" : "#7b728b", fontSize: 11, fontWeight: 750 }}>{row.status || "Unspecified"}</span></td><td style={{ padding: "15px" }}>{row.version || "—"}</td></tr>)}</tbody></table></div>}
      <div style={{ padding: "12px 20px", borderTop: "1px solid #eee8f7", color: "#9286a6", fontSize: 11 }}>This view shows curriculum records returned by the backend (up to 500 per refresh). It does not edit or delete academic data.</div>
    </section>
  </main>;
}
