import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, ChevronDown, ChevronRight, GitBranch, RefreshCw, Search } from "lucide-react";
import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../../lib/api";
import { clearToken, getToken } from "../../lib/superAdminSession";
import "./SuperAdminHierarchy.css";

type BranchNode = { id: string; name: string };
type ProgramNode = { id: string; name: string; branches: BranchNode[] };
type InstitutionNode = {
  id: string;
  name: string;
  programs: ProgramNode[];
  programCount: number;
  branchCount: number;
};
type HierarchyResponse = { success?: boolean; message?: string; data?: InstitutionNode[] };

export default function SuperAdminHierarchy() {
  const [institutions, setInstitutions] = useState<InstitutionNode[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
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
      const response = await fetch(`${API_BASE_URL}/api/super-admin/hierarchy`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        clearToken();
        window.location.assign("/super-admin/login");
        return;
      }
      const result = (await response.json().catch(() => ({}))) as HierarchyResponse;
      if (!response.ok || result.success === false) throw new Error(result.message || "Could not load academic hierarchy.");
      const rows = Array.isArray(result.data) ? result.data : [];
      setInstitutions(rows);
      setExpanded((current) => {
        if (Object.keys(current).length) return current;
        return Object.fromEntries(rows.map((institution) => [institution.id, true]));
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load academic hierarchy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // This effect starts an asynchronous API request; state updates happen after it settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return institutions;
    return institutions.map((institution) => {
      const institutionMatches = institution.name.toLowerCase().includes(query);
      const programs = institution.programs
        .map((program) => {
          const programMatches = program.name.toLowerCase().includes(query);
          return {
            ...program,
            branches: institutionMatches || programMatches
              ? program.branches
              : program.branches.filter((branch) => branch.name.toLowerCase().includes(query)),
          };
        })
        .filter((program) =>
          institutionMatches ||
          program.name.toLowerCase().includes(query) ||
          program.branches.length > 0
        );
      return { ...institution, programs };
    }).filter((institution) =>
      institution.name.toLowerCase().includes(query) ||
      institution.programs.length > 0
    );
  }, [institutions, search]);

  const totalPrograms = institutions.reduce((sum, institution) => sum + institution.programCount, 0);
  const totalBranches = institutions.reduce((sum, institution) => sum + institution.branchCount, 0);

  return (
    <section className="sa-hierarchy-page">
      <header className="sa-hierarchy-header">
        <div>
          <div className="sa-hierarchy-eyebrow">ACADEMIC STRUCTURE / MASTER DATA</div>
          <h1>Academic hierarchy</h1>
          <p>Inspect the institution → program → branch relationships used by administrator assignments and academic selectors.</p>
        </div>
        <button type="button" className="sa-hierarchy-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "sa-hierarchy-spin" : ""} /> Refresh</button>
      </header>

      <div className="sa-hierarchy-stats">
        <article><span>Institutions</span><strong>{loading ? "…" : institutions.length.toLocaleString("en-IN")}</strong></article>
        <article><span>Programs</span><strong>{loading ? "…" : totalPrograms.toLocaleString("en-IN")}</strong></article>
        <article><span>Branches</span><strong>{loading ? "…" : totalBranches.toLocaleString("en-IN")}</strong></article>
      </div>

      <div className="sa-hierarchy-note"><AlertCircle size={17} /><span>This page reads live academic master data. Create, rename, archive, and relationship-changing operations remain disabled until the deployed schema constraints and migration strategy are verified; this avoids orphaning existing academic records.</span></div>

      <label className="sa-hierarchy-search"><Search size={17} /><span className="sr-only">Search academic hierarchy</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search institutions, programs, or branches" /></label>

      {error && <div className="sa-hierarchy-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

      <div className="sa-hierarchy-tree">
        {loading ? <div className="sa-hierarchy-state"><RefreshCw size={21} className="sa-hierarchy-spin" /> Loading academic hierarchy…</div>
          : filtered.length === 0 ? <div className="sa-hierarchy-state"><Building2 size={24} /><strong>No matching academic records</strong><span>Try another search term or refresh the data.</span></div>
          : filtered.map((institution) => {
            const isExpanded = Boolean(expanded[institution.id]) || Boolean(search.trim());
            return <article className="sa-hierarchy-institution" key={institution.id}>
              <button className="sa-hierarchy-institution-toggle" type="button" onClick={() => setExpanded((current) => ({ ...current, [institution.id]: !current[institution.id] }))} aria-expanded={isExpanded}>
                {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                <span className="sa-hierarchy-institution-icon"><Building2 size={18} /></span>
                <span className="sa-hierarchy-node-copy"><strong>{institution.name}</strong><small>{institution.id}</small></span>
                <span className="sa-hierarchy-count">{institution.programCount} programs</span>
                <span className="sa-hierarchy-count">{institution.branchCount} branches</span>
              </button>
              {isExpanded && <div className="sa-hierarchy-programs">
                {institution.programs.length === 0 ? <div className="sa-hierarchy-empty-child">No programs recorded for this institution.</div>
                  : institution.programs.map((program) => <div className="sa-hierarchy-program" key={program.id}>
                    <div className="sa-hierarchy-program-heading"><GitBranch size={15} /><span className="sa-hierarchy-node-copy"><strong>{program.name}</strong><small>{program.id}</small></span><span className="sa-hierarchy-count">{program.branches.length} branches</span></div>
                    <div className="sa-hierarchy-branches">
                      {program.branches.length === 0 ? <span className="sa-hierarchy-empty-child">No branches recorded.</span>
                        : program.branches.map((branch) => <div className="sa-hierarchy-branch" key={branch.id}><span className="sa-hierarchy-branch-dot" /><span>{branch.name}</span><small>{branch.id}</small></div>)}
                    </div>
                  </div>)}
              </div>}
            </article>;
          })}
      </div>
    </section>
  );
}
