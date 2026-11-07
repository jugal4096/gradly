import { useEffect, useState, type FormEvent } from "react";
import "./GuestOnboarding.css";

const API=(import.meta.env.VITE_API_BASE_URL||"http://localhost:5000").replace(/\/+$/,"");
const ID_KEY="gradly_guest_id";
const REQUEST_KEY="gradly_guest_institute_request_token";
type Institution={id:string;name:string};
type SearchInstitution={externalId:string;name:string;city:string;region:string;country:string};
type RequestStatus={id:string;college_name:string;locality:string;guest_id?:string;status:string;created_at:string};

let institutionRequest:Promise<Institution[]>|null=null;
function loadInstitutions(){
  if(!institutionRequest){
    institutionRequest=fetch(API+"/api/guest/institutions")
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"Could not load institutions.");return Array.isArray(data.institutions)?data.institutions:[];})
      .catch(error=>{institutionRequest=null;throw error;});
  }
  return institutionRequest;
}

export default function GuestOnboarding({onComplete}:{onComplete:()=>void}){
 const [guestId,setGuestId]=useState(()=>localStorage.getItem(ID_KEY)||"");
 const [institutions,setInstitutions]=useState<Institution[]>([]);
 const [institutionsLoading,setInstitutionsLoading]=useState(false);
 const [institutionsLoaded,setInstitutionsLoaded]=useState(false);
 const [selected,setSelected]=useState("");
 const [query,setQuery]=useState("");
 const [searchResults,setSearchResults]=useState<SearchInstitution[]>([]);
 const [searching,setSearching]=useState(false);
 const [external,setExternal]=useState<SearchInstitution|null>(null);
 const [college,setCollege]=useState("");
 const [locality,setLocality]=useState("");
 const [status,setStatus]=useState<RequestStatus|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [checking,setChecking]=useState(false);
 const [step,setStep]=useState<"identity"|"institution"|"pending">("identity");
 const normalized=guestId.trim().toUpperCase();
 const valid=/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(normalized);

 useEffect(()=>{
   if(step!=="institution"||institutionsLoaded||institutionsLoading)return;
   let active=true;
   setInstitutionsLoading(true);
   loadInstitutions().then(data=>{if(active)setInstitutions(data);})
     .catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load institutions.");})
     .finally(()=>{if(active){setInstitutionsLoading(false);setInstitutionsLoaded(true);}});
   return()=>{active=false;};
 },[step,institutionsLoaded,institutionsLoading]);

 useEffect(()=>{
   const trimmed=query.trim();
   if(trimmed.length<2||external){setSearchResults([]);setSearching(false);return;}
   const controller=new AbortController();
   const timer=window.setTimeout(()=>{
     setSearching(true);
     fetch(API+"/api/guest/institution-search?q="+encodeURIComponent(trimmed),{signal:controller.signal})
       .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||"Search unavailable.");return d;})
       .then(d=>setSearchResults(Array.isArray(d.institutions)?d.institutions:[]))
       .catch(e=>{if(e.name!=="AbortError")setSearchResults([]);})
       .finally(()=>{if(!controller.signal.aborted)setSearching(false);});
   },250);
   return()=>{window.clearTimeout(timer);controller.abort();};
 },[query,external]);

 async function refreshStatus(){
   const token=localStorage.getItem(REQUEST_KEY);
   if(!token)return;
   setChecking(true);setError("");
   try{
     const r=await fetch(API+"/api/guest/institution-requests/status",{headers:{"x-request-tracking-token":token}});
     const d=await r.json();if(!r.ok)throw new Error(d.message||"Could not retrieve request status.");
     setStatus(d.request);setStep("pending");
   }catch(e){setError(e instanceof Error?e.message:"Could not retrieve request status.");}
   finally{setChecking(false);}
 }
 useEffect(()=>{if(localStorage.getItem(REQUEST_KEY))void refreshStatus();},[]);

 async function submitRequest(e:FormEvent){
   e.preventDefault();setError("");setLoading(true);
   try{
     const r=await fetch(API+"/api/guest/institution-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({collegeName:external?.name||college,locality:external?.city||locality,guestId:normalized,externalInstitutionId:external?.externalId||""})});
     const d=await r.json();if(!r.ok)throw new Error(d.message||"Request could not be submitted.");
     localStorage.setItem(REQUEST_KEY,d.trackingToken);localStorage.setItem(ID_KEY,normalized);
     setStatus(d.request);setStep("pending");
   }catch(e){setError(e instanceof Error?e.message:"Request could not be submitted.");}
   finally{setLoading(false);}
 }
 async function startGuest(){
   setError("");setLoading(true);
   try{
     const r=await fetch(API+"/api/guest/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guestId:normalized,institutionId:selected})});
     const d=await r.json();if(!r.ok)throw new Error(d.message||"Unable to create your guest workspace.");
     const institution=institutions.find(item=>item.id===selected);
     localStorage.setItem(ID_KEY,d.guest.guestId);
     localStorage.setItem("gradly_guest_session_token",d.guest.sessionToken);
     localStorage.setItem("gradly_guest_institute",d.guest.institutionId);
     if(institution)localStorage.setItem("gradly_guest_institute_name",institution.name);
     localStorage.removeItem(REQUEST_KEY);onComplete();
   }catch(e){setError(e instanceof Error?e.message:"Unable to create your guest workspace.");}
   finally{setLoading(false);}
 }
 const goToInstitution=()=>{if(!valid)return;localStorage.setItem(ID_KEY,normalized);setError("");setStep("institution");};
 const progress=step==="identity"?33:step==="institution"?72:100;

 if(step==="pending")return <main className="guest-onboard guest-pending-screen">
   <div className="guest-topline"><a className="guest-brand" href="#"><span className="guest-brand-mark">G</span><span>gradly<small>STUDENT SPACE</small></span></a><span className="guest-secure"><i/> PRIVATE GUEST ACCESS</span></div>
   <section className="guest-panel guest-status-panel">
     <div className="guest-status-icon">⌛</div><span className="guest-eyebrow">INSTITUTION REVIEW</span>
     <h1>Your college is<br/><em>under review.</em></h1>
     <p className="guest-lead">Your request has been received. Keep this browser available to check its progress.</p>
     <div className="guest-request-card"><div><span>REQUEST STATUS</span><strong>{status?.status?.replace(/_/g," ")||"PENDING"}</strong></div><small>{status?.college_name} · {status?.locality}</small><small>Guest ID: {normalized||status?.guest_id}</small></div>
     <div className="guest-actions"><button className="guest-button guest-button-primary" disabled={checking} onClick={()=>void refreshStatus()}>{checking?"Checking request…":"Refresh request status"}</button><button className="guest-button guest-button-light" onClick={()=>{setStep("institution");setStatus(null);}}>Choose another institution</button></div>
     {error&&<p className="guest-error" role="alert">{error}</p>}
   </section>
 </main>;

 return <main className="guest-onboard">
   <div className="guest-topline"><a className="guest-brand" href="#"><span className="guest-brand-mark">G</span><span>gradly<small>STUDENT SPACE</small></span></a><span className="guest-secure"><i/> PRIVATE GUEST ACCESS</span></div>
   <div className="guest-layout">
     <section className="guest-story">
       <div className="guest-story-content">
         <span className="guest-eyebrow">YOUR ACADEMIC JOURNEY, STARTS HERE</span>
         <h1>Make room for<br/><em>what’s next.</em></h1>
         <p>A calmer, clearer way to understand your academic performance. Start with the essentials. Unlock the full Gradly experience whenever you're ready.</p>
         <div className="guest-story-stats"><div><strong>01</strong><span>Set your identity</span></div><div><strong>02</strong><span>Choose your college</span></div><div><strong>03</strong><span>Start calculating</span></div></div>
       </div>
       <div className="guest-orbit-art" aria-hidden="true"><div className="guest-orbit-ring ring-one"/><div className="guest-orbit-ring ring-two"/><div className="guest-orbit-glow"/><div className="guest-orbit-core">G<span>✦</span></div><div className="guest-float-card card-top"><small>ACADEMIC CLARITY</small><strong>One step at a time.</strong></div><div className="guest-float-card card-bottom"><span>SGPA</span><strong>10.00</strong><small>YOUR GOAL IS IN REACH</small></div></div>
       <div className="guest-story-foot"><span>GRADLY · STUDENT EDITION</span><span>LEARN / PLAN / GROW</span></div>
     </section>

     <section className="guest-panel">
       <div className="guest-panel-head"><div><span className="guest-eyebrow">GUEST WORKSPACE SETUP</span><h2>{step==="identity"?"Let’s get you started.":"Find your academic home."}</h2><p>{step==="identity"?"Create a unique Guest ID. It will identify your calculator workspace.":"Choose your institution to finish setting up your guest workspace."}</p></div><span className="guest-step-count">0{step==="identity"?1:2}<small> / 02</small></span></div>
       <div className="guest-progress"><i style={{width:progress+"%"}}/></div>
       <div className="guest-step-caption"><span>{step==="identity"?"YOUR IDENTITY":"YOUR INSTITUTION"}</span><span>{step==="identity"?"STEP 1 OF 2":"STEP 2 OF 2"}</span></div>

       {step==="identity"?<form className="guest-form" onSubmit={e=>{e.preventDefault();goToInstitution();}}>
         <label className="guest-label" htmlFor="guest-id">Choose your Guest ID</label>
         <div className="guest-id-input-wrap"><span>@</span><input id="guest-id" className="guest-input" value={guestId} onChange={e=>setGuestId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,24))} placeholder="e.g. JUGAL2026" maxLength={24} autoComplete="off" autoFocus/><b className={valid?"valid":""}>{valid?"✓":"—"}</b></div>
         <div className="guest-field-meta"><span>4–24 characters</span><span>Letters, numbers, _ or -</span></div>
         <div className="guest-info-note"><span>✦</span><p>Your ID is checked for uniqueness when your workspace is created. No waiting for a separate validation request.</p></div>
         <button className="guest-button guest-button-primary" disabled={!valid||loading}>Continue <span>→</span></button>
       </form>:<div className="guest-form">
         <div className="guest-id-chip"><span>YOUR GUEST ID</span><strong>@{normalized}</strong><button type="button" onClick={()=>setStep("identity")}>Edit</button></div>
         <label className="guest-label" htmlFor="guest-institution">Select your institution</label>
         <select id="guest-institution" className="guest-input guest-select" value={selected} onChange={e=>setSelected(e.target.value)} disabled={institutionsLoading}>
           <option value="">{institutionsLoading?"Loading institutions…":"Choose an institution"}</option>
           {institutions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
         </select>
         {!institutionsLoading&&institutions.length===0&&<button type="button" className="guest-retry" onClick={()=>{institutionRequest=null;setInstitutionsLoaded(false);}}>Institution list unavailable · Retry</button>}
         <button className="guest-button guest-button-primary" disabled={!selected||loading||institutionsLoading} onClick={()=>void startGuest()}>{loading?"Creating your workspace…":"Enter my workspace"} <span>→</span></button>
         <div className="guest-divider"><span/> OR <span/></div>
         <div className="guest-request-box">
           <div className="guest-request-heading"><div><h3>Can’t find your college?</h3><p>Search the directory or request an institution to be added.</p></div><span>+</span></div>
           <div className="guest-search-wrap"><input className="guest-input" value={query} onChange={e=>{setQuery(e.target.value);setExternal(null);}} placeholder="Search college or university…"/>{searching&&<span className="guest-search-spinner"/>}</div>
           {searchResults.length>0&&<div className="guest-search-results">{searchResults.map(item=><button type="button" key={item.externalId} onClick={()=>{setExternal(item);setCollege(item.name);setLocality(item.city||item.region||"India");setQuery(item.name);setSearchResults([]);}}><strong>{item.name}</strong><small>{[item.city,item.region,item.country].filter(Boolean).join(", ")}</small></button>)}</div>}
           <form onSubmit={submitRequest} className="guest-request-form">
             <label className="guest-label" htmlFor="guest-college">Institution name</label><input id="guest-college" className="guest-input" required minLength={2} value={external?.name||college} onChange={e=>{setExternal(null);setCollege(e.target.value);}} placeholder="College or university name"/>
             <label className="guest-label" htmlFor="guest-locality">City / locality</label><input id="guest-locality" className="guest-input" required minLength={2} value={external?.city||locality} onChange={e=>{setExternal(null);setLocality(e.target.value);}} placeholder="City, district or locality"/>
             <button className="guest-button guest-button-light" disabled={loading}>{loading?"Submitting request…":"Request institution review"}</button>
           </form>
         </div>
       </div>}
       {error&&<p className="guest-error" role="alert">{error}</p>}
       <div className="guest-panel-foot"><span>GUEST ACCESS INCLUDES</span><strong>SGPA & CGPA calculators</strong><p>Sign in to unlock planners, progress insights, community and AI tools.</p></div>
     </section>
   </div>
   <footer className="guest-page-foot"><span>© GRADLY · YOUR ACADEMIC COMPANION</span><span>BUILT FOR STUDENT MOMENTUM</span></footer>
 </main>;
}
