import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import "./SuperAdminAdmins.css";

type Admin = {
  id:string; admin_code?:string|null; admin_username?:string|null; full_name?:string|null;
  email?:string|null; phone_number?:string|null; role?:string|null; status?:string|null;
  registration_status?:string|null; institution_name?:string|null; branch_name?:string|null;
  adminship_started_at?:string|null; adminship_expires_at?:string|null; last_login_at?:string|null;
  login_failed_attempts?:number; login_attempt_limit?:number; login_locked_until?:string|null;
  user_id?:string|null; registered_at?:string|null; created_at?:string|null; updated_at?:string|null;
};

const root=(import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"").replace(/\/api$/i,"")+"/api";
const date=(v?:string|null)=>v?new Date(v).toLocaleString():"—";
const pretty=(v?:string|null)=>(v||"UNKNOWN").replace(/_/g," ").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());

export default function SuperAdminAdminProfile(){
  const {adminId=""}=useParams();
  const navigate=useNavigate();
  const [admin,setAdmin]=useState<Admin|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true);
  const [resetting,setResetting]=useState(false);
  const [permissions,setPermissions]=useState<string[]>([]);
  const locked=Boolean(admin?.login_locked_until && new Date(admin.login_locked_until).getTime()>Date.now());

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      const load = async () => {
        const token = localStorage.getItem("gradly_super_admin_token");
        if (!token) {
          if (live) { setError("Super Admin session missing. Sign in again."); setLoading(false); }
          return;
        }
        try {
          const response = await fetch(root + "/super-admin/administrators/" + encodeURIComponent(adminId), {
            headers: { Authorization: "Bearer " + token, Accept: "application/json" },
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || "Unable to load administrator profile.");
          if (live) setAdmin(data.administrator || null);
          const permissionResponse = await fetch(root + "/super-admin/administrators/" + encodeURIComponent(adminId) + "/permissions", {
            headers: { Authorization: "Bearer " + token, Accept: "application/json" },
          });
          const permissionData = await permissionResponse.json().catch(() => ({}));
          if (live && permissionResponse.ok) {
            setPermissions(Array.isArray(permissionData.permissions)
              ? permissionData.permissions
                  .filter((item: { granted?: boolean }) => item.granted !== false)
                  .map((item: { permission_code?: string }) => item.permission_code)
                  .filter((code: string | undefined): code is string => Boolean(code))
              : []);
          }
        } catch (err) {
          if (live) setError(err instanceof Error ? err.message : "Unable to load administrator profile.");
        } finally {
          if (live) setLoading(false);
        }
      };
      void load();
    }, 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [adminId]);

  const resetLoginAttempts=async()=>{
    if(!admin || !locked)return;
    if(!window.confirm("Reset the failed-login counter and unlock this administrator's account?"))return;
    const token=localStorage.getItem("gradly_super_admin_token");
    if(!token){setError("Super Admin session missing. Sign in again.");return;}
    setResetting(true);setNotice("");setError("");
    try{
      const response=await fetch(root+"/super-admin/administrators/"+encodeURIComponent(admin.id)+"/reset-login-attempts",{
        method:"PATCH",
        headers:{Authorization:"Bearer "+token,Accept:"application/json"},
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"Could not reset login attempts.");
      setAdmin(data.administrator||{...admin,login_failed_attempts:0,login_locked_until:null});
      setNotice("Login attempt limit reset. The administrator can sign in again.");
    }catch(err){
      setError(err instanceof Error?err.message:"Could not reset login attempts.");
    }finally{setResetting(false);}
  };

  return <section className="sa-admins">
    <header className="sa-admins-header"><div><span className="sa-admins-kicker">ADMINISTRATOR / PROFILE</span><h1>Administrator profile</h1><p>Identity, institution assignment, registration and account information.</p></div><button className="sa-admins-refresh" onClick={()=>navigate("/super-admin/admins")}><ArrowLeft size={15}/> Back to administrators</button></header>
    {loading?<div className="sa-admins-empty">Loading administrator profile…</div>:error&&!admin?<div className="sa-admins-error">{error}</div>:admin?<>
      {error&&<div className="sa-admins-error">{error}</div>}
      {notice&&<div className="sa-admins-notice">{notice}</div>}
      <div className="sa-admins-profilegrid">{[["Account status",pretty(admin.status)],["Registration",pretty(admin.registration_status)],["Institution",admin.institution_name||"—"],["Department",admin.branch_name||"—"]].map(([k,v])=><article key={k}><span>{k}</span><strong>{v}</strong></article>)}</div>
      <h2>{admin.full_name||admin.admin_username||"Administrator"}</h2>
      <section className="sa-admin-profile-permissions"><header><ShieldCheck size={17}/><div><strong>Assigned permissions</strong><small>{permissions.length} active permission(s)</small></div></header><div>{permissions.length?permissions.map(code=><span key={code}>{code.replace(/_/g," ")}</span>):<em>No active permissions recorded.</em>}</div></section>
      <section className="sa-admin-profile-permissions" aria-label="Security and access">
        <header><ShieldCheck size={17}/><div><strong>Security &amp; access</strong><small>{locked?"Administrator login is currently locked":"No active login lockout"}</small></div></header>
        <div className="sa-admins-security">
          <p>Failed login attempts: <strong>{admin.login_failed_attempts??0}</strong> / {admin.login_attempt_limit??3}</p>
          <p>Lockout expires: <strong>{date(admin.login_locked_until)}</strong></p>
          {locked&&<button className="sa-admins-refresh" type="button" disabled={resetting} onClick={()=>void resetLoginAttempts()}><RotateCcw size={15}/>{resetting?"Resetting…":"Reset login attempt limit"}</button>}
        </div>
      </section>
      <dl className="sa-admins-details">{[["Admin ID",admin.admin_code||admin.id],["Username",admin.admin_username],["Email",admin.email],["Phone",admin.phone_number],["Role",admin.role],["Registered at",date(admin.registered_at)],["Created at",date(admin.created_at)],["Last login",date(admin.last_login_at)],["Adminship started",date(admin.adminship_started_at)],["Adminship expiry",date(admin.adminship_expires_at)],["Updated at",date(admin.updated_at)],["User account ID",admin.user_id]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||"—"}</dd></div>)}</dl>
    </>:<div className="sa-admins-empty">Administrator not found.</div>}
  </section>;
}
