import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, BookOpen, RefreshCw, Search, MapPin, Layers3, Clock3, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import "./SuperAdminInstitutions.css";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";

type Program = { id: string; name: string; code?: string | null; level?: string | null; active?: boolean; branchCount?: number; curriculumCount?: number };
type Institution = { id: string; name: string; city?: string | null; region?: string | null; country?: string | null; program_count: number; branch_count: number; curriculum_count: number; programs: Program[] };
type InstitutionRequest = { id: string; college_name: string; locality: string; guest_id?: string | null; email: string; external_institution_id?: string | null; source?: string | null; status: string; created_at: string; updated_at?: string | null };
type View = "directory" | "requests";
const date = (value?: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : "—";
const pretty = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\\b\\w/g, (c) => c.toUpperCase());

export default function SuperAdminInstitutions() {
  const [view, setView] = useState<View>("requests");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [requests, setRequests] = useState<InstitutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("OPEN");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("gradly_super_admin_token");
      if (!token) throw new Error("Super Admin session missing. Please sign in again.");
      const headers = { Authorization: "Bearer " + token, Accept: "application/json" };
      const [directoryResponse, requestResponse] = await Promise.all([
        fetch(API_ROOT + "/super-admin/institutions", { headers }),
        fetch(API_ROOT + "/super-admin/institutions/requests?status=ALL", { headers }),
      ]);
      const [directoryData, requestData] = await Promise.all([
        directoryResponse.json().catch(() => ({})),
        requestResponse.json().catch(() => ({})),
      ]);
      if (!directoryResponse.ok) throw new Error(directoryData.message || "Could not load the institution directory.");
      if (!requestResponse.ok) throw new Error(requestData.message || "Could not load institution requests.");
      setInstitutions(Array.isArray(directoryData.institutions) ? directoryData.institutions : []);
      setRequests(Array.isArray(requestData.requests) ? requestData.requests : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load institution data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return institutions.filter((item) => !query || [item.name, item.city, item.region, item.country, ...item.programs.map((program) => program.name)].join(" ").toLowerCase().includes(query));
  }, [institutions, search]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((item) => {
      const statusMatch = requestStatus === "ALL" || (requestStatus === "OPEN" ? ["PENDING", "IN_REVIEW"].includes(item.status.toUpperCase()) : item.status.toUpperCase() === requestStatus);
      const queryMatch = !query || [item.college_name, item.locality, item.guest_id, item.email, item.external_institution_id, item.status].join(" ").toLowerCase().includes(query);
      return statusMatch && queryMatch;
    });
  }, [requests, requestStatus, search]);

  async function updateRequest(request: InstitutionRequest, status: string) {
    const token = localStorage.getItem("gradly_super_admin_token");
    if (!token) { setError("Super Admin session missing. Please sign in again."); return; }
    setSavingId(request.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(API_ROOT + "/super-admin/institutions/requests/" + encodeURIComponent(request.id), {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update request status.");
      setRequests((current) => current.map((item) => item.id === request.id ? data.request : item));
      setNotice("Request for “" + request.college_name + "” marked " + pretty(status) + ".");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update request status.");
    } finally {
      setSavingId(null);
    }
  }

  const pendingCount = requests.filter((item) => ["PENDING", "IN_REVIEW"].includes(item.status.toUpperCase())).length;
  const programCount = institutions.reduce((sum, item) => sum + Number(item.program_count || 0), 0);
  const branchCount = institutions.reduce((sum, item) => sum + Number(item.branch_count || 0), 0);

  return <main className="sa-institutions">
    <header className="sa-inst-head">
      <div><span className="sa-inst-kicker">ACADEMIC DIRECTORY / SUPER ADMIN</span><h1>Institutions</h1><p>Manage the Gradly institution directory, inspect programs and branches, and review colleges submitted by Guest Mode users.</p></div>
      <button className="sa-inst-refresh" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "sa-inst-spinning" : ""}/> Refresh data</button>
    </header>

    <section className="sa-inst-stats">
      <article><span>Institutions in database</span><strong>{institutions.length}</strong><small><Building2 size={13}/> Available for Guest Mode</small></article>
      <article><span>Programs</span><strong>{programCount}</strong><small><BookOpen size={13}/> Across listed institutions</small></article>
      <article><span>Branches / departments</span><strong>{branchCount}</strong><small><Layers3 size={13}/> Linked to programs</small></article>
      <article className={pendingCount ? "sa-inst-stat-pending" : ""}><span>Open addition requests</span><strong>{pendingCount}</strong><small><Clock3 size={13}/> Waiting for review</small></article>
    </section>

    <div className="sa-inst-tabs" role="tablist" aria-label="Institution management views">
      <button type="button" role="tab" aria-selected={view === "requests"} className={view === "requests" ? "is-active" : ""} onClick={() => { setView("requests"); setSearch(""); }}>Addition requests <span>{pendingCount}</span></button>
      <button type="button" role="tab" aria-selected={view === "directory"} className={view === "directory" ? "is-active" : ""} onClick={() => { setView("directory"); setSearch(""); }}>Available institutions <span>{institutions.length}</span></button>
    </div>

    <div className="sa-inst-toolbar">
      <label><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === "requests" ? "Search college, email, Guest ID or location…" : "Search institution, location or program…"}/></label>
      {view === "requests" && <select aria-label="Filter institution requests" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}><option value="OPEN">Open requests</option><option value="ALL">All requests</option><option value="PENDING">Pending</option><option value="IN_REVIEW">In review</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select>}
    </div>

    {error && <div className="sa-inst-error" role="alert"><AlertCircle size={17}/><div><strong>Institution data could not be loaded</strong><p>{error}</p><small>Confirm the backend is restarted and the guest institution request migrations have been applied to the same database.</small></div></div>}
    {notice && <div className="sa-inst-notice" role="status"><CheckCircle2 size={16}/>{notice}</div>}

    {view === "requests" ? <section className="sa-inst-panel">
      <div className="sa-inst-panel-head"><div><h2>College addition requests</h2><p>Requests are loaded directly from the guest institution requests table, not from the general feedback feed.</p></div><span>{filteredRequests.length} shown</span></div>
      {loading ? <div className="sa-inst-empty">Loading institution requests…</div> : filteredRequests.length === 0 ? <div className="sa-inst-empty"><Building2 size={25}/><strong>No matching institution requests</strong><span>Try “All requests” or refresh. Newly submitted requests should appear here once saved to the connected database.</span></div> : <div className="sa-inst-request-list">
        {filteredRequests.map((request) => <article className="sa-inst-request" key={request.id}>
          <div className="sa-inst-request-main"><span className={"sa-inst-status sa-inst-status-" + request.status.toLowerCase()}>{pretty(request.status)}</span><h3>{request.college_name}</h3><p className="sa-inst-location"><MapPin size={14}/>{request.locality || "Location not provided"}</p><div className="sa-inst-request-meta"><span><b>Email</b> {request.email || "Not provided"}</span><span><b>Guest ID</b> {request.guest_id || "Not provided"}</span><span><b>Submitted</b> {date(request.created_at)}</span></div>{request.external_institution_id && <small className="sa-inst-external">Directory reference: {request.external_institution_id}</small>}</div>
          <div className="sa-inst-request-actions"><label>Update status<select value={request.status.toUpperCase()} disabled={savingId === request.id} onChange={(event) => void updateRequest(request, event.target.value)}><option value="PENDING">Pending</option><option value="IN_REVIEW">In review</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select></label>{savingId === request.id && <small>Saving…</small>}</div>
        </article>)}
      </div>}
    </section> : <section className="sa-inst-directory">
      {loading ? <div className="sa-inst-empty">Loading institutions and programs…</div> : filteredInstitutions.length === 0 ? <div className="sa-inst-empty"><Building2 size={25}/><strong>No institutions found</strong><span>The directory is empty or no institution matches this search.</span></div> : filteredInstitutions.map((institution) => <article className="sa-inst-card" key={institution.id}>
        <button className="sa-inst-card-toggle" type="button" onClick={() => setExpanded(expanded === institution.id ? null : institution.id)} aria-expanded={expanded === institution.id}>
          <span className="sa-inst-card-icon"><Building2 size={20}/></span><span className="sa-inst-card-name"><strong>{institution.name}</strong><small><MapPin size={12}/>{[institution.city, institution.region, institution.country].filter(Boolean).join(", ") || "Location not recorded"}</small><small className="sa-inst-card-id">ID: {institution.id}</small></span><span className="sa-inst-card-counts"><b>{institution.program_count}</b><small>Programs</small><b>{institution.branch_count}</b><small>Branches</small></span>{expanded === institution.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </button>
        {expanded === institution.id && <div className="sa-inst-programs">{institution.programs.length === 0 ? <p>No programs are linked to this institution yet.</p> : institution.programs.map((program) => <div className="sa-inst-program" key={program.id}><span className="sa-inst-program-icon"><BookOpen size={16}/></span><span className="sa-inst-program-copy"><strong>{program.name}</strong><small>{[program.code, program.level].filter(Boolean).join(" · ") || "Program details not provided"}</small></span><span className="sa-inst-program-meta"><b>{program.branchCount ?? 0}</b><small>Branches</small></span><span className="sa-inst-program-meta"><b>{program.curriculumCount ?? 0}</b><small>Curricula</small></span><span className={"sa-inst-program-active " + (program.active === false ? "inactive" : "")}>{program.active === false ? "Inactive" : "Active"}</span></div>)}</div>}
      </article>)}
    </section>}

    <p className="sa-inst-footnote">Directory details reflect the current connected database. Marking a request Completed records the review status; it does not automatically create a new institution or programs. Add the approved institution and its academic structure through your database/administration workflow before marking it completed.</p>
  </main>;
}
