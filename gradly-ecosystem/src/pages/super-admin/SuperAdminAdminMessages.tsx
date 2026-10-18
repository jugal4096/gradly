import { FormEvent, useState } from "react";
import { BellRing, CheckCircle2, CircleAlert, Send, ShieldCheck } from "lucide-react";
import "./SuperAdminAdminMessages.css";

const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/,"").replace(/\/api$/i,""))+"/api";

export default function SuperAdminAdminMessages(){
  const [title,setTitle]=useState("");
  const [message,setMessage]=useState("");
  const [notificationType,setNotificationType]=useState("ANNOUNCEMENT");
  const [actionUrl,setActionUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [delivered,setDelivered]=useState<number|null>(null);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setSuccess("");setDelivered(null);
    const token=localStorage.getItem("gradly_super_admin_token");
    if(!token){setError("Your Super Admin session is missing. Sign in again.");return;}
    setLoading(true);
    try{
      const response=await fetch(API_ROOT+"/super-admin/admin-workspace-notifications",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"},body:JSON.stringify({adminId:null,title,message,notificationType,actionUrl:actionUrl.trim()||null})});
      const data=await response.json().catch(()=>({}));
      if(response.status===401){localStorage.removeItem("gradly_super_admin_token");throw new Error("Your session expired. Sign in again.");}
      if(!response.ok)throw new Error(data.message||"Unable to send announcement.");
      setSuccess(data.message||"Announcement delivered.");setDelivered(Number(data.deliveredCount)||0);setTitle("");setMessage("");setActionUrl("");
    }catch(e){setError(e instanceof Error?e.message:"Unable to send announcement.");}
    finally{setLoading(false);}
  }

  return <div className="sa-admin-messages">
    <header className="saam-heading"><div><span className="saam-eyebrow">ADMIN COMMUNICATIONS</span><h1>Admin announcements</h1><p>Send an official message to active department administrators. Messages appear in each Admin’s Super Admin inbox.</p></div><span className="saam-heading-icon"><BellRing size={23}/></span></header>
    <div className="saam-notice"><ShieldCheck size={18}/><p><strong>Broadcast to active Admins</strong><br/>This message will be delivered to every active Admin account. Avoid including passwords or other sensitive information.</p></div>
    {error&&<div className="saam-alert error" role="alert"><CircleAlert size={17}/>{error}</div>}
    {success&&<div className="saam-alert success" role="status"><CheckCircle2 size={17}/><div><strong>{success}</strong>{delivered!==null&&<p>{delivered} active Admin account(s) received this message.</p>}</div></div>}
    <section className="saam-form-card"><div className="saam-card-heading"><div><span className="saam-eyebrow">NEW MESSAGE</span><h2>Compose announcement</h2></div><span className="saam-broadcast-tag">All active Admins</span></div>
      <form onSubmit={submit}>
        <label><span>Message category</span><select value={notificationType} onChange={e=>setNotificationType(e.target.value)}><option value="ANNOUNCEMENT">General announcement</option><option value="ACTION_REQUIRED">Action required</option><option value="CURRICULUM_UPDATE">Curriculum update</option><option value="POLICY_UPDATE">Policy update</option><option value="MAINTENANCE">Maintenance notice</option></select></label>
        <label><span>Title</span><input value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={160} required placeholder="e.g. Semester curriculum review deadline"/></label>
        <label><span>Message</span><textarea value={message} onChange={e=>setMessage(e.target.value)} minLength={5} maxLength={4000} rows={7} required placeholder="Write the announcement and explain any action Admins need to take."/></label>
        <label><span>Related Admin page (optional)</span><input value={actionUrl} onChange={e=>setActionUrl(e.target.value)} maxLength={300} placeholder="/admin/curriculum"/><small>Use an internal path beginning with /, such as /admin/requests.</small></label>
        <div className="saam-form-footer"><p><ShieldCheck size={15}/> Sent messages are stored in the Admin workspace inbox.</p><button type="submit" disabled={loading}><Send size={16}/>{loading?"Sending…":"Send to active Admins"}</button></div>
      </form>
    </section>
  </div>;
}
