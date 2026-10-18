import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, BookOpen, Building2, CheckCircle2, CircleAlert, GraduationCap, LogOut, RefreshCw, Search, ShieldCheck, Layers3 } from "lucide-react";
import "./AdminDashboard.css";

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
const API_ROOT = configuredApiBaseUrl.replace(/\/api$/i, "") + "/api";

type AdminProfile = {
  admin_code?: string;
  adminCode?: string;
  full_name?: string;
  fullName?: string;
  role?: string;
  status?: string;
  institution_id?: string;
  institutionId?: string;
  institution_name?: string;
  institutionName?: string;
  program_id?: string | null;
  program_name?: string | null;
  branch_id?: string | null;
  branchId?: string | null;
  branch_name?: string | null;
  branchName?: string | null;
};
type Course = {
  id: string; code?: string; name?: string; credits?: number | string; courseType?: string;
  mandatory?: boolean; electiveGroup?: string | null; courseActive?: boolean;
  semester?: number | string; semesterName?: string | null; branch?: string | null;
  branchCode?: string | null; scheme?: string | null; schemeCode?: string | null;
  program?: string | null; programLevel?: string | null; institution?: string | null;
  academicYear?: string | null; gradingSystem?: string | null; curriculumVersion?: number | string;
  curriculumStatus?: string; expectedSemesterCredits?: number | string | null;
};
const clean=(value:unknown)=>String(value??"").trim();
const display=(value:unknown)=>clean(value)||"—";
const creditTotal=(rows:Course[])=>rows.reduce((total,row)=>total+(Number(row.credits)||0),0);
const unique=(rows:Course[],key:keyof Course)=>Array.from(new Set(rows.map(row=>clean(row[key])).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));

