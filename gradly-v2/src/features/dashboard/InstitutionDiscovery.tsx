import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import "./InstitutionDiscovery.css";

const API=(import.meta.env.VITE_API_BASE_URL||"http://localhost:5000").replace(/\/+$/,"");
export type DiscoveryInstitution={id:string;name:string;city?:string;state?:string;website?:string|null;type?:string;source?:string;isInGradly?:boolean;externalId?:string;branches?:Array<{id:string;name:string;code?:string|null;program_id:string;program_name:string;program_level?:string|null}>};
type Props={isGuest:boolean;user:User|null;onSelect:(item:DiscoveryInstitution)=>void;selectedId?:string};

export default function InstitutionDiscovery({isGuest,user,onSelect,selectedId}:Props){
 const [query,setQuery]=useState(""),[state,setState]=useState(""),[city,setCity]=useState(""),[district,setDistrict]=useState(""),[affiliation,setAffiliation]=useState(""),[type,setType]=useState("");
 const [items,setItems]=useState<DiscoveryInstitution[]>([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [requestOpen,setRequestOpen]=useState(false),[submitting,setSubmitting]=useState(false),[requestError,setRequestError]=useState(""),[submitted,setSubmitted]=useState<{id:string;status:string}|null>(null);
 const [form,setForm]=useState({institutionName:"",state:"",city:"",district:"",institutionType:"Engineering college",affiliation:"",website:"",additionalInfo:""});
 useEffect(()=>{
  const timer=window.setTimeout(()=>{void search(1);},350);
  return()=>window.clearTimeout(timer);
 },[query,state,city,district,affiliation,type]);
 async function search(next:number){
  if(query.trim().length<2&&!state&&!city&&!district&&!affiliation&&!type){setItems([]);setHasMore(false);setError("");return;}
  setLoading(true);setError("");
  try{
   const p=new URLSearchParams({q:query.trim(),state,city,district,affiliation,type,page:String(next),limit:"20"});
   const r=await fetch(API+"/api/guest/institution-search?"+p.toString(),{headers:{Accept:"application/json"}});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.message||"Institution search failed.");
   setItems(d.institutions||[]);setPage(next);setHasMore(Boolean(d.hasMore));
  }catch(e){setError(e instanceof Error?e.message:"Unable to search institutions.");setItems([]);setHasMore(false);}
  finally{setLoading(false);}
 }
 function openRequest(prefill?:DiscoveryInstitution){
  setForm(f=>({...f,institutionName:prefill?.name||query,state:prefill?.state||state,city:prefill?.city||city,institutionType:prefill?.type||"Engineering college",website:prefill?.website||""}));
  setRequestError("");setSubmitted(null);setRequestOpen(true);
 }
 async function submit(e:FormEvent){
  e.preventDefault();setSubmitting(true);setRequestError("");
  try{
   const headers:Record<string,string>={"Content-Type":"application/json","Accept":"application/json"};
   if(user)headers.Authorization="Bearer "+await user.getIdToken();
   const r=await fetch(API+"/api/guest/institution-requests",{method:"POST",headers,body:JSON.stringify({...form,guestId:isGuest?localStorage.getItem("gradly_guest_id")||"":""})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.message||"Unable to submit institution request.");
   const id=String(d.request?.id||"");
   setSubmitted({id,status:String(d.request?.status||"PENDING")});
  }catch(e){setRequestError(e instanceof Error?e.message:"Unable to submit request.");}
  finally{setSubmitting(false);}
 }
 return <div className="id-discovery">
  <div className="id-search-grid">
   <label className="id-search-main"><span>Search all-India institution discovery</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Institute, university or college name…" /></label>
   <label><span>State / UT</span><input value={state} onChange={e=>setState(e.target.value)} placeholder="e.g. Maharashtra"/></label>
   <label><span>City</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="City"/></label>
   <label><span>District</span><input value={district} onChange={e=>setDistrict(e.target.value)} placeholder="District"/></label>
   <label><span>Affiliation</span><input value={affiliation} onChange={e=>setAffiliation(e.target.value)} placeholder="University / board"/></label>
   <label><span>Institution type</span><select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option><option>University</option><option>Engineering college</option><option>Autonomous college</option><option>College</option><option>Institute of national importance</option><option>Other</option></select></label>
  </div>
  {loading&&<p className="id-state" role="status">Searching institution sources…</p>}
  {error&&<div className="id-error" role="alert">{error}<button type="button" onClick={()=>void search(1)}>Retry</button></div>}
  {!loading&&!error&&items.length>0&&<div className="id-results" aria-live="polite">{items.map(item=><article className="id-result" key={item.id}><div><strong>{item.name}</strong><p>{[item.city,item.state].filter(Boolean).join(", ")||"Location not listed"} · {item.type||"Higher education institution"}</p><small>{item.source||"Institution directory"}{item.isInGradly?" · In Gradly directory":""}</small></div><button type="button" onClick={()=>item.isInGradly||isGuest?onSelect(item):openRequest(item)}>{item.isInGradly||isGuest?(selectedId===item.id?"Selected":"Select institution"):"Request to add"}</button></article>)}
   <div className="id-result-footer"><span>Search results may not represent a complete official register.</span>{hasMore&&<button type="button" disabled={loading} onClick={()=>void search(page+1)}>Load more</button>}</div></div>}
  {!loading&&!error&&items.length===0&&(query.length>=2||state||city||district||affiliation||type)&&<div className="id-empty">No matching institution found. <button type="button" onClick={()=>openRequest()}>Request to add this institution</button></div>}
  <div className="id-discovery-foot"><span>Not listed?</span><button type="button" onClick={()=>openRequest()}>＋ Request to add institution</button></div>
  {requestOpen&&<div className="id-modal-backdrop"><section className="id-modal" role="dialog" aria-modal="true" aria-labelledby="id-request-title"><header><div><span>INSTITUTION DIRECTORY</span><h3 id="id-request-title">Request an institution</h3><p>Submit verified details for the Gradly team to review.</p></div><button type="button" aria-label="Close" onClick={()=>setRequestOpen(false)}>×</button></header>
   {submitted?<div className="id-success" role="status"><strong>Request submitted</strong><p>Your request is now in the Super Admin review queue.</p><code>{submitted.id}</code><small>Status: {submitted.status}</small><button type="button" onClick={()=>setRequestOpen(false)}>Done</button></div>:<form onSubmit={submit}>
    <label>Institution name<input required minLength={2} maxLength={160} value={form.institutionName} onChange={e=>setForm({...form,institutionName:e.target.value})}/></label>
    <div className="id-form-grid"><label>State / UT<input required value={form.state} onChange={e=>setForm({...form,state:e.target.value})}/></label><label>City<input required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label>District<input value={form.district} onChange={e=>setForm({...form,district:e.target.value})}/></label><label>Institution type<select value={form.institutionType} onChange={e=>setForm({...form,institutionType:e.target.value})}><option>Engineering college</option><option>University</option><option>Autonomous college</option><option>College</option><option>Institute of national importance</option><option>Standalone institution</option><option>Other</option></select></label></div>
    <label>Affiliating university / body<input value={form.affiliation} onChange={e=>setForm({...form,affiliation:e.target.value})} placeholder="Optional"/></label>
    <label>Official website<input type="url" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} placeholder="https://…"/></label>
    <label>Additional information<textarea rows={3} maxLength={2000} value={form.additionalInfo} onChange={e=>setForm({...form,additionalInfo:e.target.value})} placeholder="Anything that helps verify this institution"/></label>
    {requestError&&<p className="id-error" role="alert">{requestError}</p>}
    <footer><button type="button" onClick={()=>setRequestOpen(false)}>Cancel</button><button type="submit" disabled={submitting}>{submitting?"Submitting…":"Submit request"}</button></footer>
   </form>}
  </section></div>}
 </div>;
}
