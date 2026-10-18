import { FormEvent, useState } from "react";
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AdminLogin.css";

const configuredApiBaseUrl=(import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"");
const API_ROOT=configuredApiBaseUrl.replace(/\/api$/i,"")+"/api";

export default function AdminLogin(){
 const navigate=useNavigate();
 const [adminCode,setAdminCode]=useState("");
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");setLoading(true);
  try{
   const response=await fetch(API_ROOT+"/admin/login",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({adminCode:adminCode.trim(),password})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.message||"Unable to sign in. Check your Admin ID and password.");
   const token=data.token||data.data?.token;
   if(typeof token!=="string"||!token)throw new Error("The server did not return an admin session token.");
   localStorage.setItem("gradly_admin_token",token);
   setPassword("");
   navigate("/admin/dashboard",{replace:true});
  }catch(e){setError(e instanceof Error?e.message:"Unable to sign in. Please try again.");}
  finally{setLoading(false);}
 }
 return <main className="admin-login-page"><section className="admin-login-card">
  <button className="admin-login-back" type="button" onClick={()=>navigate("/admin")}><ArrowLeft size={15}/> Admin Portal</button>
  <div className="admin-login-brand"><img src="/logo.svg" alt="Gradly" onError={(event) => { const image = event.currentTarget; if (image.dataset.fallback === "1") { image.style.display = "none"; return; } image.dataset.fallback = "1"; image.src = "/gradly-logo.png"; }} /><div><strong>GRADLY</strong><small>Institution administration</small></div></div>
  <div className="admin-login-icon"><ShieldCheck size={24}/></div>
  <p className="admin-login-eyebrow">AUTHORIZED ACCESS</p><h1>Admin sign in</h1><p className="admin-login-subtitle">Sign in with the Admin ID issued to your approved account.</p>
  {error&&<div className="admin-login-error" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
  <form onSubmit={submit}>
   <label htmlFor="admin-code">Admin ID</label><input id="admin-code" value={adminCode} onChange={e=>setAdminCode(e.target.value)} autoComplete="username" placeholder="Enter your Admin ID" required maxLength={64}/>
   <label htmlFor="admin-password">Password</label><div className="admin-login-password"><input id="admin-password" type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" required maxLength={128}/><button type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
   <button className="admin-login-submit" type="submit" disabled={loading}>{loading?<><span className="admin-login-spinner"/> Signing in…</>:<><LockKeyhole size={16}/> Sign in securely</>}</button>
  </form>
  <div className="admin-login-security"><ShieldCheck size={16}/><span>Access is available only to active, approved administrators. Your institution and permissions are checked by Gradly.</span></div>
  <button className="admin-login-forgot" type="button" onClick={()=>navigate("/admin/apply?tab=password")}><KeyRound size={15}/> Forgot password? Request Super Admin approval</button><button className="admin-login-apply" type="button" onClick={()=>navigate("/admin/apply")}>Not an administrator yet? Apply for access</button>
 </section></main>;
}
