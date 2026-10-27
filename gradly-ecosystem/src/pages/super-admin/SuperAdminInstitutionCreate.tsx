import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import "./SuperAdminInstitutionCreate.css";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
type Branch = { id: string; name: string };
type Program = { id: string; name: string; branches?: Branch[] };
type Institution = { id: string; name: string; programs: Program[] };
type Mode = "institution" | "syllabus";

export default function SuperAdminInstitutionCreate() {
  const [mode,setMode] = useState<Mode>("institution");
  const [institutions,setInstitutions] = useState<Institution[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [institution,setInstitution] = useState({name:"",city:"",state:"",country:"India",programName:"",programCode:"",programLevel:"",branchName:"",branchCode:""});
  const [syllabus,setSyllabus] = useState({institutionId:"",programId:"",branchId:"",version:"1",semesterCount:"8",subjectsText:""});
  const selectedInstitution = institutions.find(item=>item.id===syllabus.institutionId);
  const programs = selectedInstitution?.programs ?? [];
  const selectedProgram = programs.find(item=>item.id===syllabus.programId);
  const branches = selectedProgram?.branches ?? [];
  const headers = useMemo(()=>({Authorization:"Bearer "+(localStorage.getItem("gradly_super_admin_token")||""),Accept:"application/json"}),[]);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const response=await fetch(API_ROOT+"/super-admin/institutions",{headers});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.message||"Could not load institutions.");
      setInstitutions(Array.isArray(data.institutions)?data.institutions:[]);
    } catch(e) { setError(e instanceof Error?e.message:"Could not load institutions."); }
    finally { setLoading(false); }
  }, [headers]);
  useEffect(()=>{void loadInstitutions();},[loadInstitutions]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const isInstitution=mode==="institution";
      if(isInstitution && Boolean(institution.programName.trim())!==Boolean(institution.branchName.trim())) throw new Error("Enter both program and branch names, or leave both blank.");
      const response=await fetch(API_ROOT+"/super-admin/institutions"+(isInstitution?"":"/syllabus"),{
        method:"POST",headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify(isInstitution?institution:syllabus),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.message||"Could not save this record.");
      setNotice(data.message||(isInstitution?"Institution created.":"Syllabus created."));
      if(isInstitution) setInstitution({name:"",city:"",state:"",country:"India",programName:"",programCode:"",programLevel:"",branchName:"",branchCode:""});
      else setSyllabus(old=>({...old,version:"1",subjectsText:""}));
      await loadInstitutions();
    } catch(e) { setError(e instanceof Error?e.message:"Could not save this record."); }
    finally { setSaving(false); }
  }

  return <main className="sa-inst-create">
    <header><div><span className="sa-inst-create-kicker">ACADEMIC DIRECTORY / SUPER ADMIN</span><h1>Manual academic setup</h1><p>Create an institution or enter a syllabus directly into the Gradly academic directory.</p></div><Link to="/super-admin/institutions"><ArrowLeft size={16}/> Back to institutions</Link></header>
    <div className="sa-inst-create-tabs">
      <button type="button" className={mode==="institution"?"active":""} onClick={()=>{setMode("institution");setError("");setNotice("");}}><Building2 size={16}/> Add institution</button>
      <button type="button" className={mode==="syllabus"?"active":""} onClick={()=>{setMode("syllabus");setError("");setNotice("");}}><BookOpen size={16}/> Add syllabus</button>
    </div>
    {error&&<div className="sa-inst-create-message error"><AlertCircle size={17}/>{error}</div>}
    {notice&&<div className="sa-inst-create-message success"><CheckCircle2 size={17}/>{notice}</div>}
    {mode==="institution"?<form className="sa-inst-create-form" onSubmit={submit}>
      <h2>Institution details</h2><p>Institution name is required. You can also create the first program and branch at the same time.</p>
      <label>Institution / college name *<input required maxLength={200} value={institution.name} onChange={e=>setInstitution({...institution,name:e.target.value})} placeholder="College or university name"/></label>
      <div className="sa-inst-create-grid"><label>City<input value={institution.city} onChange={e=>setInstitution({...institution,city:e.target.value})}/></label><label>State / region<input value={institution.state} onChange={e=>setInstitution({...institution,state:e.target.value})}/></label><label>Country<input value={institution.country} onChange={e=>setInstitution({...institution,country:e.target.value})}/></label></div>
      <div className="sa-inst-create-divider"><strong>Initial program and branch (optional)</strong><span>Leave both names blank if you only need the institution record.</span></div>
      <div className="sa-inst-create-grid"><label>Program name<input value={institution.programName} onChange={e=>setInstitution({...institution,programName:e.target.value})} placeholder="e.g. B.Tech"/></label><label>Program code<input value={institution.programCode} onChange={e=>setInstitution({...institution,programCode:e.target.value})}/></label><label>Program level<input value={institution.programLevel} onChange={e=>setInstitution({...institution,programLevel:e.target.value})} placeholder="Undergraduate"/></label><label>Branch / department<input value={institution.branchName} onChange={e=>setInstitution({...institution,branchName:e.target.value})} placeholder="e.g. Information Technology"/></label><label>Branch code<input value={institution.branchCode} onChange={e=>setInstitution({...institution,branchCode:e.target.value})}/></label></div>
      <button className="sa-inst-create-submit" disabled={saving}>{saving?"Saving institution...":"Create institution"}</button>
    </form>:<form className="sa-inst-create-form" onSubmit={submit}>
      <h2>Syllabus details</h2><p>Choose an existing academic structure, then add subjects by semester. Each line creates a subject entry in the database.</p>
      <label>Institution *<select required value={syllabus.institutionId} onChange={e=>setSyllabus({...syllabus,institutionId:e.target.value,programId:"",branchId:""})}><option value="">Choose institution</option>{institutions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Program *<select required disabled={!programs.length} value={syllabus.programId} onChange={e=>setSyllabus({...syllabus,programId:e.target.value,branchId:""})}><option value="">Choose program</option>{programs.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Branch / department *<select required disabled={!branches.length} value={syllabus.branchId} onChange={e=>setSyllabus({...syllabus,branchId:e.target.value})}><option value="">Choose branch</option>{branches.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="sa-inst-create-grid"><label>Syllabus version / scheme label *<input required value={syllabus.version} onChange={e=>setSyllabus({...syllabus,version:e.target.value})} placeholder="e.g. CBCS 2026"/></label><label>Number of semesters *<select required value={syllabus.semesterCount} onChange={e=>setSyllabus({...syllabus,semesterCount:e.target.value})}>{Array.from({length:16},(_,i)=>i+1).map(n=><option key={n} value={String(n)}>{n}</option>)}</select></label></div>
      <label>Subjects *<textarea required rows={12} value={syllabus.subjectsText} onChange={e=>setSyllabus({...syllabus,subjectsText:e.target.value})} placeholder={"One subject per line: semester | code | subject name | credits | optional type\n1 | CS101 | Programming Fundamentals | 4 | CORE\n1 | MA101 | Engineering Mathematics | 4 | CORE\n2 | CS201 | Data Structures | 3 | CORE"}/></label>
      <div className="sa-inst-create-help">Format: <code>semester | code | subject name | credits | optional type</code>. Example types: CORE, ELECTIVE, LAB. Add up to 500 subjects per syllabus.</div>
      {loading&&<p className="sa-inst-create-help">Loading available institutions...</p>}
      {!loading&&!institutions.length&&<p className="sa-inst-create-help">No institutions exist yet. Add an institution first, including a program and branch.</p>}
      <button className="sa-inst-create-submit" disabled={saving||loading||!institutions.length}>{saving?"Creating syllabus...":"Create syllabus"}</button>
    </form>}
  </main>;
}
