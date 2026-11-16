import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, FlaskConical, KeyRound, RefreshCw, ShieldCheck, UserPlus, UserRoundX } from "lucide-react";
import { API_BASE_URL } from "../../lib/superAdminSession";
import "./SuperAdminTesterManagement.css";

type TesterAccount = { id: number; login_id: string; status: "ACTIVE" | "DISABLED"; created_at: string; last_login_at?: string | null };
export default function SuperAdminTesterManagement() {
  const [testers,setTesters]=useState<TesterAccount[]>([]);
  const [loginId,setLoginId]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [created,setCreated]=useState<{loginId:string;password:string}|null>(null);
  const token=localStorage.getItem("gradly_super_admin_token")||"";
  const headers={Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const load=useCallback(async()=>{try{const r=await fetch(API_BASE_URL+"/api/super-admin/testers",{headers:{Authorization:"Bearer "+token}});const d=await r.json();if(!r.ok)throw new Error(d.message||"Could not load tester accounts.");setTesters(Array.isArray(d.testers)?d.testers:[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to connect to Gradly API.");}},[token]);
  useEffect(()=>{void load();},[load]);
  async function create(event:FormEvent){event.preventDefault();setBusy(true);setError("");setNotice("");setCreated(null);try{const r=await fetch(API_BASE_URL+"/api/super-admin/testers",{method:"POST",headers,body:JSON.stringify({loginId:loginId.trim(),password})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Unable to create tester.");setCreated({loginId:d.tester.login_id,password});setLoginId("");setPassword("");setNotice("Tester account created. Copy the credentials now; the password is not shown again.");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to create tester.");}finally{setBusy(false);}}
  async function changeStatus(t:TesterAccount){const status=t.status==="ACTIVE"?"DISABLED":"ACTIVE";try{const r=await fetch(API_BASE_URL+"/api/super-admin/testers/"+t.id+"/status",{method:"PATCH",headers,body:JSON.stringify({status})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Update failed");setTesters(items=>items.map(x=>x.id===t.id?d.tester:x));}catch(e){setError(e instanceof Error?e.message:"Unable to update account.");}}
  async function remove(t:TesterAccount){if(!window.confirm("Permanently delete tester "+t.login_id+"? Their locally saved test cases remain only on their device."))return;try{const r=await fetch(API_BASE_URL+"/api/super-admin/testers/"+t.id,{method:"DELETE",headers});const d=await r.json();if(!r.ok)throw new Error(d.message||"Delete failed");setTesters(items=>items.filter(x=>x.id!==t.id));}catch(e){setError(e instanceof Error?e.message:"Unable to delete tester.");}}
  async function copyCredentials(){if(!created)return;await navigator.clipboard.writeText("Tester ID: "+created.loginId+"\nPassword: "+created.password);setNotice("Credentials copied.");}
  return <section className="tester-admin-page">
    <header className="tester-admin-heading"><div><span className="tester-admin-eyebrow"><FlaskConical size={15}/> CONTROL CENTER / TESTER ACCESS</span><h1>Tester Management</h1><p>Create controlled tester accounts and manage who can access the isolated student preview.</p></div><button className="tester-refresh" onClick={()=>void load()} type="button"><RefreshCw size={16}/> Refresh</button></header>
    <div className="tester-admin-grid">
      <form className="tester-create-card" onSubmit={create}>
        <div className="tester-card-icon"><UserPlus size={21}/></div><h2>Create tester account</h2><p>Assign a unique ID and password. Share these credentials with the tester securely.</p>
        <label htmlFor="tester-id">Tester ID</label><input id="tester-id" value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="e.g. tester_june" minLength={3} maxLength={80} required/>
        <label htmlFor="tester-password">Temporary password</label><input id="tester-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters" minLength={10} maxLength={128} required/>
        <button className="tester-primary" disabled={busy} type="submit">{busy?"Creating…":"Create tester"}</button>
        <small>Passwords are hashed before storage. Academic test cases stay in the tester's browser only.</small>
      </form>
      <div className="tester-account-card">
        <div className="tester-list-title"><div><h2>Tester accounts</h2><p>{testers.length} account{testers.length===1?"":"s"} registered</p></div><span className="tester-count">{testers.filter(t=>t.status==="ACTIVE").length} active</span></div>
        {testers.length===0?<div className="tester-empty"><FlaskConical size={28}/><strong>No testers yet</strong><span>Create the first tester account to grant access.</span></div>:<div className="tester-account-list">{testers.map(t=><article className="tester-account-row" key={t.id}><div className="tester-account-avatar"><KeyRound size={18}/></div><div className="tester-account-meta"><strong>{t.login_id}</strong><span>Created {new Date(t.created_at).toLocaleDateString()} · {t.last_login_at?"Last login "+new Date(t.last_login_at).toLocaleString():"Never signed in"}</span></div><span className={"tester-status "+(t.status==="ACTIVE"?"is-active":"is-disabled")}>{t.status}</span><button type="button" className="tester-row-action" onClick={()=>void changeStatus(t)}>{t.status==="ACTIVE"?"Disable":"Enable"}</button><button type="button" className="tester-row-delete" aria-label={"Delete "+t.login_id} onClick={()=>void remove(t)}><UserRoundX size={16}/></button></article>)}</div>}
      </div>
    </div>
    {created&&<div className="tester-credentials" role="status"><ShieldCheck size={20}/><div><strong>Credentials ready — share them with the tester</strong><span>ID: {created.loginId} · Password: {created.password}</span></div><button type="button" onClick={()=>void copyCredentials()}><Copy size={15}/> Copy</button><button type="button" onClick={()=>setCreated(null)}>Dismiss</button></div>}
    {notice&&<p className="tester-notice" role="status">{notice}</p>}{error&&<p className="tester-error" role="alert">{error}</p>}
  </section>;
}
