import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./CommunitiesSuperAdminPage.css";

const API = "https://gradly-communities-api.jugalpkhr.workers.dev";
type Overview = { users: number; groups: number; messages: number; openReports: number; storedMediaBytes: number; mediaStorage: boolean; emailConfigured: boolean };
type AdminRole = { admin_code: string; role: string; granted_at: string; revoked_at?: string | null };
type Report = { id: string; reason: string; status: string; created_at: string; group_name?: string; reporter_name?: string };
type Limits = { maxGroupMemberships:number;maxGroupMembers:number;maxMessageLength:number;messagesPerMinute:number;photosPerMessage:number;photoBytes:number;videoBytes:number;videoSeconds:number;pdfBytes:number;officeBytes:number;userStorageBytes:number;uploadsPerDay:number;videosPerDay:number };

const defaultLimits: Limits = { maxGroupMemberships:20,maxGroupMembers:500,maxMessageLength:5000,messagesPerMinute:10,photosPerMessage:10,photoBytes:5242880,videoBytes:26214400,videoSeconds:120,pdfBytes:15728640,officeBytes:10485760,userStorageBytes:104857600,uploadsPerDay:20,videosPerDay:3 };

async function request(path:string,token:string,options:RequestInit={}) {
  const headers=new Headers(options.headers||{});
  headers.set("Authorization","Bearer "+token);
  headers.set("Accept","application/json");
  if(options.body) headers.set("Content-Type","application/json");
  const response=await fetch(API+path,{...options,headers});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success===false) throw new Error(data.error||"Communities request failed.");
  return data;
}

