import { useEffect, useMemo, useState } from "react";
import type { DiscoveryInstitution } from "./InstitutionDiscovery";

const API=(import.meta.env.VITE_API_BASE_URL||"http://localhost:5000").replace(/\/+$/,"");

type Props={selectedId:string;onSelect:(item:DiscoveryInstitution)=>void;onRequest:()=>void};

export default function GuestInstitutionPicker({selectedId,onSelect,onRequest}:Props){
 const [items,setItems]=useState<DiscoveryInstitution[]>([]);
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 useEffect(()=>{
  let active=true;
  fetch(API+"/api/guest/institutions",{headers:{Accept:"application/json"}})
   .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Unable to load Gradly institutions.");return d;})
   .then(d=>{if(active)setItems((d.institutions||[]).map((x:{id:string;name:string;city?:string;state?:string})=>({...x,branches:[],isInGradly:true,source:"Gradly directory"})));})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load institutions.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(x=>x.name.toLowerCase().includes(q)):items;},[items,query]);
 async function choose(item:DiscoveryInstitution){
  const token=sessionStorage.getItem("gradly_guest_token");
  if(!token){setError("Your guest session has expired. Please create a new Guest ID.");return;}
  setSaving(true);setError("");
  try{
   const response=await fetch(API+"/api/guest/session/institution",{method:"PATCH",headers:{"Content-Type":"application/json","x-guest-session":token,Accept:"application/json"},body:JSON.stringify({institutionId:item.id})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.message||"Unable to save this institution.");
   localStorage.setItem("gradly_guest_institute",item.id);
   localStorage.setItem("gradly_guest_institute_name",item.name);
   onSelect(item);
  }catch(e){setError(e instanceof Error?e.message:"Unable to save institution.");}
  finally{setSaving(false);}
 }
 return <section className="sp-guest-institute-picker" aria-label="Select your institution">
  <label htmlFor="guest-institute-search">Your institution in Gradly</label>
  <input id="guest-institute-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Gradly's institute directory…" />
  {loading&&<p role="status">Loading Gradly institutions…</p>}
  {error&&<p role="alert" className="sp-guest-picker-error">{error}</p>}
  {!loading&&<div className="sp-guest-institute-results">{filtered.slice(0,8).map(item=><button type="button" key={item.id} disabled={saving} className={selectedId===item.id?"selected":""} onClick={()=>void choose(item)}><span><strong>{item.name}</strong><small>{item.city||item.state||"Gradly institute directory"}</small></span><b>{selectedId===item.id?"Selected":"Select"}</b></button>)}
   {filtered.length===0&&<p>No matching institute in Gradly's directory.</p>}
  </div>}
  <button type="button" className="sp-guest-request-link" onClick={onRequest}>Can't find your college? Request to Add College →</button>
 </section>;
}