export default function AdminDashboard() {
  const navigate=useNavigate();
  const [profile,setProfile]=useState<AdminProfile|null>(null);
  const [courses,setCourses]=useState<Course[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [branch,setBranch]=useState("ALL");
  const [scheme,setScheme]=useState("ALL");
  const [semester,setSemester]=useState("ALL");
  const [courseType,setCourseType]=useState("ALL");
  const [workspaceView,setWorkspaceView]=useState<"overview"|"courses"|"structure">("overview");
  const [program,setProgram]=useState("ALL");

  const logout=useCallback(()=>{
    localStorage.removeItem("gradly_admin_token");
    navigate("/admin/login",{replace:true});
  },[navigate]);

  const load=useCallback(async()=>{
    const token=localStorage.getItem("gradly_admin_token");
    if(!token){navigate("/admin/login",{replace:true});return;}
    setLoading(true);setError("");
    try {
      const headers={Authorization:`Bearer ${token}`,Accept:"application/json"};
      const [meResponse,curriculumResponse]=await Promise.all([
        fetch(API_ROOT+"/admin/me",{headers}),
        fetch(API_ROOT+"/admin/curriculum",{headers})
      ]);
      if(meResponse.status===401||curriculumResponse.status===401){logout();return;}
      const me=await meResponse.json().catch(()=>({}));
      const curriculum=await curriculumResponse.json().catch(()=>({}));
      if(!meResponse.ok)throw new Error(me.message||"Could not verify administrator session.");
      if(!curriculumResponse.ok)throw new Error(curriculum.message||"Could not load curriculum.");
      setProfile(me.admin||me.data?.admin||null);
      setCourses(Array.isArray(curriculum.curriculum)?curriculum.curriculum:[]);
    } catch(e) {setError(e instanceof Error?e.message:"Unable to load admin workspace.");}
    finally {setLoading(false);}
  },[logout,navigate]);

  useEffect(()=>{void load();},[load]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return courses.filter(row=>{
      if(branch!=="ALL"&&clean(row.branch)!==branch)return false;
      if(program!=="ALL"&&clean(row.program)!==program)return false;
      if(scheme!=="ALL"&&clean(row.scheme)!==scheme)return false;
      if(semester!=="ALL"&&clean(row.semester)!==semester)return false;
      if(courseType!=="ALL"&&clean(row.courseType)!==courseType)return false;
      const searchable=[row.code,row.name,row.branch,row.scheme,row.program,row.semester,row.courseType,row.academicYear].map(clean).join(" ").toLowerCase();
      return !q||searchable.includes(q);
    });
  },[courses,search,branch,program,scheme,semester,courseType]);

  const branches=unique(courses,"branch");
  const programs=unique(courses,"program");
  const schemes=unique(courses,"scheme");
  const semesters=unique(courses,"semester");
  const types=unique(courses,"courseType");
  const adminName=display(profile?.full_name||profile?.fullName||profile?.admin_code||profile?.adminCode);
  const institution=display(profile?.institution_name||profile?.institutionName||courses[0]?.institution);
  const assignedBranch=profile?.branch_name||profile?.branchName||"";
  const assignedProgram=profile?.program_name||"";
  const reset=()=>{setSearch("");setBranch("ALL");setProgram("ALL");setScheme("ALL");setSemester("ALL");setCourseType("ALL");};

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header">
      <div className="admin-dashboard-brand"><img className="admin-dashboard-logo-image" src="/gradly-ecosystem-logo.png" alt="Gradly" /><div><strong>GRADLY</strong><span>Institution administration</span></div></div>
      <div className="admin-dashboard-header-actions"><button type="button" className="admin-dashboard-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?"Refreshing":"Refresh"}</button><button type="button" onClick={logout} className="admin-dashboard-logout"><LogOut size={16}/>Logout</button></div>
    </header>
    <div className="admin-dashboard-main">
      <section className="admin-dashboard-hero">
        <div className="admin-dashboard-hero-icon"><ShieldCheck size={25}/></div>
        <div className="admin-dashboard-hero-copy"><span className="admin-eyebrow">AUTHORIZED ADMIN WORKSPACE</span><h1>Welcome, {adminName}</h1><p>Manage and inspect the academic curriculum assigned to your institution.</p><div className="admin-assignment"><Building2 size={15}/><strong>{institution}</strong>{(assignedBranch||profile?.branch_id||profile?.branchId)&&<><span>·</span><span>{display(assignedBranch||"Assigned branch")}</span></>}</div></div>
        <span className="admin-session-pill"><CheckCircle2 size={14}/> Authenticated</span>
      </section>
      {error&&<div className="admin-dashboard-alert" role="alert"><CircleAlert size={18}/><div><strong>Workspace data unavailable</strong><p>{error}</p><button type="button" onClick={()=>void load()}>Try again</button></div></div>}
      <section className="admin-dashboard-stats">
        <article><span>Courses in scope</span><strong>{loading?"—":courses.length}</strong><small>Returned for your assignment</small></article>
        <article><span>Branches</span><strong>{loading?"—":branches.length}</strong><small>Available in loaded curriculum</small></article>
        <article><span>Schemes</span><strong>{loading?"—":schemes.length}</strong><small>Available in loaded curriculum</small></article>
        <article><span>Total listed credits</span><strong>{loading?"—":creditTotal(filtered).toLocaleString(undefined,{maximumFractionDigits:2})}</strong><small>Current filtered view</small></article>
      </section>
      <section className="admin-dashboard-panel">
        <div className="admin-panel-heading"><div><span className="admin-eyebrow">ACADEMIC CATALOGUE</span><h2><BookOpen size={20}/> Curriculum explorer</h2><p>Review courses, credits and semester allocations. This workspace is currently read-only.</p></div><span className="admin-readonly-pill">Read only</span></div>
        <div className="admin-curriculum-toolbar"><label className="admin-curriculum-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search course, code, branch or scheme"/></label>
          <label><span>Branch</span><select value={branch} onChange={e=>setBranch(e.target.value)}><option value="ALL">All branches</option>{branches.map(v=><option key={v}>{v}</option>)}</select></label>
          <label><span>Scheme</span><select value={scheme} onChange={e=>setScheme(e.target.value)}><option value="ALL">All schemes</option>{schemes.map(v=><option key={v}>{v}</option>)}</select></label>
          <label><span>Semester</span><select value={semester} onChange={e=>setSemester(e.target.value)}><option value="ALL">All semesters</option>{semesters.map(v=><option key={v}>{v}</option>)}</select></label>
          <label><span>Course type</span><select value={courseType} onChange={e=>setCourseType(e.target.value)}><option value="ALL">All types</option>{types.map(v=><option key={v}>{v}</option>)}</select></label>
          <button type="button" className="admin-filter-reset" onClick={reset}>Reset</button>
        </div>
        <div className="admin-curriculum-summary"><span>{filtered.length} courses match</span><span>{filtered.filter(r=>r.mandatory===true).length} mandatory</span><span>{filtered.filter(r=>r.mandatory===false).length} non-mandatory</span><span>{filtered.filter(r=>r.courseActive===true).length} active</span></div>
        <div className="admin-curriculum-table-wrap"><table className="admin-curriculum-table"><thead><tr><th>Course</th><th>Code</th><th>Branch</th><th>Scheme</th><th>Semester</th><th>Credits</th><th>Type</th><th>Requirement</th><th>Curriculum</th><th>Status</th></tr></thead><tbody>
          {!loading&&!error&&filtered.length===0&&<tr><td colSpan={10} className="admin-curriculum-empty">No courses match the current filters.</td></tr>}
          {filtered.map((row,index)=><tr key={row.id||row.code||index}><td><strong>{display(row.name)}</strong><small>{display(row.program)}</small></td><td><code>{display(row.code)}</code></td><td>{display(row.branch)}</td><td>{display(row.scheme)}</td><td>{display(row.semesterName||row.semester)}</td><td><strong>{display(row.credits)}</strong></td><td>{display(row.courseType)}</td><td>{row.mandatory===true?"Mandatory":row.mandatory===false?"Optional":display(row.electiveGroup)}</td><td><span>v{display(row.curriculumVersion)}</span><small>{display(row.academicYear)}</small></td><td><span className={row.courseActive?"admin-course-active":"admin-course-inactive"}>{row.courseActive?"Active":"Inactive"}</span><small>{display(row.curriculumStatus)}</small></td></tr>)}
        </tbody></table>{loading&&<div className="admin-curriculum-empty">Loading institution curriculum…</div>}</div>
        <p className="admin-dashboard-footnote"><GraduationCap size={15}/> Curriculum data is restricted by the institution and branch assigned to your administrator account. Changes and publishing are not enabled in this read-only view.</p>
      </section>
      <section className="admin-dashboard-secondary"><div><Activity size={18}/><div><strong>Academic review</strong><p>Use the filters to check semester coverage, credit values and course classifications.</p></div></div><div><ShieldCheck size={18}/><div><strong>Access boundary</strong><p>Your curriculum endpoint scopes results to your assigned institution and, when assigned, branch.</p></div></div></section>
      <footer className="admin-dashboard-footer">GRADLY · Institution administration · Protected workspace</footer>
    </div>
  </main>;
}