export default function CommunitiesSuperAdminPage() {
  const navigate=useNavigate();
  const [token]=useState(()=>localStorage.getItem("gradly_super_admin_token")||"");
  const [overview,setOverview]=useState<Overview|null>(null);
  const [admins,setAdmins]=useState<AdminRole[]>([]);
  const [reports,setReports]=useState<Report[]>([]);
  const [limits,setLimits]=useState<Limits>(defaultLimits);
  const [adminCode,setAdminCode]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [bootstrapRequired,setBootstrapRequired]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    if(!token){navigate("/super-admin/login",{replace:true});return;}
    setLoading(true);setError("");
    try {
      const [summary,roleData,reportData,settingsData]=await Promise.all([
        request("/ecosystem/super-admin/overview",token),
        request("/ecosystem/super-admin/admin-roles",token),
        request("/ecosystem/super-admin/reports",token),
        request("/ecosystem/super-admin/settings",token)
      ]);
      setOverview(summary.overview);
      setAdmins(roleData.admins||[]);
      setReports(reportData.reports||[]);
      const limitsRow=(settingsData.settings||[]).find((item:{key:string})=>item.key==="limits");
      if(limitsRow?.value_json) setLimits({...defaultLimits,...JSON.parse(limitsRow.value_json)});
      setBootstrapRequired(false);
    } catch(e) {
      const message=e instanceof Error?e.message:"Unable to load Communities control centre.";
      setError(message);
      setBootstrapRequired(message.toLowerCase().includes("bootstrap"));
    } finally {setLoading(false);}
  },[navigate,token]);

  useEffect(()=>{void load();},[load]);

  const bootstrap=async()=>{
    setBusy(true);setError("");
    try {await request("/ecosystem/super-admin/bootstrap",token,{method:"POST",body:"{}"});setNotice("Your existing Super Admin identity is enabled for Communities.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Bootstrap failed.");}
    finally{setBusy(false);}
  };

  const changeAdminRole=async(action:"grant"|"revoke",targetCode=adminCode)=>{
    if(!targetCode.trim()) return;
    setBusy(true);setError("");
    try {
      await request("/ecosystem/super-admin/admin-roles",token,{method:"POST",body:JSON.stringify({adminCode:targetCode.trim(),action})});
      setNotice(action==="grant"?"Communities Admin access granted.":"Communities Admin access revoked.");
      setAdminCode("");
      await load();
    } catch(e){setError(e instanceof Error?e.message:"Unable to update Admin permission.");}
    finally{setBusy(false);}
  };

  const saveLimits=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError("");
    try {
      await request("/ecosystem/super-admin/settings",token,{method:"PATCH",body:JSON.stringify({key:"limits",value:limits})});
      setNotice("Communities limits saved.");
    } catch(e){setError(e instanceof Error?e.message:"Unable to save limits.");}
    finally{setBusy(false);}
  };

  const resolveReport=async(report:Report,status:"resolved"|"dismissed")=>{
    const reason=window.prompt("Add a short moderation note (optional):")||"";
    setBusy(true);
    try {
      await request("/ecosystem/super-admin/reports/"+report.id+"/resolve",token,{method:"POST",body:JSON.stringify({status,reason})});
      setNotice("Report "+status+".");await load();
    } catch(e){setError(e instanceof Error?e.message:"Unable to resolve report.");}
    finally{setBusy(false);}
  };

  const updateLimit=(key:keyof Limits,value:string)=>{
    setLimits((current)=>({...current,[key]:Number(value)}));
  };

  return <main className="cs-page">
    <header className="cs-header"><div><span>GRADLY ECOSYSTEM / SUPER ADMIN</span><h1>Communities control centre</h1><p>Platform-wide access, moderation and usage policy.</p></div><button onClick={()=>void load()} disabled={loading}>↻ Refresh</button></header>
    {error&&<div className="cs-alert">{error}</div>}{notice&&<div className="cs-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {bootstrapRequired?<section className="cs-card cs-bootstrap"><h2>Enable Communities control</h2><p>Your existing Gradly Super Admin session is valid. This one-time step registers it as the Communities Super Admin identity.</p><button className="primary" onClick={()=>void bootstrap()} disabled={busy}>Enable Super Admin access →</button></section>:<>
      <section className="cs-metrics"><article><small>COMMUNITIES ACCOUNTS</small><strong>{loading?"—":overview?.users??0}</strong></article><article><small>ACTIVE GROUPS</small><strong>{loading?"—":overview?.groups??0}</strong></article><article><small>MESSAGES</small><strong>{loading?"—":overview?.messages??0}</strong></article><article><small>OPEN REPORTS</small><strong>{loading?"—":overview?.openReports??0}</strong></article></section>
      <section className="cs-card"><div className="cs-card-title"><div><span>ACCESS CONTROL</span><h2>Communities Platform Admins</h2><p>Grant access using the existing Gradly Admin ID. Access is independent from academic permissions.</p></div></div>
        <form className="cs-grant-form" onSubmit={(e)=>{e.preventDefault();void changeAdminRole("grant");}}><input value={adminCode} onChange={(e)=>setAdminCode(e.target.value)} placeholder="Enter existing Admin ID" required/><button className="primary" disabled={busy}>Grant access</button></form>
        <div className="cs-admin-list">{admins.map((admin)=><div className="cs-admin-row" key={admin.admin_code}><div><b>{admin.admin_code}</b><small>{admin.role} · {admin.revoked_at?"Revoked":"Active"}</small></div>{!admin.revoked_at&&<button onClick={()=>void changeAdminRole("revoke",admin.admin_code)} disabled={busy}>Revoke</button>}</div>)}{!admins.length&&<p>No Admins have Communities access yet.</p>}</div>
      </section>
      <section className="cs-card"><div className="cs-card-title"><div><span>PLATFORM POLICY</span><h2>Usage limits</h2><p>Limits are enforced by the Communities service. Media controls take effect when R2 uploads are enabled.</p></div></div>
        <form className="cs-limits-grid" onSubmit={saveLimits}>
          {([["maxGroupMemberships","Groups per student"],["maxGroupMembers","Members per group"],["maxMessageLength","Characters per message"],["messagesPerMinute","Messages per minute"],["photosPerMessage","Photos per message"],["photoBytes","Photo size (bytes)"],["videoBytes","Video size (bytes)"],["videoSeconds","Video duration (seconds)"],["pdfBytes","PDF size (bytes)"],["officeBytes","Office file size (bytes)"],["userStorageBytes","Storage per student (bytes)"],["uploadsPerDay","Uploads per day"],["videosPerDay","Videos per day"]] as [keyof Limits,string][]).map(([key,label])=><label key={key}>{label}<input type="number" min="1" value={limits[key]} onChange={(e)=>updateLimit(key,e.target.value)}/></label>)}
          <button className="primary" disabled={busy}>Save platform limits</button>
        </form>
      </section>
      <section className="cs-card"><div className="cs-card-title"><div><span>MODERATION</span><h2>Open reports</h2></div><small>{reports.length} pending</small></div>
        {reports.map((report)=><div className="cs-report-row" key={report.id}><div><b>{report.reason.replaceAll("_"," ")}</b><small>{report.group_name||"Group"} · {report.reporter_name||"Student"} · {new Date(report.created_at).toLocaleString()}</small></div><div><button onClick={()=>void resolveReport(report,"dismissed")} disabled={busy}>Dismiss</button><button className="primary" onClick={()=>void resolveReport(report,"resolved")} disabled={busy}>Resolve</button></div></div>)}
        {!reports.length&&<p className="cs-empty">No open reports.</p>}
      </section>
      <section className="cs-storage-note"><b>Media storage: {overview?.mediaStorage ? "R2 connected" : "Not enabled"}</b><span>{overview?.mediaStorage ? "The private R2 binding is active. Uploaded media is stored in the Communities bucket." : "R2 has not been activated on this Cloudflare account. Storage uploads remain disabled until billing and the private bucket are configured."}</span><span>Email delivery: {overview?.emailConfigured ? "Configured" : "Not configured"}</span></section>
    </>}
  </main>;
}
