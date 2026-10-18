import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { auth } from "../../config/firebase";
const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\/+$/, "").replace(/\/api$/i, ""))+"/api";
const API_ROOT=((import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api").trim().replace(/\\/+$/, "").replace(/\\/api$/i, ""))+"/api";

export default function StudentSyllabusFeedbackPage(){
  const [requestType,setRequestType]=useState("SYLLABUS_CHANGE");
  const [semesterNumber,setSemesterNumber]=useState("");
  const [subjectName,setSubjectName]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setSuccess("");
    try{
      const user=auth.currentUser;
      if(!user)throw new Error("Please sign in to submit syllabus feedback.");
      const token=await user.getIdToken();
      const response=await fetch(API_ROOT+"/student/syllabus-feedback",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"},body:JSON.stringify({requestType,semesterNumber:semesterNumber||null,subjectName,message})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"Unable to submit your feedback.");
      setSuccess("Your feedback has been submitted to your department for review.");
      setSemesterNumber("");setSubjectName("");setMessage("");
    }catch(e){setError(e instanceof Error?e.message:"Unable to submit feedback.");}
    finally{setBusy(false);}
  }
  return <main style={{minHeight:"100vh",padding:"clamp(20px,5vw,56px)",background:"var(--page-bg,#f5f8f5)",color:"var(--text,#20382b)"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <Link to="/" style={{display:"inline-flex",alignItems:"center",gap:8,color:"inherit",textDecoration:"none",marginBottom:24}}><ArrowLeft size={16}/> Back to Gradly</Link>
      <section style={{background:"white",border:"1px solid #e2ebe4",borderRadius:20,padding:"clamp(20px,4vw,36px)",boxShadow:"0 16px 45px #173b2510"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><span style={{width:46,height:46,borderRadius:14,display:"grid",placeItems:"center",background:"#e0f5e8",color:"#124333"}}><MessageSquareText size={22}/></span><div><p style={{margin:0,fontSize:11,fontWeight:800,letterSpacing:1.4,color:"#19744f"}}>STUDENT VOICE</p><h1 style={{margin:"4px 0 0",fontSize:28}}>Syllabus feedback</h1></div></div>
        <p style={{lineHeight:1.7,color:"#64756a"}}>Suggest a syllabus correction, missing subject, credit update or other academic improvement. Your request will be reviewed by your department; official curriculum changes require Super Admin approval.</p>
        {error&&<p role="alert" style={{padding:12,borderRadius:10,background:"#fff0ee",color:"#a12d22"}}>{error}</p>}
        {success&&<p role="status" style={{padding:12,borderRadius:10,background:"#e6f8eb",color:"#145b38",display:"flex",gap:8,alignItems:"center"}}><CheckCircle2 size={18}/>{success}</p>}
        <form onSubmit={submit} style={{display:"grid",gap:16,marginTop:24}}>
          <label style={{display:"grid",gap:7,fontWeight:650,fontSize:13}}>Request type<select value={requestType} onChange={e=>setRequestType(e.target.value)} style={{padding:12,border:"1px solid #d7e3da",borderRadius:10,background:"white"}}><option value="SYLLABUS_CHANGE">Request a syllabus change</option><option value="SYLLABUS_FEEDBACK">General syllabus feedback</option><option value="MISSING_SUBJECT">Missing subject</option><option value="CREDIT_CORRECTION">Credit correction</option><option value="OTHER">Other academic feedback</option></select></label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14}}>
            <label style={{display:"grid",gap:7,fontWeight:650,fontSize:13}}>Semester (optional)<select value={semesterNumber} onChange={e=>setSemesterNumber(e.target.value)} style={{padding:12,border:"1px solid #d7e3da",borderRadius:10,background:"white"}}><option value="">Not specified</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>Semester {i+1}</option>)}</select></label>
            <label style={{display:"grid",gap:7,fontWeight:650,fontSize:13}}>Subject (optional)<input value={subjectName} onChange={e=>setSubjectName(e.target.value)} maxLength={180} placeholder="Subject name or code" style={{padding:12,border:"1px solid #d7e3da",borderRadius:10}}/></label>
          </div>
          <label style={{display:"grid",gap:7,fontWeight:650,fontSize:13}}>Explain your request<textarea value={message} onChange={e=>setMessage(e.target.value)} required minLength={10} maxLength={3000} rows={6} placeholder="Describe the issue or change you recommend (10–3,000 characters)." style={{padding:12,border:"1px solid #d7e3da",borderRadius:10,resize:"vertical"}}/></label>
          <div style={{display:"flex",gap:8,alignItems:"flex-start",color:"#64756a",fontSize:12,lineHeight:1.6}}><ShieldCheck size={17} style={{flexShrink:0,marginTop:2}}/><span>Your identity is used to associate the request with your academic department, but is not shown to department administrators in the feedback inbox.</span></div>
          <button disabled={busy} type="submit" style={{justifySelf:"start",display:"inline-flex",alignItems:"center",gap:9,padding:"12px 18px",border:0,borderRadius:10,background:"#124333",color:"white",fontWeight:750,cursor:busy?"wait":"pointer"}}>{busy?"Submitting…":"Submit feedback"} <Send size={15}/></button>
        </form>
      </section>
    </div>
  </main>;
}
