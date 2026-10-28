import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Building2, CheckCircle2, Clock3, Filter, RefreshCw, Search, ShieldCheck, UserRound, XCircle } from "lucide-react";
import "../../styles/super-admin-admins.css";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
type Admin = { id:string; admin_code:string; admin_username:string|null; full_name:string; email:string|null; phone_number:string|null; role:string; status:string; registration_status:string; institution_id:string; institution_name:string; branch_id:string|null; branch_name:string|null; enrollment_number:string|null; adminship_started_at:string|null; adminship_expires_at:string|null; last_login_at:string|null; created_at:string; updated_at:string; days_until_expiry?:number|null };
const date = (value?:string|null) => { if(!value)return "Not recorded"; const d=new Date(value); return Number.isNaN(d.getTime())?"Not recorded":d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); };
const dateTime = (value?:string|null) => { if(!value)return "No sign-in recorded"; const d=new Date(value); return Number.isNaN(d.getTime())?"No sign-in recorded":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const label = (value?:string|null) => (value||"Not assigned").replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());

export default function SuperAdminAdmins() {
  const [admins,setAdmins]=useState<Admin[]>([]);
  const [selected,setSelected]=useState<Admin|null>(null);
  const [search,setSearch]=useState("");
  const [institution,setInstitution]=useState("all");
  const [branch,setBranch]=useState("all");
  const [status,setStatus]=useState("all");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const load=useCallback(async()=>{
    const token=localStorage.getItem("gradly_super_admin_token");
    if(!token){setError("Super Admin session missing. Please sign in again.");setLoading(false);return;}
    setLoading(true);setError("");
    try{
      const response=await fetch(API+"/super-admin/administrators",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
      const data=await response.json().catch(()=>({})) as {administrators?:Admin[];message?:string};
      if(!response.ok)throw new Error(data.message||"Could not load administrator records.");
      setAdmins(Array.isArray(data.administrators)?data.administrators:[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not load administrator records.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const institutions=useMemo(()=>[...new Set(admins.map(a=>a.institution_name).filter(Boolean))].sort(),[admins]);
  const branches=useMemo(()=>[...new Set(admins.filter(a=>institution==="all"||a.institution_name===institution).map(a=>a.branch_name).filter((x):x is string=>Boolean(x)))].sort(),[admins,institution]);
  const filtered=useMemo(()=>admins.filter(a=>{
    const q=search.trim().toLowerCase();
    return (!q||[a.full_name,a.admin_code,a.admin_username,a.email,a.institution_name,a.branch_name,a.role].some(v=>v?.toLowerCase().includes(q)))&&
      (institution==="all"||a.institution_name===institution)&&(branch==="all"||a.branch_name===branch)&&(status==="all"||a.status===status);
  }),[admins,search,institution,branch,status]);

  async function details(admin:Admin){
    setSelected(admin);const token=localStorage.getItem("gradly_super_admin_token");if(!token)return;
    try{const r=await fetch(API+"/super-admin/administrators/"+encodeURIComponent(admin.id),{headers:{Authorization:"Bearer "+token}});const d=await r.json().catch(()=>({})) as {administrator?:Admin};if(r.ok&&d.administrator)setSelected(d.administrator);}catch{/* Keep list data visible if details are unavailable. */}
  }
  async function toggleStatus(admin:Admin){
    const next=admin.status==="ACTIVE"?"SUSPENDED":"ACTIVE";
    if(!window.confirm("Are you sure you want to "+(next==="SUSPENDED"?"suspend ":"reactivate ")+admin.full_name+"?"))return;
    const token=localStorage.getItem("gradly_super_admin_token");if(!token){setError("Super Admin session missing.");return;}
    setBusy(admin.id);setError("");setMessage("");
    try{
      const r=await fetch(API+"/super-admin/administrators/"+encodeURIComponent(admin.id)+"/status",{method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({status:next})});
      const d=await r.json().catch(()=>({})) as {message?:string;administrator?:Admin};if(!r.ok)throw new Error(d.message||"Status update failed.");
      setAdmins(old=>old.map(a=>a.id===admin.id?{...a,...d.administrator,status:next}:a));
      setSelected(old=>old?.id===admin.id?{...old,...d.administrator,status:next}:old);setMessage(admin.full_name+" is now "+next.toLowerCase()+".");
    }catch(e){setError(e instanceof Error?e.message:"Status update failed.");}finally{setBusy("");}
  }

  return <div className="sa-admins">
    <header className="saa-header"><div><div className="saa-eyebrow"><span/> GRADLY / ACCESS CONTROL</div><h1>Administrator management</h1><p>Review administrator access, institution and branch assignments, recent sign-ins, and account status.</p></div><button className="saa-refresh" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?"Refreshing…":"Refresh records"}</button></header>
    <section className="saa-metrics">
      <article><span className="purple"><ShieldCheck size={19}/></span><div><small>TOTAL ADMINISTRATORS</small><strong>{admins.length}</strong><p>All registered accounts</p></div></article>
      <article><span className="green"><CheckCircle2 size={19}/></span><div><small>ACTIVE ACCESS</small><strong>{admins.filter(a=>a.status==="ACTIVE").length}</strong><p>Currently active accounts</p></div></article>
      <article><span className="amber"><Clock3 size={19}/></span><div><small>EXPIRING WITHIN 30 DAYS</small><strong>{admins.filter(a=>typeof a.days_until_expiry==="number"&&a.days_until_expiry<=30).length}</strong><p>Adminship expiry watch</p></div></article>
    </section>
    {message&&<div className="saa-message"><CheckCircle2 size={16}/>{message}<button type="button" onClick={()=>setMessage("")}>×</button></div>}
    {error&&<div className="saa-error"><XCircle size={18}/><span>{error}</span><button type="button" onClick={()=>void load()}>Try again</button></div>}
    <section className="saa-directory"><header className="saa-directory-heading"><div><span className="saa-overline">ACCESS DIRECTORY</span><h2>Administrators <span>{filtered.length}</span></h2></div><label className="saa-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, institution…" aria-label="Search administrators"/></label></header>
      <div className="saa-filters">
        <label><Building2 size={14}/><select aria-label="Filter institution" value={institution} onChange={e=>{setInstitution(e.target.value);setBranch("all");}}><option value="all">All institutions</option>{institutions.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><Filter size={14}/><select aria-label="Filter branch" value={branch} onChange={e=>setBranch(e.target.value)}><option value="all">All branches</option>{branches.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><ShieldCheck size={14}/><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select></label><small>{filtered.length} of {admins.length} records</small>
      </div>
      {loading?<div className="saa-empty"><RefreshCw size={22}/><strong>Loading administrator records…</strong></div>:filtered.length===0?<div className="saa-empty"><UserRound size={25}/><strong>No administrators match these filters</strong><p>Try another search or clear the filters.</p><button type="button" onClick={()=>{setSearch("");setInstitution("all");setBranch("all");setStatus("all");}}>Clear filters</button></div>:<div className="saa-table-wrap"><table className="saa-table"><thead><tr><th>ADMINISTRATOR</th><th>INSTITUTION / BRANCH</th><th>ROLE</th><th>STATUS</th><th>LAST ACTIVITY</th><th>ADMINSHIP EXPIRY</th><th/></tr></thead><tbody>{filtered.map(a=><tr key={a.id}>
        <td><button type="button" className="saa-person" onClick={()=>void details(a)}><span className="saa-avatar">{(a.full_name?.[0]||"A").toUpperCase()}</span><span><strong>{a.full_name}</strong><small>{a.admin_code}{a.email?" · "+a.email:""}</small></span></button></td>
        <td><strong>{a.institution_name||"Not assigned"}</strong><small>{a.branch_name||"Institution-level scope"}</small></td><td><span className="saa-role">{label(a.role)}</span></td>
        <td><span className={"saa-status "+(a.status==="ACTIVE"?"active":a.status==="SUSPENDED"?"suspended":"disabled")}><span/>{label(a.status)}</span></td>
        <td><span className="saa-activity"><Activity size={13}/>{dateTime(a.last_login_at)}</span></td><td><strong>{date(a.adminship_expires_at)}</strong><small>{typeof a.days_until_expiry==="number"?a.days_until_expiry+" days remaining":"Expiry not configured"}</small></td>
        <td><button className="saa-details-button" type="button" onClick={()=>void details(a)}>Details ↗</button></td>
      </tr>)}</tbody></table></div>}
    </section>
    {selected&&<div className="saa-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="saa-modal" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title">
      <header><div><span className="saa-overline">ADMIN ACCOUNT / DETAILS</span><h2 id="admin-detail-title">{selected.full_name}</h2><p>{selected.admin_code} · {label(selected.role)}</p></div><button type="button" aria-label="Close details" onClick={()=>setSelected(null)}>×</button></header>
      <div className="saa-detail-status"><span className={"saa-status "+(selected.status==="ACTIVE"?"active":selected.status==="SUSPENDED"?"suspended":"disabled")}><span/>{label(selected.status)}</span><span>{label(selected.registration_status)}</span></div>
      <div className="saa-detail-grid">{[["INSTITUTION",selected.institution_name],["PROGRAM / BRANCH SCOPE",selected.branch_name||"Institution-wide access"],["EMAIL",selected.email],["PHONE",selected.phone_number],["LAST SIGN-IN",dateTime(selected.last_login_at)],["ACCOUNT CREATED",date(selected.created_at)],["ADMINSHIP START",date(selected.adminship_started_at)],["ADMINSHIP EXPIRY",date(selected.adminship_expires_at)]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v||"Not provided"}</strong></div>)}</div>
      <div className="saa-activity-card"><Activity size={17}/><div><strong>Latest recorded activity</strong><p>{selected.last_login_at?"Last sign-in: "+dateTime(selected.last_login_at):"No sign-in timestamp is available."}</p><small>Account record last updated {dateTime(selected.updated_at)}. This screen uses the activity timestamps exposed by the current API.</small></div></div>
      <footer><button type="button" onClick={()=>setSelected(null)}>Close</button>{selected.status!=="DISABLED"&&<button className={selected.status==="ACTIVE"?"suspend":"activate"} type="button" disabled={busy===selected.id} onClick={()=>void toggleStatus(selected)}>{busy===selected.id?"Updating…":selected.status==="ACTIVE"?"Suspend administrator":"Reactivate administrator"}</button>}</footer>
    </section></div>}
  </div>;
}