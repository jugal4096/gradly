import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search, Inbox, Eye, Filter, X, ExternalLink, Trash2 } from "lucide-react";
import "./SuperAdminRequestCenter.css";
const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"").replace(/\/api$/i,""))+"/api";
type Row={id:string;source:string;requestType:string;title:string;description:string;targetUserId?:string|null;priority:string;status:string;reviewNote?:string|null;acknowledgedAt?:string|null;createdAt:string;adminCode?:string;adminName?:string;adminEmail?:string;institution?:string;program?:string;branch?:string};
type Counts={unattended?:number;unacknowledged?:number;pending?:number;[key:string]:number|undefined};
const label=(s:string)=>String(s||"").replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const date=(s:string)=>s?new Date(s).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";
const legacyPath=(source:string)=>source==="PASSWORD_RESET"?"/super-admin/password-requests":source==="ADMIN_CURRICULUM"?"/super-admin/admin-requests":"/super-admin/feedback";

export default function SuperAdminRequestCenter(){
 const navigate=useNavigate();
 const [rows,setRows]=useState<Row[]>([]),[counts,setCounts]=useState<Counts>({}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[search,setSearch]=useState(""),[status,setStatus]=useState("ALL"),[selected,setSelected]=useState<Row|null>(null),[reviewNote,setReviewNote]=useState(""),[busy,setBusy]=useState(false),[requesterFilter,setRequesterFilter]=useState("ALL"),[requesterNameFilter,setRequesterNameFilter]=useState("ALL"),[deleting,setDeleting]=useState("");
 const token=()=>localStorage.getItem("gradly_super_admin_token")||"";
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const headers={Authorization:"Bearer "+token(),Accept:"application/json"};
   const p=new URLSearchParams();if(search.trim())p.set("search",search.trim());
   const specs=[["platform",API_ROOT+"/super-admin/platform-requests?"+p],["password",API_ROOT+"/admin-password-requests/review"],["curriculum",API_ROOT+"/super-admin/admin-subject-change-requests"],["student",API_ROOT+"/super-admin/student-syllabus-feedback"],["feedback",API_ROOT+"/super-admin/feedback"]] as const;
   const responses=await Promise.all(specs.map(async ([key,url])=>{try{const r=await fetch(url,{headers});const d=await r.json().catch(()=>({}));return {key,data:r.ok?d:null};}catch{return {key,data:null};}}));
   const get=(key:string)=>responses.find(x=>x.key===key)?.data;
   const core=get("platform");if(!core)throw new Error("Request Center API unavailable. Check backend deployment and database migration.");
   const platform=(Array.isArray(core.requests)?core.requests:[]).map((r:Row)=>({...r,source:"ADMIN_REQUEST"}));
   const pw=get("password");
   const password=(Array.isArray(pw?.requests)?pw.requests:[]).map((r:Record<string,unknown>)=>({id:"password-"+String(r.id),source:"PASSWORD_RESET",requestType:"PASSWORD_RESET",title:"Admin password reset · "+String(r.admin_code||"Admin"),description:"Password reset request from "+String(r.admin_email||"")+" · "+String(r.full_name||""),priority:"NORMAL",status:String(r.status||"PENDING"),createdAt:String(r.created_at||""),adminCode:String(r.admin_code||""),adminName:String(r.full_name||""),institution:String(r.institution_name||""),reviewNote:r.review_note?String(r.review_note):null}));
   const cr=get("curriculum");
   const curriculum=(Array.isArray(cr?.requests)?cr.requests:[]).map((r:Record<string,unknown>)=>({id:"curriculum-"+String(r.id),source:"ADMIN_CURRICULUM",requestType:String(r.requestType||"CURRICULUM_CHANGE"),title:"Admin curriculum · "+String(r.requestType||"Change"),description:String(r.reason||"")+(r.proposedChanges?"\\nProposed: "+JSON.stringify(r.proposedChanges):""),priority:"NORMAL",status:String(r.status||"PENDING"),createdAt:String(r.createdAt||""),adminCode:String(r.adminCode||""),adminName:String(r.adminName||""),institution:String(r.institution||""),program:String(r.program||""),branch:String(r.department||""),reviewNote:r.reviewNote?String(r.reviewNote):null}));
   const sf=get("student");
   const student=(Array.isArray(sf?.feedback)?sf.feedback:[]).map((r:Record<string,unknown>)=>({id:"student-"+String(r.id),source:"STUDENT_SYLLABUS",requestType:String(r.requestType||"SYLLABUS_FEEDBACK"),title:"Student syllabus · "+String(r.subjectName||"Feedback"),description:String(r.message||""),priority:"NORMAL",status:String(r.status||"FORWARDED"),createdAt:String(r.createdAt||""),institution:String(r.institutionName||""),program:String(r.programName||""),branch:String(r.branchName||""),adminName:String(r.studentName||r.userName||r.name||"Student / user"),adminEmail:String(r.email||""),reviewNote:r.adminReviewNote?String(r.adminReviewNote):null}));
   const fb=get("feedback");
   const feedback=(Array.isArray(fb?.feedback)?fb.feedback:[]).map((r:Record<string,unknown>)=>({id:(String(r.request_source)==="institution"?"institution-":"feedback-")+String(r.id),source:String(r.request_source)==="institution"?"INSTITUTION_REQUEST":"USER_FEEDBACK",requestType:String(r.category||r.type||"USER_FEEDBACK"),title:String(r.subject||r.title||"User feedback"),description:String(r.message||r.description||""),priority:"NORMAL",status:String(r.status||"PENDING"),createdAt:String(r.created_at||""),adminName:String(r.name||"Student / user"),adminEmail:String(r.email||"")}));
   const merged=[...platform,...password,...curriculum,...student,...feedback] as Row[];
   const filtered=merged.filter(r=>status==="ALL"||r.status.toUpperCase()===status);
   setRows(filtered.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()));setCounts(core.counts||{});setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load Request Center.");}
  finally{setLoading(false);}
 },[search,status]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),45000);return()=>window.clearInterval(timer);},[load]);
 const open=useMemo(()=>rows.filter(r=>["PENDING","IN_REVIEW","NEEDS_INFO","FORWARDED","REVIEWED"].includes(r.status.toUpperCase())).length,[rows]);
 const requesterOptions=useMemo(()=>{const isAdmin=(r:Row)=>["ADMIN_REQUEST","PASSWORD_RESET","ADMIN_CURRICULUM"].includes(r.source);const list=rows.filter(r=>requesterFilter==="ALL"||(requesterFilter==="ADMIN"?isAdmin(r):!isAdmin(r)));const pairs=list.map(r=>{const value=requesterFilter==="ADMIN"?(r.adminCode||r.adminEmail||r.adminName||"Unknown Admin"):(r.adminEmail||r.adminName||r.targetUserId||"Unknown user");return [value,value] as const;});return Array.from(new Map(pairs).entries()).map(([value,label])=>({value,label}));},[rows,requesterFilter]);
 const visibleRows=useMemo(()=>rows.filter(r=>{
  const isAdmin=["ADMIN_REQUEST","PASSWORD_RESET","ADMIN_CURRICULUM"].includes(r.source);
  if(requesterFilter==="ADMIN"&&!isAdmin)return false;
  if(requesterFilter==="USER"&&isAdmin)return false;
  if(requesterNameFilter!=="ALL"){const identity=requesterFilter==="ADMIN"?(r.adminCode||r.adminEmail||r.adminName||"Unknown Admin"):(r.adminEmail||r.adminName||r.targetUserId||"Unknown user");if(identity!==requesterNameFilter)return false;}
  const q=search.trim().toLowerCase();
  return !q||[r.title,r.description,r.adminName,r.adminCode,r.adminEmail,r.institution,r.program,r.branch,r.targetUserId].some(v=>String(v||"").toLowerCase().includes(q));
 }),[rows,requesterFilter,requesterNameFilter,search]);
 async function deleteRequest(row:Row){
  const sourceMap:Record<string,string>={ADMIN_REQUEST:"platform",PASSWORD_RESET:"password",ADMIN_CURRICULUM:"curriculum",STUDENT_SYLLABUS:"student",USER_FEEDBACK:"feedback",INSTITUTION_REQUEST:"institution"};
  const source=sourceMap[row.source];if(!source)return;
  if(!window.confirm("Delete this request record? A deletion audit entry will be retained."))return;
  const rawId=row.source==="ADMIN_REQUEST"?row.id:row.id.slice(row.id.indexOf("-")+1);
  setDeleting(row.id);setError("");
  try{
   const r=await fetch(API_ROOT+"/super-admin/platform-requests/"+source+"/"+encodeURIComponent(rawId),{method:"DELETE",headers:{Authorization:"Bearer "+token()}});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||d.success===false)throw new Error(d.message||"Unable to delete request.");
   if(selected?.id===row.id)setSelected(null);
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to delete request.");}
  finally{setDeleting("");}
 }
 async function act(next:string){
  if(!selected)return;if(reviewNote.trim().length<3){setError("Add a short review note before updating this request.");return;}
  setBusy(true);
  try{const r=await fetch(API_ROOT+"/super-admin/platform-requests/"+encodeURIComponent(selected.id)+"/review",{method:"PATCH",headers:{Authorization:"Bearer "+token(),"Content-Type":"application/json"},body:JSON.stringify({status:next,reviewNote})});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||"Unable to update request.");setSelected(null);setReviewNote("");await load();}
  catch(e){setError(e instanceof Error?e.message:"Unable to update request.");}finally{setBusy(false);}
 }
 async function acknowledge(row:Row){if(row.source!=="ADMIN_REQUEST"||row.acknowledgedAt)return;await fetch(API_ROOT+"/super-admin/platform-requests/"+encodeURIComponent(row.id)+"/acknowledge",{method:"PATCH",headers:{Authorization:"Bearer "+token()}});void load();}
 return <main className="sa-requests">
  <header><div><span>OPERATIONS / UNIFIED INBOX</span><h1>Request Center</h1><p>Admin requests, password resets, student syllabus feedback and user feedback in one place.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></header>
  <section className="sa-request-stats"><article><span>Unattended Admin requests</span><strong>{counts.unattended??open}</strong><small>New request workflow</small></article><article><span>New / unacknowledged</span><strong>{counts.unacknowledged??0}</strong><small>Not yet acknowledged</small></article><article><span>Pending</span><strong>{counts.pending??0}</strong><small>Awaiting first review</small></article></section>
  <section className="sa-request-toolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, Admin, user ID…"/></label><label><Filter size={15}/><select value={requesterFilter} onChange={e=>{setRequesterFilter(e.target.value);setRequesterNameFilter("ALL");}}><option value="ALL">Admin + User requests</option><option value="ADMIN">Admin-wise requests</option><option value="USER">User-wise requests</option></select></label><label><Filter size={15}/><select value={requesterNameFilter} onChange={e=>setRequesterNameFilter(e.target.value)}><option value="ALL">All requesters</option>{requesterOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label><Filter size={15}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="IN_REVIEW">In review</option><option value="NEEDS_INFO">Needs information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="COMPLETED">Completed</option><option value="FORWARDED">Forwarded</option></select></label></section>
  {error&&<p className="sa-request-error">{error}</p>}
  <section className="sa-request-table"><div className="sa-request-table-head"><strong><Inbox size={17}/> {requesterFilter==="ADMIN"?"Admin requests":requesterFilter==="USER"?"User requests":"All incoming requests"}</strong><span>{visibleRows.length} shown</span></div>
   {loading?<p className="sa-request-empty">Loading requests…</p>:visibleRows.length===0?<p className="sa-request-empty">No requests found for this filter.</p>:visibleRows.map(row=><article key={row.id} className={row.source==="ADMIN_REQUEST"&&!row.acknowledgedAt?"is-new":""}><div className="sa-request-main"><div className="sa-request-title"><strong>{row.title}</strong><span className={"priority-"+row.priority.toLowerCase()}>{row.priority}</span></div><p>{row.description}</p><small>{label(row.source)} · {label(row.requestType)} · {row.adminName||row.adminCode||"User"} · {row.institution||"Institution not set"} / {row.program||"—"} / {row.branch||"—"}</small><small>{date(row.createdAt)}{row.targetUserId?" · User ID: "+row.targetUserId:""}</small></div><div className="sa-request-actions"><span className={"status-"+row.status.toLowerCase()}>{label(row.status)}</span><div className="sa-request-row-buttons"><button onClick={()=>{setSelected(row);setReviewNote(row.reviewNote||"");void acknowledge(row);}}><Eye size={14}/> Review</button><button className="sa-request-delete" disabled={deleting===row.id} onClick={()=>void deleteRequest(row)}><Trash2 size={14}/>{deleting===row.id?"Deleting…":"Delete"}</button></div></div></article>)}
  </section>
  {selected&&<div className="sa-request-overlay" onClick={()=>setSelected(null)}><section role="dialog" aria-modal="true" className="sa-request-drawer" onClick={e=>e.stopPropagation()}><header><div><span>REQUEST DETAIL / {label(selected.source)}</span><h2>{selected.title}</h2><p>{label(selected.requestType)} · {date(selected.createdAt)}</p></div><button onClick={()=>setSelected(null)} aria-label="Close"><X size={18}/></button></header>
   <dl><div><dt>Submitted by</dt><dd>{selected.adminName||selected.adminCode||"Student / user"} {selected.adminEmail?"("+selected.adminEmail+")":""}</dd></div><div><dt>Institution / scope</dt><dd>{[selected.institution,selected.program,selected.branch].filter(Boolean).join(" / ")||"—"}</dd></div><div><dt>Priority / status</dt><dd>{label(selected.priority)} · {label(selected.status)}</dd></div><div><dt>Target user ID</dt><dd>{selected.targetUserId||"—"}</dd></div><div><dt>Details</dt><dd className="request-description">{selected.description}</dd></div></dl>
   {selected.source==="ADMIN_REQUEST"?<><label className="sa-request-review-note">Review note<textarea rows={4} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Explain the decision or next step…"/></label><div className="sa-request-decision"><button disabled={busy} onClick={()=>void act("IN_REVIEW")}>Mark in review</button><button disabled={busy} onClick={()=>void act("NEEDS_INFO")}>Request info</button><button disabled={busy} onClick={()=>void act("APPROVED")}>Approve</button><button disabled={busy} onClick={()=>void act("REJECTED")}>Reject</button><button disabled={busy} onClick={()=>void act("COMPLETED")}>Complete</button></div><p className="sa-request-safety">Approval records the decision and notifies the Admin. It does not automatically disable, reactivate or delete an account; perform the action through User Management after reviewing the target.</p></>:<><p className="sa-request-safety">This request retains its existing approval rules and audit history. Continue the review in its original workflow.</p><div className="sa-request-decision"><button onClick={()=>navigate(legacyPath(selected.source))}><ExternalLink size={14}/> Open existing review workflow</button><button className="sa-request-delete" disabled={deleting===selected.id} onClick={()=>void deleteRequest(selected)}><Trash2 size={14}/>{deleting===selected.id?"Deleting…":"Delete request"}</button></div></>}
  </section></div>}
 </main>;
}
