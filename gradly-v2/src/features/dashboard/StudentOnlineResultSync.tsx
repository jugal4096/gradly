import { useRef, useState } from "react";
import { createPortal } from "react-dom";

type StudentSubject = { id:number; name:string; credits:number; grade:string; courseCode?:string; electiveKind?:string|null };
type ResultGrade = { courseCode:string; grade:string };
type ResultSession = { id:string; title:string; url:string };
type ResultDocument = { title:string; url:string; programme:string|null; scheme:string|null; semester:number|null; grades:ResultGrade[] };
type MatchResponse = { session:ResultSession; documentsScanned:number; enrollmentHits:number; parseFailures:number; matches:ResultDocument[] };

function normalizeCode(value:unknown):string {
  return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
}

type Props = {
  apiBase:string;
  getIdToken:()=>Promise<string>;
  enrollmentNumber:string;
  selectedSemester:number;
  subjects:StudentSubject[];
  onApply:(semester:number,grades:ResultGrade[],sessionTitle:string,documentTitle:string,sourceUrl:string,attemptNumber:number)=>void;
};

export default function StudentOnlineResultSync({apiBase,getIdToken,enrollmentNumber,selectedSemester,subjects,onApply}:Props) {
  const [open,setOpen]=useState(false);
  const [sessions,setSessions]=useState<ResultSession[]>([]);
  const [loadingSessions,setLoadingSessions]=useState(false);
  const [loadingSessionId,setLoadingSessionId]=useState("");
  const [selectedSessionId,setSelectedSessionId]=useState("");
  const [scan,setScan]=useState<MatchResponse|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [attemptNumber,setAttemptNumber]=useState(1);
  const [showCancelConfirm,setShowCancelConfirm]=useState(false);
  const activeRequest=useRef<AbortController|null>(null);
  const loadingSession=sessions.find(session=>session.id===loadingSessionId);

  async function openArchive() {
    const nextOpen=!open;
    setOpen(nextOpen);
    if(!nextOpen||sessions.length) return;
    const controller=new AbortController();
    activeRequest.current=controller;
    setShowCancelConfirm(false);setLoadingSessions(true);setError("");setNotice("");
    try {
      const token=await getIdToken();
      const response=await fetch(apiBase+"/api/student/results/sessions",{headers:{Authorization:"Bearer "+token},signal:controller.signal});
      const body=await response.json();
      if(!response.ok) throw new Error(body.message||"Unable to load GECA examination sessions.");
      setSessions(Array.isArray(body.sessions)?body.sessions:[]);
      if(!Array.isArray(body.sessions)||!body.sessions.length) setError("No examination sessions were listed by the GECA portal.");
    } catch(reason) {
      if(!(reason instanceof DOMException&&reason.name==="AbortError")) setError(reason instanceof Error?reason.message:"Unable to load GECA examination sessions.");
    } finally {
      if(activeRequest.current===controller) activeRequest.current=null;
      setLoadingSessions(false);
    }
  }

  async function inspectSession(session:ResultSession) {
    const controller=new AbortController();
    activeRequest.current=controller;
    setShowCancelConfirm(false);setSelectedSessionId(session.id);setLoadingSessionId(session.id);setScan(null);setNotice("");setError("");
    try {
      const token=await getIdToken();
      const response=await fetch(apiBase+"/api/student/results/sessions/"+encodeURIComponent(session.id)+"/match",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({selectedSemester}),signal:controller.signal,
      });
      const body=await response.json();
      if(!response.ok) throw new Error(body.message||"Unable to inspect this examination session.");
      setScan(body as MatchResponse);
      if(!body.matches?.length&&Number(body.enrollmentHits)>0) setNotice("Your enrollment was detected in "+body.enrollmentHits+" PDF(s), but the grade columns could not be read reliably. No grades were changed.");
      else if(!body.matches?.length) setNotice("Your enrollment was not found in the scanned PDFs. "+body.documentsScanned+" PDFs were checked.");
      else setNotice("Found "+body.matches.length+" result PDF(s). Review the matching semester document before applying.");
    } catch(reason) {
      if(!(reason instanceof DOMException&&reason.name==="AbortError")) setError(reason instanceof Error?reason.message:"Unable to inspect this examination session.");
    } finally {
      if(activeRequest.current===controller) activeRequest.current=null;
      setLoadingSessionId("");
    }
  }

  function applyDocument(document:ResultDocument,sessionTitle:string) {
    if(!document.semester||document.semester!==selectedSemester) {
      setNotice("This PDF belongs to Semester "+(document.semester||"unknown")+". Select that semester in your SGPA workspace before applying.");
      return;
    }
    const applicable=document.grades.filter(row=>row.courseCode.trim()&&["A++","A+","A","B+","B","C+","C","D"].includes(row.grade.toUpperCase()));
    if(!applicable.length) {setError("The PDF was detected, but no safely recognised course-code and grade pairs were found. No grades were changed.");return;}
    onApply(document.semester,applicable,sessionTitle,document.title,document.url,attemptNumber);
    setNotice("Loaded "+applicable.length+" official course grades into your Semester "+document.semester+" subject table. Review the subjects and save the result to your academic records.");
    setError("");
  }

  const gradeMap=new Map<string,string>();
  scan?.matches.filter(document=>document.semester===selectedSemester).forEach(document=>document.grades.forEach(row=>gradeMap.set(normalizeCode(row.courseCode),row.grade.toUpperCase())));
  const knownCodes=new Set(subjects.map(subject=>normalizeCode(subject.courseCode)).filter(Boolean));

  return <div className="sp-student-online-wrap">
    <button type="button" className={"sp-entry-mode "+(open?"selected":"")} onClick={()=>void openArchive()} aria-expanded={open}>
      <span>ONLINE FETCHING</span><strong>Fetch official results</strong>
      <small>{loadingSessions?"Loading GECA archive…":sessions.length?sessions.length+" examination sessions available":"Browse official GECA result archive"}</small>
    </button>
    {open&&<section className="sp-student-online-panel" aria-busy={loadingSessions||Boolean(loadingSessionId)}>
      <div className="sp-student-online-head">
        <div><span>GECA · OFFICIAL RESULT ARCHIVE</span><h3>Choose an examination session</h3><p>Gradly searches the selected examination PDFs using the enrollment number saved in your confirmed academic profile: <b>{enrollmentNumber}</b>. Your academic record will not change until you review, apply and save the result.</p></div>
        <button type="button" onClick={()=>setOpen(false)} aria-label="Close online result archive">×</button>
      </div>
      <div className="sp-student-online-options">
        <label>RESULT ATTEMPT<select value={attemptNumber} onChange={event=>setAttemptNumber(Number(event.target.value))}><option value={1}>Regular examination</option><option value={2}>Re-examination / backlog</option></select></label>
        <span>Selected workspace: Semester {selectedSemester}</span>
      </div>
      {loadingSessions&&<p className="sp-student-online-muted">Loading the current examination list from GECA…</p>}
      {error&&<p className="sp-student-online-error" role="alert">{error}</p>}
      {notice&&<p className="sp-student-online-notice" role="status">{notice}</p>}
      {sessions.length>0&&<div className="sp-student-session-list">
        {sessions.map(session=><button type="button" key={session.id} className={"sp-student-session "+(selectedSessionId===session.id?"active":"")} onClick={()=>void inspectSession(session)} disabled={Boolean(loadingSessionId)}>
          <span><b>{session.title}</b><small>GECA official examination result</small></span>
          <strong>{loadingSessionId===session.id?"Scanning PDFs…":selectedSessionId===session.id?"Selected":"Scan →"}</strong>
        </button>)}
      </div>}
      {scan&&<div className="sp-student-scan-result">
        <div className="sp-student-scan-meta"><b>{scan.session.title}</b><span>{scan.documentsScanned} PDFs scanned · {scan.enrollmentHits} enrollment hits · {scan.matches.length} parsed · {scan.parseFailures} parse issues</span></div>
        {!scan.matches.length&&<p className="sp-student-online-muted">{scan.enrollmentHits>0?"Your enrollment was found, but the result table could not be parsed. No grades were applied.":"No exact enrollment match was found in this examination session."}</p>}
        {scan.matches.map(document=>{
          const matching=document.grades.filter(row=>knownCodes.has(normalizeCode(row.courseCode)));
          const additional=document.grades.filter(row=>!knownCodes.has(normalizeCode(row.courseCode)));
          const canApply=document.semester===selectedSemester&&document.grades.length>0;
          return <article className="sp-student-match" key={document.url}>
            <div className="sp-student-match-top"><div><b>{document.title}</b><small>{document.scheme||"Scheme not detected"} · {document.semester?"Semester "+document.semester:"Semester not detected"} · {matching.length} curriculum matches · {additional.length} additional courses</small></div><span>{document.grades.length} grades</span></div>
            <div className="sp-student-grade-section"><strong>Courses matched with your curriculum</strong><div className="sp-student-grade-list">{matching.length?matching.map(row=><span key={row.courseCode}><b>{row.courseCode}</b>{row.grade}</span>):<small>No course codes from this PDF match the loaded semester curriculum.</small>}</div></div>
            {additional.length>0&&<div className="sp-student-additional-section"><div><strong>Additional courses in the official PDF</strong><small>These will be added to your subject table with the fetched grade. Confirm their names and credits before saving SGPA.</small></div><div className="sp-student-grade-list">{additional.map(row=><span key={row.courseCode}><b>{row.courseCode}</b>{row.grade}</span>)}</div></div>}
            <button type="button" className="sp-student-apply" disabled={!canApply} onClick={()=>applyDocument(document,scan.session.title)}>{canApply?"Apply official grades to Semester "+selectedSemester:"Select Semester "+(document.semester||"—")+" to apply"}</button>
          </article>;
        })}
      </div>}
      <div className="sp-student-online-foot"><span>Source: GECA official result archive</span><a href="https://geca.ac.in/result-master.aspx" target="_blank" rel="noreferrer">Open official archive ↗</a></div>
    </section>}
    {(loadingSessions||Boolean(loadingSessionId))&&createPortal(<div className="sp-student-loading-backdrop" role="presentation"><div className="sp-student-loading-dialog" role="status" aria-live="polite">
      <div className="sp-student-loader"/><span>GRADLY · STUDENT WORKSPACE</span><h3>{loadingSessions?"Loading GECA examinations":"Fetching your result"}</h3>
      {!loadingSessions&&loadingSession&&<div className="sp-student-loader-session"><b>{loadingSession.title}</b><small>Semester {selectedSemester} · {enrollmentNumber}</small></div>}
      <p>{loadingSessions?"Retrieving the latest examination sessions from the official GECA archive.":"Scanning the linked department result PDFs and reading your matching result row. No grades are saved during this scan."}</p>
      <div className="sp-student-loader-progress"><i/></div>
      {!showCancelConfirm?<button type="button" onClick={()=>setShowCancelConfirm(true)}>Cancel fetching</button>:<div className="sp-student-cancel-confirm" role="alertdialog" aria-modal="true"><b>Stop fetching?</b><p>The current request will be cancelled. Your academic records will remain unchanged.</p><div><button type="button" onClick={()=>setShowCancelConfirm(false)}>Continue</button><button type="button" onClick={()=>{activeRequest.current?.abort();activeRequest.current=null;setShowCancelConfirm(false);setLoadingSessions(false);setLoadingSessionId("");setNotice("Fetching was cancelled. No grades were applied.");}}>Stop fetching</button></div></div>}
    </div></div>,document.body)}
  </div>;
}
