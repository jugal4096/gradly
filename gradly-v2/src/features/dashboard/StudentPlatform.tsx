import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./StudentPlatform.css";
import GuestOnboarding from "./GuestOnboarding";

type Section = "home" | "sgpa" | "sgpaWhatIf" | "sgpaPlanner" | "tracker" | "cgpa" | "cgpaWhatIf" | "planner" | "cgpaTracker" | "community" | "events" | "assistant" | "aiStudyPlanner" | "profile" | "academicManagement" | "settings" | "credits";
type Profile = { institutionId: string; institutionName: string; programId: string; programName: string; branchId: string; branchName: string; curriculumId: string; semester: string; enrollment: string; admissionYear: string; admissionMode: string; admissionNumber: string; scheme: string };
type Subject = { id: number; name: string; credits: number; grade: string; courseCode?: string; courseType?: string; curriculumSubjectId?: string; electiveKind?: "OE"|"HS"|"PE4"|"PE4LAB"|"PE5"|null; electiveSlotCode?: string; pe4Option?: (typeof PE4_OPTIONS)[number]; isCustom?: boolean };
type ElectiveOption = { code: string; name: string; credits: number };
const OE_OPTIONS: ElectiveOption[] = [
  {code:"CE3008",name:"Disaster Management",credits:3},{code:"CE2014",name:"Rural Technology",credits:3},{code:"CEOE0040",name:"Infrastructure Management",credits:3},
  {code:"ME2022",name:"Total Quality Management",credits:3},{code:"ME4015",name:"Industrial Management",credits:3},{code:"ME4031",name:"Renewable Energy Engineering",credits:3},{code:"ME3027",name:"Quality Management System",credits:3},
  {code:"EE3018",name:"Entrepreneurship Development",credits:3},{code:"EE4046",name:"Energy and Environment",credits:3},
  {code:"ET3033",name:"Consumer Electronics",credits:3},{code:"ET3034",name:"Microcontroller Applications",credits:3},{code:"ET3035",name:"Industrial Automation Applications",credits:3},
  {code:"CS2017",name:"Introduction to C & C++",credits:3},{code:"OEIT4001",name:"Machine Learning",credits:3},
];
const PE4_OPTIONS = [
  {code:"ITPE4001",name:"Advanced DBMS",labCode:"ITPE4002",labName:"Lab Advanced DBMS"},
  {code:"ITPE4003",name:"Image Processing and Computer Vision",labCode:"ITPE4004",labName:"Lab Image Processing and Computer Vision"},
  {code:"ITPE4005",name:"Cloud Computing",labCode:"ITPE4006",labName:"Lab Cloud Computing"},
];
const PE5_OPTIONS: ElectiveOption[] = [
  {code:"ITPE4010",name:"Reinforcement Learning",credits:3},{code:"ITPE4011",name:"Applied Accelerated Artificial Intelligence",credits:3},
  {code:"ITPE4012",name:"Deep Learning for Computer Vision",credits:3},{code:"ITPE4013",name:"Cyber Security and Privacy",credits:3},
  {code:"ITPE4015",name:"Social Networks",credits:3},
];
const HS_OPTIONS: ElectiveOption[] = [
  {code:"INHS1001",name:"Communication Skill",credits:2.5},{code:"CEHS0020",name:"Finance and Accounting",credits:3},
  {code:"CEHS1030",name:"Constitution of India and Professional Ethics",credits:3},{code:"CEHS0040",name:"Introduction to Operation Research",credits:3},
  {code:"MEHS0020",name:"Industrial Organization & Management",credits:3},{code:"MEHS1030",name:"Engineering Economics & Costing",credits:3},
  {code:"MEHS1040",name:"NPTEL/MOOCS Courses",credits:3},{code:"EEHS0001",name:"Consumer Psychology",credits:3},
  {code:"EEHS1002",name:"Energy Economics and policy",credits:3},{code:"EEHS1003",name:"Macroeconomics",credits:3},
  {code:"ITHS0020",name:"Professional Ethics and Cyber Laws",credits:3},{code:"ITHS1030",name:"Business Intelligence",credits:3},
  {code:"ETHS0020",name:"Foreign Language - German",credits:3},{code:"ETHS1030",name:"Foreign Language (Japanese)",credits:3},
  {code:"CSHS0011",name:"Psychology",credits:3},
];
function hsOptionsForSemester(semester:number):ElectiveOption[] {
  const evenCodes=["CEHS1030","MEHS1030","MEHS1040","EEHS1002","EEHS1003","ITHS1030","ETHS1030"];
  const oddCodes=["CEHS0020","CEHS0040","MEHS0020","EEHS0001","ITHS0020","ETHS0020","CSHS0011"];
  return HS_OPTIONS.filter(option=>(semester%2===0?evenCodes:oddCodes).includes(option.code));
}
function electiveKind(code:string, semester:number):"OE"|"HS"|"PE4"|"PE4LAB"|"PE5"|null {
  if (/^ITOE/.test(code)) return "OE";
  if (/^ITHS/.test(code) && semester>=5) return "HS";
  if (semester===7 && /^ITPE400[135]$/.test(code)) return "PE4";
  if (semester===7 && /^ITPE400[246]$/.test(code)) return "PE4LAB";
  if (semester===7 && /^ITPE401[0-5]$/.test(code)) return "PE5";
  return null;
}

type SemesterResult = { id: string; semester: number; sgpa: number; credits: number; savedAt: string };
type ChatMessage = { id: number; author: string; body: string; time: string; mine: boolean };
type AcademicCourseApi = { curriculum_subject_id?: string | null; course_code_snapshot?: string | null; course_name_snapshot?: string | null; credits?: number | string | null; grade_symbol?: string | null; grade_point?: number | string | null };
type AcademicRecordApi = { id: string | number; semester_number: number | string; sgpa?: number | string | null; credits_registered?: number | string | null; created_at?: string | null; courses?: AcademicCourseApi[] };
type CurriculumSubjectApi = { name?: string | null; credits?: number | string | null; code?: string | null; courseType?: string | null; id?: string | number | null };

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
// GECA grade-point reference used by the earlier Gradly academic engine: A++=10 through D=0.
const POINTS: Record<string, number> = { "A++":10, "A+":9, "A":8, "B+":7, "B":6, "C+":5, "C":4, "D":0 };
const gradeNames = Object.keys(POINTS);
const isDseAdmission = (admissionMode: string, enrollment: string) => /\bDSE\b|DIRECT\s+SECOND\s+YEAR|SECOND\s+YEAR\s+DIRECT/i.test(admissionMode||"") || String(enrollment||"").trim().toUpperCase().replace(/\s+/g,"")[4] === "S";
const emptyProfile: Profile = { institutionId:"", institutionName:"", programId:"", programName:"", branchId:"", branchName:"", curriculumId:"", semester:"", enrollment:"", admissionYear:String(new Date().getFullYear()), admissionMode:"Regular", admissionNumber:"", scheme:"" };
const nav: { id: Section; label: string; icon: string; group: string }[] = [
  { id:"home",label:"Overview",icon:"⌂",group:"WORKSPACE" },
  { id:"sgpa",label:"SGPA calculator",icon:"∑",group:"SGPA ANALYSIS" },
  { id:"sgpaWhatIf",label:"What-if analysis",icon:"⌁",group:"SGPA ANALYSIS" },
  { id:"sgpaPlanner",label:"SGPA planner",icon:"✧",group:"SGPA ANALYSIS" },
  { id:"tracker",label:"SGPA progress tracker",icon:"▤",group:"SGPA ANALYSIS" },
  { id:"cgpa",label:"CGPA calculator",icon:"◌",group:"CGPA ANALYSIS" },
  { id:"cgpaWhatIf",label:"What-if analysis",icon:"◈",group:"CGPA ANALYSIS" },
  { id:"planner",label:"CGPA planner",icon:"◇",group:"CGPA ANALYSIS" },
  { id:"cgpaTracker",label:"CGPA progress tracker",icon:"▥",group:"CGPA ANALYSIS" },
  { id:"community",label:"Group chat",icon:"▤",group:"COMMUNITY" },
  { id:"events",label:"Events & holidays",icon:"◷",group:"COMMUNITY" },
  { id:"assistant",label:"AI chatbot",icon:"✺",group:"AI ASSISTANT" },
  { id:"aiStudyPlanner",label:"AI study planner",icon:"⌘",group:"AI ASSISTANT" },
  { id:"profile",label:"Academic profile",icon:"◎",group:"ACADEMICS" },
  { id:"academicManagement",label:"Academic management",icon:"▧",group:"ACADEMICS" },
  { id:"credits",label:"Credit analyser",icon:"◩",group:"ACADEMICS" },
  { id:"settings",label:"Settings",icon:"⚙",group:"SETTINGS" },
];


function buildSgpaScenarios(targetInput:number, subjects:Subject[]) {
  const rows=subjects.filter(subject=>Number.isFinite(subject.credits)&&subject.credits>0);
  const totalCredits=rows.reduce((sum,subject)=>sum+subject.credits,0);
  const target=Math.max(0,Math.min(10,Number.isFinite(targetInput)?targetInput:0));
  const scale=Object.entries(POINTS).sort((a,b)=>a[1]-b[1]);
  const lower=scale.filter(([,points])=>points<=target).at(-1)||scale[0];
  const upper=scale.find(([,points])=>points>lower[1])||lower;
  const balanced=scale.find(([,points])=>points>=target)||scale[scale.length-1];
  const makeMixed=(ordered:Subject[])=>{
    const grades:Record<number,string>={};
    rows.forEach(subject=>{grades[subject.id]=lower[0];});
    let weighted=rows.reduce((sum,subject)=>sum+lower[1]*subject.credits,0);
    const required=target*totalCredits;
    for(const subject of ordered){
      if(weighted>=required)break;
      grades[subject.id]=upper[0];
      weighted+=(upper[1]-lower[1])*subject.credits;
    }
    return {grades,projected:totalCredits?weighted/totalCredits:0};
  };
  const uniformGrades:Record<number,string>={};
  rows.forEach(subject=>{uniformGrades[subject.id]=balanced[0];});
  const uniformPoints=rows.reduce((sum,subject)=>sum+balanced[1]*subject.credits,0);
  const creditPriority=makeMixed([...rows].sort((a,b)=>b.credits-a.credits));
  const spreadPriority=makeMixed([...rows].sort((a,b)=>a.credits-b.credits));
  return [
    {label:"Balanced grade plan",description:"Keep the same target-band grade across every subject.",grades:uniformGrades,projected:totalCredits?uniformPoints/totalCredits:0},
    {label:"High-credit-first mix",description:"Prioritise higher-credit subjects when moving up to the next grade band.",grades:creditPriority.grades,projected:creditPriority.projected},
    {label:"Spread-across-subjects mix",description:"Distribute the higher grade across lower-credit subjects first.",grades:spreadPriority.grades,projected:spreadPriority.projected},
  ];
}

function SectionTitle({ kicker, title, copy }: { kicker:string; title:string; copy:string }) {
  return <div className="sp-heading"><span>{kicker}</span><h1>{title}</h1><p>{copy}</p></div>;
}
function Card({ children, className="" }: { children: ReactNode; className?: string }) {
  return <section className={"sp-card "+className}>{children}</section>;
}

function escapeReportHtml(value: unknown): string {
  return String(value ?? "—").replace(/[&<>"']/g, character => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}

export default function StudentPlatform() {
  const { user, isGuest, signOut, loginWithGoogle } = useAuth();
  const routeNavigate = useNavigate();
  const [guestSessionReady,setGuestSessionReady] = useState(() => Boolean(localStorage.getItem("gradly_guest_session_token")));
  const [section,setSection] = useState<Section>("home");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [profileMenuOpen,setProfileMenuOpen] = useState(false);
  const [themeMode,setThemeMode] = useState<"light"|"dark"|"system">(()=>{const saved=localStorage.getItem("gradly_theme");return saved==="dark"||saved==="light"||saved==="system"?saved:"light";});
  const [systemDark] = useState(()=>window.matchMedia?.("(prefers-color-scheme: dark)").matches??false);
  const theme=themeMode==="system"?(systemDark?"dark":"light"):themeMode;
  const [fontFamily,setFontFamily] = useState(()=>localStorage.getItem("gradly_font_family")||"DM Sans");
  const [textSize,setTextSize] = useState(()=>Number(localStorage.getItem("gradly_text_size")||"14"));
  const [profile,setProfile] = useState<Profile>(() => {
    try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem("gradly_student_profile") || "{}") }; }
    catch { return emptyProfile; }
  });
  const [onboarding,setOnboarding] = useState(() => !isGuest && !profile.institutionId);
  const [guestSemester] = useState("1");
  
  const [guestCgpaRows,setGuestCgpaRows] = useState([{id:1,semester:"1",sgpa:"",credits:""}]);
  const [guestCgpaResult,setGuestCgpaResult] = useState<number|null>(null);
  const [loginGate,setLoginGate] = useState(false);
  const [gradeReminderOpen,setGradeReminderOpen] = useState(false);
  const [notice,setNotice] = useState("");
  const [deletingAccount,setDeletingAccount] = useState(false);
  const [semesterPromotion,setSemesterPromotion] = useState(false);
  const [nextSemester,setNextSemester] = useState("");
  const [subjects,setSubjects] = useState<Subject[]>(() => {
    if (isGuest) {
      try { const saved=JSON.parse(localStorage.getItem("gradly_guest_subjects") || "null"); if(Array.isArray(saved)&&saved.length) return saved.map((subject:Subject)=>({...subject,grade:({O:"A++",C:"C+",P:"C",F:"D"} as Record<string,string>)[subject.grade] || (POINTS[subject.grade]!==undefined?subject.grade:"A")})); } catch { /* use defaults */ }
      return Array.from({length:5},(_,i)=>({id:i+1,name:`Subject ${i+1}`,credits:3,grade:"A"}));
    }
    return [{id:1,name:"",credits:3,grade:"A"}];
  });
  const isDirectSecondYear = isDseAdmission(profile.admissionMode,profile.enrollment);
  const firstAvailableSemester = isDirectSecondYear ? 3 : 1;
  const currentSemester = Math.max(firstAvailableSemester,Math.min(12,Number(profile.semester)||firstAvailableSemester));
  const [selectedSemester,setSelectedSemester] = useState<number>(()=>Math.max(isDirectSecondYear?3:1,Number(profile.semester)|| (isDirectSecondYear?3:1)));
  const [loadingCurriculum,setLoadingCurriculum] = useState(false);
  const [savingSemester,setSavingSemester] = useState(false);
  const [savedConfirmationSemester,setSavedConfirmationSemester] = useState<number|null>(null);
  const [addCourseDialogOpen,setAddCourseDialogOpen] = useState(false);
  const [addCourseType,setAddCourseType] = useState<"OE"|"HS"|"UHV"|null>(null);
  const [addCourseCode,setAddCourseCode] = useState("");
  const [subjectSearch,setSubjectSearch] = useState("");
  const [savedSubjectsBySemester,setSavedSubjectsBySemester] = useState<Record<number,Subject[]>>({});
  const [droppedElectives,setDroppedElectives] = useState<Subject[]>([]);
  const [sgpa,setSgpa] = useState<number|null>(null);
  const [results,setResults] = useState<SemesterResult[]>(() => {
    try { return JSON.parse(localStorage.getItem(isGuest ? "gradly_guest_semester_results" : "gradly_semester_results") || "[]"); } catch { return []; }
  });
  const [whatIf,setWhatIf] = useState("8.5");
  const [targetSgpa,setTargetSgpa] = useState("9");
  const [totalCredits,setTotalCredits] = useState("160");
  const [earnedCredits,setEarnedCredits] = useState("0");
  const [messages,setMessages] = useState<ChatMessage[]>([
    {id:1,author:"Gradly Community",body:"Welcome! Share notes, ask questions and help each other prepare.",time:"Today",mine:false},
  ]);
  const [message,setMessage] = useState("");
  const [editingId,setEditingId] = useState<number|null>(null);
  const [notes,setNotes] = useState<{name:string;size:string;file:File}[]>([]);
  const [aiInput,setAiInput] = useState("");
  const [aiMessages,setAiMessages] = useState<{role:"assistant"|"user";text:string}[]>([
    {role:"assistant",text:"Hi! I’m Gradly AI. I can help explain academic concepts and organise your study questions. Institution-specific answers will become available when your college rules are connected."},
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGuest) localStorage.setItem("gradly_guest_subjects", JSON.stringify(subjects));
  }, [isGuest, subjects]);

  useEffect(() => {
    if (isGuest || !user) return;
    let cancelled=false;
    void (async()=>{
      try {
        const token=await user.getIdToken();
        const headers={Authorization:"Bearer "+token};
        const profileResponse=await fetch(API+"/api/student/profile",{headers});
        const profileData=await profileResponse.json();
        if(profileResponse.ok && profileData.profile && !cancelled) {
          const p=profileData.profile;
          const next:Profile={institutionId:p.institution_id||"",institutionName:p.institution_name||"",programId:p.program_id||"",programName:p.program_name||"",branchId:p.branch_id||"",branchName:p.branch_name||"",curriculumId:p.curriculum_id||"",semester:String(p.current_semester_number||""),enrollment:p.student_identifier||"",admissionYear:String(p.admission_year||new Date().getFullYear()),admissionMode:p.admission_mode_name||"Regular",admissionNumber:"",scheme:p.scheme_name||""};
          setProfile(next); setSelectedSemester(Math.max(isDseAdmission(next.admissionMode,next.enrollment)?3:1,Number(next.semester)||(isDseAdmission(next.admissionMode,next.enrollment)?3:1))); localStorage.setItem("gradly_student_profile",JSON.stringify(next)); setOnboarding(false);
        }
        const recordsResponse=await fetch(API+"/api/student/academic/records",{headers});
        const recordsData=await recordsResponse.json();
        if(recordsResponse.ok && !cancelled && Array.isArray(recordsData.records)) {
          const academicRecords=recordsData.records as AcademicRecordApi[];
          const saved:SemesterResult[]=academicRecords.map((row)=>({id:String(row.id),semester:Number(row.semester_number),sgpa:Number(row.sgpa||0),credits:Number(row.credits_registered||0),savedAt:row.created_at||new Date().toISOString()}));
          const savedSubjects:Record<number,Subject[]>={};
          academicRecords.forEach(row=>{
            const semesterNumber=Number(row.semester_number);
            if(Array.isArray(row.courses)) savedSubjects[semesterNumber]=row.courses.map((course,index)=>{
              const code=course.course_code_snapshot||"";
              const courseType=code==="INHS1020"?"Universal Human Values (UHV)":OE_OPTIONS.some(option=>option.code===code)?"Open Elective (OE)":HS_OPTIONS.some(option=>option.code===code)?"Humanities & Social Sciences (HS)":"Additional course";
              return {
                id:index+1,name:course.course_name_snapshot||"",credits:Number(course.credits||0),grade:String(course.grade_symbol||""),
                courseCode:code,courseType,curriculumSubjectId:course.curriculum_subject_id||undefined,
              };
            });
          });
          setResults(saved); setSavedSubjectsBySemester(savedSubjects); localStorage.setItem("gradly_semester_results",JSON.stringify(saved));
        }
      } catch(error) { if(!cancelled) setNotice(error instanceof Error?error.message:"Unable to sync academic profile."); }
    })();
    return ()=>{cancelled=true;};
  }, [isGuest, user]);

  useEffect(() => {
    if (isGuest || !user || !profile.curriculumId || !selectedSemester) return;
    let cancelled=false;
    setLoadingCurriculum(true);
    setSubjects([]);
    setSgpa(null);
    void (async()=>{
      try {
        const response=await fetch(API+`/api/academic/curricula/${encodeURIComponent(profile.curriculumId)}/semesters/${selectedSemester}/subjects`);
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to load curriculum subjects.");
        if(cancelled) return;
        const saved=savedSubjectsBySemester[selectedSemester]||[];
        let electiveSaved:Subject[]=[];
        try { const cached=JSON.parse(localStorage.getItem("gradly_elective_choices_"+profile.curriculumId+"_"+selectedSemester)||"[]"); if(Array.isArray(cached)) electiveSaved=cached; } catch { /* ignore invalid local cache */ }
        const savedBySubject=new Map<string,Subject>();
        saved.forEach(subject=>{
          if(subject.curriculumSubjectId) savedBySubject.set("id:"+subject.curriculumSubjectId,subject);
          if(subject.courseCode) savedBySubject.set("code:"+subject.courseCode,subject);
        });
        const curriculumSubjects=(Array.isArray(data.data)?data.data:[]) as CurriculumSubjectApi[];
        const loadedCurriculumSubjects: Subject[] = curriculumSubjects.map((item,index)=>{
          const subjectId=String(item.id||"");
          const courseCode=String(item.code||"");
          const previous=savedBySubject.get("id:"+subjectId)||savedBySubject.get("code:"+courseCode)||electiveSaved.find(subject=>subject.curriculumSubjectId===subjectId);
          const kind=electiveKind(courseCode,selectedSemester);
          const selectedCode=previous?.courseCode||courseCode;
          const option=kind==="OE"?OE_OPTIONS.find(x=>x.code===selectedCode):kind==="HS"?hsOptionsForSemester(selectedSemester).find(x=>x.code===selectedCode):kind==="PE5"?PE5_OPTIONS.find(x=>x.code===selectedCode):undefined;
          const pe4=kind==="PE4"?PE4_OPTIONS.find(x=>x.code===selectedCode):kind==="PE4LAB"?PE4_OPTIONS.find(x=>x.labCode===selectedCode):undefined;
          return {id:index+1,name:previous?.name||item.name||"",credits:previous?.credits??Number(item.credits||0),grade:previous?.grade||"",courseCode:selectedCode,courseType:String(item.courseType||""),curriculumSubjectId:subjectId,electiveKind:kind,electiveSlotCode:courseCode,pe4Option:pe4, ...((option||pe4)?{}:{})};
        });
        const droppedKey="gradly_dropped_electives_"+profile.curriculumId+"_"+selectedSemester;
        let dropped:Subject[]=[];
        try { const cached=JSON.parse(localStorage.getItem(droppedKey)||"[]"); if(Array.isArray(cached)) dropped=cached; } catch { /* ignore invalid dropped-elective cache */ }
        setDroppedElectives(dropped);
        const droppedSlotCodes=new Set(dropped.map(subject=>subject.electiveSlotCode||""));
        const availableCurriculumSubjects=loadedCurriculumSubjects.filter(subject=>!droppedSlotCodes.has(subject.electiveSlotCode||""));
        const customSavedSubjects: Subject[] = saved
          .filter(subject=>!subject.curriculumSubjectId)
          .map((subject,index)=>({...subject,id:loadedCurriculumSubjects.length+index+1,isCustom:true,courseType:subject.courseType||"Additional course"}));
        setSubjects([...availableCurriculumSubjects,...customSavedSubjects]);
        setSgpa(null);
      } catch(error) {
        if(!cancelled) { setSubjects([]); setNotice(error instanceof Error?error.message:"Unable to load curriculum subjects."); }
      } finally {
        if(!cancelled) setLoadingCurriculum(false);
      }
    })();
    return ()=>{cancelled=true;};
  }, [isGuest, user, profile.curriculumId, selectedSemester, savedSubjectsBySemester]);

  const weighted = subjects.filter(s=>s.name.trim() && s.credits>0 && POINTS[s.grade]!==undefined).reduce((sum,s)=>sum+(POINTS[s.grade]??0)*s.credits,0);
  const countedCredits = subjects.filter(s=>s.name.trim() && s.credits>0).reduce((sum,s)=>sum+s.credits,0);
  const creditsForSemesterLimit = subjects.filter(s=>s.name.trim() && s.credits>0 && s.courseCode?.toUpperCase()!=="INHS1020").reduce((sum,s)=>sum+s.credits,0);
  const uhvAlreadyUsed = subjects.some(subject=>subject.courseCode==="INHS1020") || Object.values(savedSubjectsBySemester).some(semesterSubjects=>semesterSubjects.some(subject=>subject.courseCode==="INHS1020"));
  const computedSgpa = countedCredits ? Number((weighted/countedCredits).toFixed(3)) : 0;
  const isCurrentSemesterInProgress = !isGuest && selectedSemester === currentSemester;
  const canCalculateOfficialSgpa = isGuest || selectedSemester < currentSemester;
  const hasCompleteGrades = subjects.length > 0 && subjects.every(subject => subject.credits <= 0 || (subject.name.trim() && POINTS[subject.grade] !== undefined)) && subjects.some(subject => subject.name.trim() && subject.credits > 0);

  useEffect(() => {
    if (loadingCurriculum || !canCalculateOfficialSgpa || !hasCompleteGrades || !countedCredits) {
      setSgpa(null);
      return;
    }
    setSgpa(computedSgpa);
  }, [loadingCurriculum, canCalculateOfficialSgpa, hasCompleteGrades, countedCredits, computedSgpa, subjects]);
  const cgpaCredits = results.reduce((sum,r)=>sum+r.credits,0);
  const cgpaValue = cgpaCredits ? results.reduce((sum,r)=>sum+r.sgpa*r.credits,0)/cgpaCredits : 0;
  const normalizedSubjectSearch = subjectSearch.trim().toLowerCase();
  const visibleSubjects = normalizedSubjectSearch
    ? subjects.filter(subject => [subject.name, subject.courseCode, subject.courseType, subject.electiveKind]
        .some(value => String(value ?? "").toLowerCase().includes(normalizedSubjectSearch)))
    : subjects;
  const institutionLabel = profile.institutionName || localStorage.getItem("gradly_guest_institute_name") || "Institution selected";
  const name = user?.displayName?.split(" ")[0] || "Guest";
  const title = nav.find(item=>item.id===section)?.label || "Overview";

  function getCgpaThroughSemester(semesterNumber:number): number | null {
    const included = results.filter(result => result.semester <= semesterNumber && result.credits > 0);
    const credits = included.reduce((sum, result) => sum + result.credits, 0);
    return credits
      ? included.reduce((sum, result) => sum + result.sgpa * result.credits, 0) / credits
      : null;
  }

  function downloadSemesterReport(record:SemesterResult) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setNotice("Allow pop-ups for Gradly to open your semester report, then choose Save as PDF.");
      return;
    }

    const courses = savedSubjectsBySemester[record.semester] || [];
    const cumulativeCgpa = getCgpaThroughSemester(record.semester);
    const courseRows = courses.length
      ? courses.map(course => `<tr>
          <td>${escapeReportHtml(course.courseCode || "—")}</td>
          <td>${escapeReportHtml(course.name)}</td>
          <td class="numeric">${escapeReportHtml(course.credits)}</td>
          <td class="numeric">${escapeReportHtml(course.grade || "—")}</td>
          <td class="numeric">${POINTS[course.grade] === undefined ? "—" : POINTS[course.grade]}</td>
        </tr>`).join("")
      : '<tr><td colspan="5" class="empty">Subject-wise details are not available for this saved record.</td></tr>';
    const reportDate = new Date(record.savedAt).toLocaleDateString();
    const reportHtml = `<!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Gradly Semester ${record.semester} Result</title>
        <style>
          @page { size: A4; margin: 18mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #171717; font: 13px/1.5 Arial, Helvetica, sans-serif; }
          .top { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #171717; }
          .brand { font-size: 11px; letter-spacing: .16em; font-weight: 800; }
          .document { color: #555; font-size: 10px; letter-spacing: .1em; text-align: right; }
          h1 { margin: 22px 0 5px; font-size: 25px; letter-spacing: -.04em; }
          .subtitle { margin: 0 0 20px; color: #666; font-size: 11px; }
          .identity { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; padding: 15px; border: 1px solid #d6d6d6; border-radius: 8px; }
          .field span, .metric span { display: block; color: #666; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          .field strong { display: block; margin-top: 3px; font-size: 12px; font-weight: 650; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0 22px; }
          .metric { padding: 13px; border: 1px solid #d6d6d6; border-radius: 8px; }
          .metric strong { display: block; margin-top: 5px; font-size: 21px; letter-spacing: -.03em; }
          h2 { margin: 0 0 10px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th { padding: 9px 8px; background: #f1f1f1; border-bottom: 1px solid #cfcfcf; text-align: left; font-size: 9px; letter-spacing: .06em; }
          td { padding: 10px 8px; border-bottom: 1px solid #e5e5e5; font-size: 11px; }
          .numeric { text-align: right; white-space: nowrap; }
          .empty { padding: 18px; color: #666; text-align: center; }
          .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d5d5d5; color: #666; font-size: 9px; line-height: 1.6; }
          @media screen { body { max-width: 850px; margin: 32px auto; padding: 32px; box-shadow: 0 4px 28px #00000016; } }
        </style>
      </head>
      <body>
        <div class="top"><div class="brand">GRADLY</div><div class="document">PERSONAL ACADEMIC RECORD<br />SEMESTER RESULT SUMMARY</div></div>
        <h1>Semester ${record.semester} result</h1>
        <p class="subtitle">Saved on ${escapeReportHtml(reportDate)} · Student-entered manual record</p>
        <div class="identity">
          <div class="field"><span>Student</span><strong>${escapeReportHtml(user?.displayName || "Student")}</strong></div>
          <div class="field"><span>Enrollment number</span><strong>${escapeReportHtml(profile.enrollment || "Not provided")}</strong></div>
          <div class="field"><span>Institution</span><strong>${escapeReportHtml(profile.institutionName || "Not provided")}</strong></div>
          <div class="field"><span>Programme / Branch</span><strong>${escapeReportHtml([profile.programName, profile.branchName].filter(Boolean).join(" · ") || "Not provided")}</strong></div>
          <div class="field"><span>Scheme</span><strong>${escapeReportHtml(profile.scheme || "Not provided")}</strong></div>
          <div class="field"><span>Record status</span><strong>Manual entry · Not institution-verified</strong></div>
        </div>
        <div class="metrics">
          <div class="metric"><span>Semester SGPA</span><strong>${record.sgpa.toFixed(3)}</strong></div>
          <div class="metric"><span>Cumulative CGPA</span><strong>${cumulativeCgpa === null ? "—" : cumulativeCgpa.toFixed(2)}</strong></div>
          <div class="metric"><span>Registered credits</span><strong>${escapeReportHtml(record.credits)}</strong></div>
        </div>
        <h2>Subject-wise grades</h2>
        <table>
          <thead><tr><th>COURSE CODE</th><th>SUBJECT</th><th class="numeric">CREDITS</th><th class="numeric">GRADE</th><th class="numeric">GRADE POINT</th></tr></thead>
          <tbody>${courseRows}</tbody>
        </table>
        <div class="footer">This report is generated from information entered and saved by the student in Gradly. It is intended for personal academic tracking and is not an official institutional marksheet or a verification of grades.</div>
      </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.document.title = `Gradly-Semester-${record.semester}-Result`;
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  }

  function updateElectiveCourse(subject:Subject, code:string) {
    setSubjects(current=>current.map(item=>{
      if(item.id!==subject.id) return item;
      if(item.electiveKind==="PE4"||item.electiveKind==="PE4LAB") {
        const option=PE4_OPTIONS.find(candidate=>candidate.code===code);
        if(!code||!option) return {...item,courseCode:item.electiveSlotCode||"",name:""};
        return item.electiveKind==="PE4"
          ? {...item,courseCode:option.code,name:option.name,credits:3}
          : {...item,courseCode:option.labCode,name:option.labName,credits:1};
      }
      const options=item.electiveKind==="OE"
        ? OE_OPTIONS
        : item.electiveKind==="HS"
          ? hsOptionsForSemester(selectedSemester)
          : PE5_OPTIONS;
      const option=options.find(candidate=>candidate.code===code);
      return {...item,courseCode:option?.code||item.electiveSlotCode,name:option?.name||"",credits:option?.credits||item.credits};
    }));
    setSgpa(null);
  }

  function addSubject() {
    if (isGuest) {
      if (countedCredits >= 20) { setNotice("Guest mode allows a maximum of 20 credits per semester."); return; }
      setSubjects(current=>[...current,{id:Math.max(0,...current.map(s=>s.id))+1,name:`Subject ${current.length+1}`,credits:Math.min(1,Math.max(0,20-countedCredits)),grade:"",courseCode:"",courseType:"Additional course",isCustom:true}]);
      setSgpa(null); setNotice(""); return;
    }
    setAddCourseDialogOpen(true); setAddCourseType(null); setAddCourseCode(""); setNotice("");
  }
  function confirmAddElectiveCourse() {
    if (!addCourseType || !addCourseCode) { setNotice("Choose a subject before adding it."); return; }
    const options:ElectiveOption[]=addCourseType==="OE"?OE_OPTIONS:addCourseType==="HS"?hsOptionsForSemester(selectedSemester):[{code:"INHS1020",name:"Universal Human Values",credits:3}];
    const option=options.find(item=>item.code===addCourseCode);
    if(!option) { setNotice("That subject is not available."); return; }
    if(addCourseType==="UHV" && uhvAlreadyUsed) { setNotice("Universal Human Values can be added only once throughout your degree."); return; }
    if(addCourseType!=="UHV" && creditsForSemesterLimit+option.credits>28) { setNotice(`Adding ${option.name} would exceed the 28-credit semester limit.`); return; }
    if(subjects.some(subject=>subject.courseCode===option.code)) { setNotice("This course is already added to the semester."); return; }
    const courseType=addCourseType==="OE"?"Open Elective (OE)":addCourseType==="HS"?"Humanities & Social Sciences (HS)":"Universal Human Values (UHV)";
    setSubjects(current=>[...current,{id:Math.max(0,...current.map(subject=>subject.id))+1,name:option.name,credits:option.credits,grade:"",courseCode:option.code,courseType,isCustom:true}]);
    setSgpa(null); setNotice(""); setAddCourseDialogOpen(false); setAddCourseType(null); setAddCourseCode("");
  }
  function removeSubject(subjectId:number) {
    setSubjects(current=>current.filter(subject=>subject.id!==subjectId));
    setSgpa(null); setNotice("");
  }
  function removeElective(subjectId:number) {
    const subject=subjects.find(item=>item.id===subjectId);
    if(!subject||!(subject.electiveKind==="OE"||subject.electiveKind==="HS")) return;
    const key="gradly_dropped_electives_"+profile.curriculumId+"_"+selectedSemester;
    const next=[...droppedElectives.filter(item=>item.electiveSlotCode!==subject.electiveSlotCode),subject];
    localStorage.setItem(key,JSON.stringify(next));
    setDroppedElectives(next);
    removeSubject(subjectId);
  }
  function restoreElective(subjectId:number) {
    const subject=droppedElectives.find(item=>item.id===subjectId);
    if(!subject) return;
    const next=droppedElectives.filter(item=>item.id!==subjectId);
    localStorage.setItem("gradly_dropped_electives_"+profile.curriculumId+"_"+selectedSemester,JSON.stringify(next));
    setDroppedElectives(next);
    setSubjects(current=>[...current,subject].sort((a,b)=>a.id-b.id));
    setSgpa(null); setNotice("");
  }
  async function saveSemester() {
    if(sgpa===null) { setNotice("Complete the grade selection for every subject before saving your SGPA."); return; }
    const semesterNumber=isGuest?Number(guestSemester):selectedSemester;
    if(!isGuest && semesterNumber>=currentSemester) { setNotice("You can save SGPA only for completed semesters. Promote your academic profile after this semester ends to unlock its official entry."); return; }
    const gradedCourses=subjects.filter(subject=>subject.name.trim()&&subject.credits>0);
    const degreeCreditLimit=isDirectSecondYear?121:160;
    const previouslyRegistered=results.filter(result=>result.semester!==semesterNumber).reduce((sum,result)=>sum+result.credits,0);
    if(creditsForSemesterLimit>28){setNotice("A semester cannot exceed 28 registered credits, excluding the one-time UHV allowance.");return;}
    if(previouslyRegistered+countedCredits>degreeCreditLimit){setNotice(`Your programme credit limit is ${degreeCreditLimit} credits (${isDirectSecondYear?"Direct Second Year":"Regular"} entry).`);return;}
    if(subjects.some(subject=>subject.electiveKind&&!subject.name.trim())){setNotice("Choose a course for every available elective slot before saving.");return;}
    if(!gradedCourses.length||gradedCourses.some(subject=>POINTS[subject.grade]===undefined)) { setNotice("Select a valid grade for every curriculum subject before saving."); return; }
    const row:SemesterResult={id:crypto.randomUUID(),semester:semesterNumber,sgpa,credits:countedCredits,savedAt:new Date().toISOString()};
    if(!isGuest) {
      if(!user || !profile.curriculumId) { setNotice("Save your academic profile and select a curriculum scheme before recording results."); return; }
      setSavingSemester(true);
      try {
        const token=await user.getIdToken();
        const response=await fetch(API+"/api/student/academic/semesters",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({
          semesterNumber,attemptNumber:1,courses:gradedCourses.map(subject=>({courseCode:subject.courseCode||"",courseName:subject.name,credits:subject.credits,gradeSymbol:subject.grade,gradePoint:POINTS[subject.grade]}))
        })});
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to save semester result.");
        row.id=data.semester.id;
      } catch(error) { setNotice(error instanceof Error?error.message:"Unable to save semester result."); return; }
      finally { setSavingSemester(false); }
    }
    const next=[...results.filter(item=>item.semester!==row.semester),row].sort((a,b)=>a.semester-b.semester);
    setResults(next); setSavedSubjectsBySemester(current=>({...current,[semesterNumber]:subjects}));
    if(!isGuest) localStorage.setItem("gradly_elective_choices_"+profile.curriculumId+"_"+semesterNumber,JSON.stringify(subjects));
    localStorage.setItem(isGuest?"gradly_guest_semester_results":"gradly_semester_results",JSON.stringify(next));
    setNotice("");
    setSavedConfirmationSemester(semesterNumber);
  }
  function navigate(next:Section) {
    if (isGuest && !["home","sgpa","cgpa"].includes(next)) { setLoginGate(true); setMobileOpen(false); setProfileMenuOpen(false); return; }
    if(next==="sgpa") setGradeReminderOpen(true);
    setSection(next); setMobileOpen(false); setProfileMenuOpen(false); setNotice("");
  }
  function updateSetting(key:string,value:string) { localStorage.setItem(key,value); }
  async function deleteGuestIdentity() {
    if (!window.confirm("Permanently delete your Guest ID and guest workspace? This cannot be undone.")) return;
    const token=localStorage.getItem("gradly_guest_session_token");
    if(!token){setNotice("No active guest session was found on this device.");return;}
    try {
      const response=await fetch(API+"/api/guest/session",{method:"DELETE",headers:{"x-guest-session":token}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.message||"Guest ID could not be deleted.");
      ["gradly_guest_id","gradly_guest_session_token","gradly_guest_institute","gradly_guest_subjects","gradly_guest_semester_results","gradly_guest_institute_request_token"].forEach(key=>localStorage.removeItem(key));
      await signOut();
    } catch(error) { setNotice(error instanceof Error?error.message:"Guest ID could not be deleted."); }
  }
  function submitMessage(event:FormEvent) {
    event.preventDefault(); if(!message.trim()) return;
    if(editingId!==null) setMessages(current=>current.map(item=>item.id===editingId?{...item,body:message.trim()}:item));
    else setMessages(current=>[...current,{id:Date.now(),author:user?.displayName||"You",body:message.trim(),time:"Just now",mine:true}]);
    setMessage("");setEditingId(null);
  }
  async function promoteSemester() {
    if (!user || semesterPromotion) return;
    const target = Number(nextSemester);
    if (!Number.isInteger(target) || target !== Number(profile.semester) + 1) {
      setNotice("You can select only the next semester.");
      return;
    }
    setSemesterPromotion(true);
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/profile/current-semester", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ currentSemesterNumber: target }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Semester could not be updated.");
      const updated = { ...profile, semester: String(data.currentSemesterNumber || target) };
      setProfile(updated);
      setSelectedSemester(target);
      localStorage.setItem("gradly_student_profile", JSON.stringify(updated));
      setNotice("Current semester updated. Your academic profile is locked again.");
      setNextSemester("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Semester could not be updated.");
    } finally {
      setSemesterPromotion(false);
    }
  }
  async function deleteStudentAccount() {
    if (isGuest || !user || deletingAccount) return;
    const confirmation = window.prompt(
      "Delete your Gradly student account? Your saved academic records are currently retained for administrator review. Type DELETE to confirm."
    );
    if (confirmation !== "DELETE") return;
    setDeletingAccount(true);
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(API + "/api/student/profile", {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to delete your account.");
      [
        "gradly_student_profile",
        "gradly_semester_results",
        "gradly_subjects",
        "gradly_exam_profile",
        "gradly_student_exam_profile",
      ].forEach((key) => localStorage.removeItem(key));
      await signOut();
      routeNavigate("/", { replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to delete your account.");
      setDeletingAccount(false);
    }
  }
  function submitAi(event:FormEvent) {
    event.preventDefault(); if(!aiInput.trim()) return;
    const prompt=aiInput.trim();setAiMessages(current=>[...current,{role:"user",text:prompt},{role:"assistant",text:"I’ve received your question. The live institution-aware AI service is not connected yet, so I can’t verify your college’s specific rules. For now, I can help with general academic concepts once the AI backend is enabled."}]);setAiInput("");
  }
  const remainingCredits=Math.max(0,Number(totalCredits||0)-Number(earnedCredits||0));
  const desired=Number(targetSgpa);
  const programmeName=profile.programName.toLowerCase();
  const totalProgrammeSemesters=programmeName.includes("mca")||programmeName.includes("m.tech")||programmeName.includes("mtech")?4:8;
  const remainingSemesters=Math.max(1,totalProgrammeSemesters-results.length);
  const completedWeightedPoints=results.reduce((sum,r)=>sum+r.sgpa*r.credits,0);
  const completedCredits=results.reduce((sum,r)=>sum+r.credits,0);
  const averageFutureCredits=results.length?completedCredits/results.length:20;
  const requiredAverage=(desired*(completedCredits+remainingSemesters*averageFutureCredits)-completedWeightedPoints)/(remainingSemesters*averageFutureCredits);
  const sgpaScenarios=buildSgpaScenarios(Number(targetSgpa),subjects);
  const whatIfScenarios=buildSgpaScenarios(Number(whatIf),subjects);

  if (isGuest && !guestSessionReady) return <GuestOnboarding onComplete={() => setGuestSessionReady(true)} />;
  if (onboarding && !isGuest) return <Navigate to="/academic-setup" replace />;

  return <div className={"sp-shell "+(isGuest?"sp-guest-mode":"sp-user-mode")+(theme==="dark"?" sp-dark-theme":"")} style={{fontFamily:`"${fontFamily}", sans-serif`,fontSize:`${textSize}px`}}>
    <aside id="student-workspace-menu" className={"sp-sidebar "+(mobileOpen?"open":"")}>
      <a className="sp-brand" href="/" onClick={e=>{e.preventDefault();navigate("home");}}><span className="sp-brand-mark">G<small>✦</small></span><span>Gradly<small>STUDENT SPACE</small></span></a>
      <div className="sp-nav-scroll">{["WORKSPACE","SGPA ANALYSIS","CGPA ANALYSIS","COMMUNITY","AI ASSISTANT","ACADEMICS","SETTINGS"].map((group,index)=><section className={"sp-nav-group sp-nav-group-"+index} key={group} aria-label={group}><div className="sp-nav-label-row"><span className="sp-nav-label">{group}</span><span className="sp-nav-count">{nav.filter(item=>item.group===group).length.toString().padStart(2,"0")}</span></div><div className="sp-nav-items">{nav.filter(item=>item.group===group).map(item=>{const locked=isGuest&&!["home","sgpa","cgpa"].includes(item.id);return <button key={item.id} className={(section===item.id?"active ":"")+(locked?"sp-nav-locked":"")} onClick={()=>navigate(item.id)} aria-current={section===item.id?"page":undefined} aria-label={locked?item.label+" — sign in to unlock":item.label}><i>{item.icon}</i><span>{item.label}</span>{locked&&<small className="sp-nav-lock" aria-hidden="true">LOCKED</small>}{section===item.id&&<b/>}</button>;})}</div></section>)}</div>
      <div className="sp-sidebar-bottom">{isGuest?<div className="sp-guest-unlock"><span>✦ THE FULL EXPERIENCE</span><strong>Your next chapter is waiting.</strong><p>Unlock planners, progress insights, community and AI study tools.</p><button onClick={()=>void loginWithGoogle()}>Unlock Gradly →</button></div>:<div className="sp-sidebar-tip"><span>✦ ACADEMIC COMPANION</span><b>Progress over perfection.</b><small>Your next chapter starts here.</small></div>}<button className="sp-signout" onClick={()=>void signOut()}>↗ {isGuest?"Exit guest mode":"Sign out"}</button></div>
    </aside>
    {mobileOpen&&<button className="sp-backdrop" aria-label="Close workspace menu" onClick={()=>setMobileOpen(false)}/>}
    <main className="sp-main">
      <header className="sp-topbar"><div className="sp-top-left"><button className="sp-menu" onClick={()=>setMobileOpen(true)} aria-label="Explore workspace" aria-controls="student-workspace-menu" aria-expanded={mobileOpen}><span/><span/><span/></button><div><small>GRADLY / STUDENT</small><strong>{title}</strong></div></div><div className="sp-top-right"><span className="sp-status"><i/> {isGuest?"GUEST MODE":"STUDENT WORKSPACE"}</span><div className="sp-profile-menu-wrap"><button className="sp-avatar sp-avatar-button" aria-label="Open profile menu" aria-expanded={profileMenuOpen} onClick={()=>setProfileMenuOpen(open=>!open)}>{(user?.displayName||localStorage.getItem("gradly_guest_id")||"G").charAt(0).toUpperCase()}</button>{profileMenuOpen&&<div className="sp-profile-dropdown"><div className="sp-profile-dropdown-head"><strong>{isGuest?(localStorage.getItem("gradly_guest_id")||"Guest"):user?.displayName||"Student"}</strong><small>{isGuest?"Guest account":user?.email||"Signed-in student"}</small></div>{!isGuest&&<><button onClick={()=>navigate("profile")}>Academic profile</button><button onClick={()=>navigate("settings")}>Settings</button></>}{isGuest&&<><button onClick={()=>void loginWithGoogle()}>Sign in to unlock</button><button className="danger" onClick={()=>void deleteGuestIdentity()}>Delete Guest ID</button></>}<button onClick={()=>void signOut()}>{isGuest?"Exit guest mode":"Log out"}</button></div>}</div></div></header>
      <div className="sp-content">
        {notice&&<div className="sp-notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        {!isGuest&&addCourseDialogOpen&&<div className="sp-save-success-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget){setAddCourseDialogOpen(false);setAddCourseType(null);setAddCourseCode("");}}}><section className="sp-add-elective-modal" role="dialog" aria-modal="true" aria-labelledby="sp-add-elective-title"><span className="sp-save-success-kicker">GRADLY · COURSE SELECTION</span><h2 id="sp-add-elective-title">Add an elective course</h2><p>Choose the course category, then select one of the existing subjects available for Semester {selectedSemester}.</p><div className="sp-add-elective-types"><button type="button" className={addCourseType==="OE"?"selected":""} onClick={()=>{setAddCourseType("OE");setAddCourseCode("");setNotice("");}}>Open Elective <strong>OE</strong></button><button type="button" className={addCourseType==="HS"?"selected":""} onClick={()=>{setAddCourseType("HS");setAddCourseCode("");setNotice("");}}>Humanities &amp; Social Sciences <strong>HS</strong></button><button type="button" className={addCourseType==="UHV"?"selected":""} disabled={uhvAlreadyUsed} onClick={()=>{setAddCourseType("UHV");setAddCourseCode("INHS1020");setNotice("");}}>Universal Human Values <strong>UHV · 3 credits</strong></button></div>{addCourseType?<label className="sp-add-elective-select">AVAILABLE {addCourseType==="OE"?"OPEN ELECTIVES":addCourseType==="HS"?"HUMANITIES & SOCIAL SCIENCES":"UNIVERSAL HUMAN VALUES"}<select value={addCourseCode} onChange={event=>setAddCourseCode(event.target.value)}><option value="">Select an existing subject</option>{(addCourseType==="OE"?OE_OPTIONS:addCourseType==="HS"?hsOptionsForSemester(selectedSemester):[{code:"INHS1020",name:"Universal Human Values",credits:3}]).map(option=><option key={option.code} value={option.code} disabled={addCourseType!=="UHV"&&creditsForSemesterLimit+option.credits>28}>{option.code} · {option.name} ({option.credits} credits)</option>)}</select></label>:<p className="sp-add-elective-credit-note">Choose OE, HS, or the one-time UHV subject. UHV can be added only once throughout your degree.</p>}{addCourseType==="UHV"?<p className="sp-add-elective-credit-note">UHV is exempt from the 28-credit semester limit. It may take your semester total above 28 credits.</p>:<p className="sp-add-elective-credit-note">Available semester capacity: {(28-countedCredits).toFixed(1)} credits. Subjects that exceed the limit cannot be selected.</p>}{uhvAlreadyUsed&&<p className="sp-add-elective-credit-note">UHV has already been added in another semester or is already present in this semester.</p>}<div className="sp-save-success-actions"><button type="button" className="sp-secondary" onClick={()=>{setAddCourseDialogOpen(false);setAddCourseType(null);setAddCourseCode("");}}>Cancel</button><button type="button" className="sp-primary" onClick={confirmAddElectiveCourse} disabled={!addCourseCode||!addCourseType||(addCourseType==="UHV"?uhvAlreadyUsed:!(addCourseType==="OE"?OE_OPTIONS:hsOptionsForSemester(selectedSemester)).some(option=>option.code===addCourseCode&&creditsForSemesterLimit+option.credits<=28))}>{addCourseType==="UHV"?"Add UHV":"Add selected course"}</button></div></section></div>}
        {savedConfirmationSemester!==null&&<div className="sp-save-success-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSavedConfirmationSemester(null);}}><section className="sp-save-success-modal" role="dialog" aria-modal="true" aria-labelledby="sp-save-success-title"><div className="sp-save-success-mark" aria-hidden="true">✓</div><span className="sp-save-success-kicker">GRADLY · ACADEMIC RECORD</span><h2 id="sp-save-success-title">Semester {savedConfirmationSemester} grades saved</h2><p>{isGuest?"Your semester result has been saved on this device.":"Semester subject grades saved to your Gradly academic record."} You can return to this semester anytime to review or edit the grades.</p><div className="sp-save-success-actions"><button type="button" className="sp-secondary" onClick={()=>{if(!isGuest)setSelectedSemester(savedConfirmationSemester);setSavedConfirmationSemester(null);setSection("sgpa");}}>Edit saved grades</button><button type="button" className="sp-primary" onClick={()=>setSavedConfirmationSemester(null)}>Done</button></div></section></div>}
        {section==="home"&&isGuest&&<>
          <section className="sp-guest-welcome">
            <div className="sp-guest-welcome-copy">
              <span className="sp-kicker">GRADLY / GUEST WORKSPACE</span>
              <h1>Your academics.<br/><em>In better focus.</em></h1>
              <p>A clean, practical space to understand your semester and cumulative performance. Your calculations stay on this device.</p>
              <div className="sp-guest-identity"><span>GUEST ID</span><strong>@{localStorage.getItem("gradly_guest_id")||"GUEST"}</strong><i><b/> ACTIVE</i></div>
              <div className="sp-guest-welcome-actions">
                <button className="sp-primary" onClick={()=>navigate("sgpa")}>Calculate SGPA <span>↗</span></button>
                <button className="sp-guest-text-action" onClick={()=>navigate("cgpa")}>Open CGPA calculator <span>→</span></button>
              </div>
            </div>
            <div className="sp-guest-visual" aria-hidden="true">
              <div className="sp-guest-visual-orbit orbit-one"/><div className="sp-guest-visual-orbit orbit-two"/>
              <div className="sp-guest-visual-glow"/><div className="sp-guest-visual-mark">G<span>✦</span></div>
              <div className="sp-guest-visual-chip chip-a"><small>YOUR ACADEMIC SPACE</small><b>Clear numbers.<br/>Better decisions.</b></div>
              <div className="sp-guest-visual-chip chip-b"><small>TOOLS READY</small><b>SGPA / CGPA</b></div>
            </div>
          </section>
          <section className="sp-guest-stats">
            <article><span>INSTITUTION</span><strong>{institutionLabel}</strong><small>Your selected academic home</small></article>
            <article><span>SAVED SEMESTERS</span><strong>{results.length.toString().padStart(2,"0")}</strong><small>SGPA records on this device</small></article>
            <article><span>CURRENT CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>{results.length?"Based on saved semester credits":"Add semester results to begin"}</small></article>
          </section>
          <div className="sp-guest-section-head"><div><span className="sp-kicker">YOUR CALCULATION TOOLS</span><h2>Start with the numbers that matter.</h2><p>Both calculators are available without signing in.</p></div><span>02 AVAILABLE</span></div>
          <div className="sp-guest-tools">
            <button className="sp-guest-tool sp-guest-tool-sgpa" onClick={()=>navigate("sgpa")}><span className="sp-guest-tool-top"><span className="sp-guest-tool-icon">∑</span><small>01 / SEMESTER</small></span><strong>SGPA calculator</strong><p>Enter subject credits and grades, calculate your semester score and save it to your progress.</p><i>Open SGPA calculator <b>↗</b></i></button>
            <button className="sp-guest-tool sp-guest-tool-cgpa" onClick={()=>navigate("cgpa")}><span className="sp-guest-tool-top"><span className="sp-guest-tool-icon">◈</span><small>02 / CUMULATIVE</small></span><strong>CGPA calculator</strong><p>Combine semester performance and credits to understand your overall academic standing.</p><i>Open CGPA calculator <b>↗</b></i></button>
          </div>
          <section className="sp-guest-full-preview">
            <div className="sp-guest-preview-head"><div><span className="sp-kicker">THE COMPLETE GRADLY WORKSPACE</span><h2>Everything else, organised for you.</h2><p>Sign in to unlock the full set of academic tools and student spaces.</p></div><button onClick={()=>void loginWithGoogle()}>Unlock full access <span>→</span></button></div>
            <div className="sp-guest-preview-groups">
              <div><span>01</span><section><strong>SGPA Analysis</strong><p>Calculator · What-if Analysis · SGPA Planner · Progress Tracker</p></section><i>⌁</i></div>
              <div><span>02</span><section><strong>CGPA Analysis</strong><p>Calculator · What-if Analysis · CGPA Planner · Progress Tracker</p></section><i>◈</i></div>
              <div><span>03</span><section><strong>Community</strong><p>Group Chat · Upcoming Events & Holidays</p></section><i>☷</i></div>
              <div><span>04</span><section><strong>AI Assistant</strong><p>AI Chatbot · AI Study Planner</p></section><i>✳</i></div>
              <div><span>05</span><section><strong>Academics</strong><p>Academic Profile · Academic Management</p></section><i>◎</i></div>
              <div><span>06</span><section><strong>Settings</strong><p>Font · Light / Dark Mode · Text Size</p></section><i>⚙</i></div>
            </div>
          </section>
          <section className="sp-guest-upgrade"><div><span className="sp-kicker">YOUR NEXT STEP</span><h2>Keep your academic journey moving.</h2><p>Create your student account to save your profile, plan targets, track progress and use every Gradly feature.</p></div><button className="sp-primary" onClick={()=>void loginWithGoogle()}>Continue with Google <span>→</span></button></section>
        </>}
        {section==="home"&&!isGuest&&<><div className="sp-hero"><div><span className="sp-kicker">YOUR ACADEMIC WORKSPACE</span><h1>Your academic journey.<br/><em>Beautifully in balance.</em></h1><p>Welcome back, {name}. A smarter space to track progress, plan ahead and stay in control.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Explore academic tools <span>→</span></button></div><div className="sp-hero-art"><div className="sp-orbit orbit-a"/><div className="sp-orbit orbit-b"/><div className="sp-orbit-core">G<span>✦</span></div><small>LEARN · PLAN · GROW</small></div></div>
          <div className="sp-metrics"><article><span>CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>{results.length} semester records saved</small></article><article><span>LATEST SGPA</span><strong>{results.length?results[results.length-1].sgpa.toFixed(3):"—"}</strong><small>Most recent saved result</small></article><article><span>CREDITS EARNED</span><strong>{earnedCredits||"0"}</strong><small>Update your credit analyser</small></article><article><span>ACADEMIC PROFILE</span><strong>{profile.institutionName?"Ready":"Setup"}</strong><small>{profile.institutionName||"Complete your onboarding"}</small></article></div>
          <div className="sp-section-row"><div><span className="sp-kicker">YOUR TOOLKIT</span><h2>Your tools. One clear direction.</h2></div><span>01 — 06</span></div>
          <div className="sp-feature-grid">{[{id:"sgpa" as Section,n:"01",t:"SGPA analysis",d:"Calculate, simulate and track semester grades.",ic:"∑"},{id:"cgpa" as Section,n:"02",t:"CGPA analysis",d:"Understand your cumulative performance.",ic:"◈"},{id:"planner" as Section,n:"03",t:"Academic planner",d:"Work backwards from your target SGPA or CGPA.",ic:"⌁"},{id:"tracker" as Section,n:"04",t:"Progress tracker",d:"Visualise your results across semesters.",ic:"▥"},{id:"community" as Section,n:"05",t:"Community & notes",d:"Share study material and talk with classmates.",ic:"☷"},{id:"assistant" as Section,n:"06",t:"Gradly AI assistant",d:"Get academic guidance in one conversation.",ic:"✳"}].map(item=><button className="sp-feature" key={item.id} onClick={()=>navigate(item.id)}><span>{item.n} / {item.ic}</span><strong>{item.t}</strong><p>{item.d}</p><i>↗</i></button>)}</div>
        </>}
        {section==="sgpa"&&<><section className="sp-calculator-hero"><div className="sp-calculator-hero-copy"><span className="sp-calc-eyebrow">GRADLY · ACADEMIC TOOLS</span><h1>SGPA calculator</h1><p>Bring your semester grades together and see your performance clearly.</p></div><div className="sp-calc-art" aria-hidden="true"><div className="sp-calc-orbit sp-calc-orbit-one"/><div className="sp-calc-orbit sp-calc-orbit-two"/><div className="sp-calc-cube"><span>G</span><i>✦</i></div><div className="sp-calc-float sp-calc-float-one">A+</div><div className="sp-calc-float sp-calc-float-two">10</div></div><div className="sp-calc-glow"/></section><div className="sp-entry-modes"><button type="button" className="sp-entry-mode selected" aria-pressed="true"><span>MANUAL ENTRY</span><strong>Enter grades yourself</strong><small>Available now</small></button><button type="button" className="sp-entry-mode unavailable" disabled aria-disabled="true"><span>ONLINE FETCHING</span><strong>Fetch official results</strong><small>Coming soon</small></button></div><div className="sp-two-col"><Card><div className="sp-card-head sp-sgpa-card-head"><div><span>YOUR SUBJECTS</span><h2>Grade entry</h2></div>{!isGuest&&<label className="sp-semester-picker">SEMESTER<select value={String(selectedSemester)} onChange={event=>{setSelectedSemester(Number(event.target.value));setSgpa(null);setNotice("");setSubjectSearch("");}}>{Array.from({length:Math.max(0,currentSemester-firstAvailableSemester+1)},(_,index)=>index+firstAvailableSemester).map(semester=><option key={semester} value={semester}>Semester {semester}{semester===currentSemester?" · Current":""}</option>)}</select></label>}<label className="sp-subject-search"><span>SEARCH SUBJECTS</span><input type="search" aria-label="Search subjects by name, code or course type" placeholder="Name or course code" value={subjectSearch} onChange={event=>setSubjectSearch(event.target.value)}/></label><b>{subjects.length} subjects</b></div>{!isGuest&&isCurrentSemesterInProgress&&<div className="sp-semester-journey"><div className="sp-semester-journey-mark"><span>✦</span></div><div className="sp-semester-journey-copy"><div className="sp-semester-journey-meta"><span className="sp-semester-live-dot"/><span>YOUR CURRENT CHAPTER</span><b>SEMESTER {currentSemester}</b></div><h3>Oh, you’re in the middle of the journey!</h3><p>Your Semester {currentSemester} is still in progress. Since the official result hasn’t been announced yet, your SGPA is not ready to be recorded. You can explore possible grade combinations and see where your efforts could take you with What-if Analysis.</p><button type="button" onClick={()=>navigate("sgpaWhatIf")}>Explore your possibilities <span>→</span></button><small>Official SGPA entry unlocks when you advance your academic profile to the next semester.</small></div><div className="sp-semester-journey-progress"><span>IN PROGRESS</span><strong>{currentSemester}</strong><small>Keep going</small></div></div>}{!isGuest&&!isCurrentSemesterInProgress&&<p className="sp-muted sp-semester-saved">{results.some(result=>result.semester===selectedSemester)?"Saved grades are loaded. You can edit and save them again.":"Completed semester · Enter grades, calculate SGPA and save it to your tracker."}</p>}{!isGuest&&loadingCurriculum&&<p className="sp-muted">Loading subjects from your curriculum…</p>}{!isGuest&&!loadingCurriculum&&subjects.length===0&&<div className="sp-empty compact"><span>◈</span><p>No subjects are configured for Semester {selectedSemester} in your selected curriculum.</p></div>}<div className={isGuest?"sp-subject-table sp-guest-subject-table":"sp-subject-table sp-curriculum-table"}><div className={isGuest?"sp-subject-head":"sp-subject-head sp-curriculum-head"}>{isGuest?<><span>SUBJECT</span><span>CREDITS</span><span>GRADE</span><span/></>:<><span>SUBJECT</span><span>COURSE CODE</span><span>COURSE TYPE</span><span>CREDITS</span><span>GRADE</span><span/></>}</div>{visibleSubjects.map((s,index)=><div className={isGuest?"sp-subject-row":"sp-subject-row sp-curriculum-row"} key={s.id}><div className="sp-subject-identity">{!isGuest&&s.electiveKind?<><strong>{s.electiveKind==="OE"?"OPEN ELECTIVE · OE":s.electiveKind==="HS"?"HUMANITIES & SOCIAL SCIENCES · HS":(s.electiveKind==="PE4"||s.electiveKind==="PE4LAB")?"PROFESSIONAL ELECTIVE · PE-IV":"PROFESSIONAL ELECTIVE · PE-V"}</strong><select aria-label={"Choose "+s.electiveKind+" course"} value={s.electiveKind==="PE4LAB"?(PE4_OPTIONS.find(o=>o.labCode===s.courseCode)?.code||""):(s.courseCode===s.electiveSlotCode?"":s.courseCode||"")} onChange={e=>updateElectiveCourse(s,e.target.value)}><option value="">Choose an approved course</option>{(s.electiveKind==="OE"?OE_OPTIONS:s.electiveKind==="HS"?hsOptionsForSemester(selectedSemester):s.electiveKind==="PE5"?PE5_OPTIONS:PE4_OPTIONS).map(option=><option key={option.code} value={option.code}>{option.code} · {option.name}</option>)}</select></>:<input aria-label={"Subject "+(index+1)} title={s.courseCode||s.name} placeholder={"Subject "+(index+1)} value={s.name} readOnly={!isGuest&&!s.isCustom} onChange={e=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,name:e.target.value}:x));setSgpa(null);}}/>}</div>{!isGuest&&<><span className="sp-course-code-cell">{s.isCustom?<input aria-label="Course code" placeholder="Course code" value={s.courseCode||""} onChange={e=>setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,courseCode:e.target.value}:x))}/>:s.courseCode||"—"}</span><span className="sp-course-type-cell">{s.courseType||"—"}</span></>}<input aria-label="Credits" type="number" min="0" max={isGuest?Math.max(0,20-(countedCredits-s.credits)):s.isCustom?28:undefined} step="0.5" value={s.credits} readOnly={!isGuest&&!s.isCustom} onChange={e=>{const value=Math.max(0,Number(e.target.value)||0);setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,credits:isGuest?Math.min(value,Math.max(0,20-cur.filter(y=>y.id!==s.id).reduce((sum,y)=>sum+y.credits,0))):value}:x));setSgpa(null);}}/><div className="sp-grade-options" role="radiogroup" aria-label={"Choose grade for "+(s.name||"subject "+(index+1))}>{gradeNames.map(g=><button type="button" key={g} role="radio" aria-checked={s.grade===g} className={s.grade===g?"selected":""} onClick={()=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,grade:g}:x));setSgpa(null);}}><strong>{g}</strong><small>{POINTS[g]} pts</small></button>)}</div>{(!isGuest&&(s.electiveKind==="OE"||s.electiveKind==="HS"))&&<button type="button" className="sp-remove" aria-label={"Remove "+(s.name||"elective course")} title="Remove this curriculum OE/HS elective from the current semester" onClick={()=>removeElective(s.id)}>×</button>}{(!isGuest&&s.isCustom&&(s.courseType==="Open Elective (OE)"||s.courseType==="Humanities & Social Sciences (HS)"))&&<button type="button" className="sp-remove" aria-label={"Remove "+(s.name||"elective course")} title="Remove this added elective course" onClick={()=>removeSubject(s.id)}>×</button>}</div>)}</div>{subjectSearch.trim()&&visibleSubjects.length===0&&<p className="sp-subject-search-empty">No subjects match “{subjectSearch}”. Try another name or course code.</p>}{!isGuest&&<div className="sp-actions sp-course-management"><button type="button" className="sp-add" onClick={addSubject} >＋ Add course</button><p className="sp-muted sp-elective-credit-meter">Semester credits (limit-counted): <strong>{creditsForSemesterLimit.toFixed(1)} / 28</strong> · Total including UHV: {countedCredits.toFixed(1)} · Programme limit: {isDirectSecondYear?121:160} credits</p></div>}{!isGuest&&droppedElectives.length>0&&<div className="sp-dropped-electives"><span>Removed from this semester</span>{droppedElectives.map(subject=><button type="button" key={subject.id} onClick={()=>restoreElective(subject.id)}>＋ Restore {subject.electiveKind==="OE"?"OE":"HS"} · {subject.electiveSlotCode}</button>)}</div>}{isGuest&&<button className="sp-add" onClick={addSubject} disabled={countedCredits>=20}>＋ Add subject</button>}{isGuest&&<div className="sp-muted">Credits used: {countedCredits.toFixed(1)} / 20 maximum</div>}<div className="sp-actions">{!isCurrentSemesterInProgress&&!isGuest&&<button className="sp-secondary" onClick={saveSemester} disabled={sgpa===null||savingSemester}>{savingSemester?"Saving…":"Save to tracker"}</button>}</div></Card><Card className="sp-result"><span>YOUR SGPA</span><div className="sp-score">{isCurrentSemesterInProgress||sgpa===null?"—":sgpa.toFixed(3)}<small>/ 10</small></div><h3>{isCurrentSemesterInProgress?"Your semester is still underway":sgpa===null?"Complete your grade selection":"Live SGPA"}</h3><p>{isCurrentSemesterInProgress?"Use What-if Analysis for estimates. Official SGPA becomes available after the semester is completed.":sgpa===null?"Choose a valid grade for every subject. Your SGPA will update automatically as you make changes.":"Your weighted semester grade point average, recalculated whenever a grade or credit changes."}</p><div className="sp-result-line"><span>Counted credits</span><b>{countedCredits}</b></div><div className="sp-result-line"><span>Weighted points</span><b>{weighted.toFixed(2)}</b></div></Card></div></>}
        {section==="sgpaWhatIf"&&<><SectionTitle kicker="SGPA ANALYSIS" title="SGPA what-if analysis" copy="Explore hypothetical grade combinations for your current semester without recording them as official results."/><Card><div className="sp-card-head"><div><span>SCENARIO INPUT</span><h2>Set your target SGPA</h2></div></div><div className="sp-inline-form"><label>Target SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={e=>{setWhatIf(e.target.value);setTargetSgpa(e.target.value);}}/></label><div className="sp-inline-result"><span>Semester being modelled</span><strong>{isGuest?"Guest estimate":`Semester ${selectedSemester}${isCurrentSemesterInProgress?" · In Progress":""}`}</strong></div><div className="sp-inline-result"><span>Subjects and credits</span><strong>{subjects.filter(subject=>subject.credits>0).length} · {countedCredits}</strong></div></div><p className="sp-muted">These are hypothetical grade combinations based on the subjects and credits loaded in the SGPA calculator. Nothing here is saved as an official semester result.</p></Card><div className="sp-feature-grid sp-plan-scenarios">{whatIfScenarios.map((plan,i)=><Card key={plan.label}><div className="sp-card-head"><div><span>ESTIMATE {String(i+1).padStart(2,"0")}</span><h2>{plan.label}</h2></div></div><div className="sp-score">{plan.projected.toFixed(3)}<small> projected SGPA</small></div><p className="sp-muted">{plan.description}</p>{subjects.filter(subject=>subject.credits>0).map((subject,index)=><div className="sp-history-row" key={subject.id}><span>{subject.name.trim()||"Subject "+(index+1)} · {subject.credits} credits</span><strong>{plan.grades[subject.id]||"D"} · {POINTS[plan.grades[subject.id]||"D"]}</strong></div>)}</Card>)}</div><p className="sp-muted">Estimates are for planning only. They do not represent awarded grades, official SGPA or saved academic records.</p></>}

{section==="sgpaPlanner"&&<><SectionTitle kicker="TARGET-BASED PLANNING" title="SGPA planner" copy="Set a target SGPA and compare several subject-wise grade combinations based on the credits you entered."/><Card><div className="sp-card-head"><div><span>YOUR TARGET</span><h2>What SGPA are you aiming for?</h2></div></div><div className="sp-inline-form"><label>Target SGPA<input type="number" min="0" max="10" step=".01" value={targetSgpa} onChange={e=>setTargetSgpa(e.target.value)}/></label><div className="sp-inline-result"><span>Subjects in your calculator</span><strong>{subjects.filter(s=>s.credits>0).length}</strong></div><div className="sp-inline-result"><span>Total subject credits</span><strong>{subjects.reduce((sum,s)=>sum+Math.max(0,s.credits),0)}</strong></div></div><p className="sp-muted">The planner uses the subjects and credits from SGPA calculator. Update those entries first if your semester load differs.</p></Card><div className="sp-feature-grid sp-plan-scenarios">{sgpaScenarios.map((plan,i)=><Card key={plan.label}><div className="sp-card-head"><div><span>SCENARIO {String(i+1).padStart(2,"0")}</span><h2>{plan.label}</h2></div></div><div className="sp-score">{plan.projected.toFixed(3)}<small> projected SGPA</small></div><p className="sp-muted">{plan.description}</p>{subjects.filter(s=>s.credits>0).map((subject,index)=><div className="sp-history-row" key={subject.id}><span>{subject.name.trim()||"Subject "+(index+1)} · {subject.credits} credits</span><strong>{plan.grades[subject.id]||"D"} · {POINTS[plan.grades[subject.id]||"D"]}</strong></div>)}</Card>)}</div><p className="sp-muted">These are mathematical planning scenarios using the GECA reference points. They are not predictions of awarded grades. Your institution's current scheme and official marksheet remain authoritative.</p></>}

{section==="cgpa"&&<>{isGuest?<><section className="sp-calculator-hero sp-cgpa-calculator-hero"><div className="sp-calculator-hero-copy"><span className="sp-calc-eyebrow">GRADLY · ACADEMIC TOOLS</span><h1>CGPA calculator</h1><p>Bring every completed semester together and see your cumulative performance.</p></div><div className="sp-calc-glow"/></section><div className="sp-cgpa-workspace-grid"><Card><div className="sp-card-head"><div><span>SEMESTER INPUT</span><h2>Enter semester results</h2></div><b>{guestCgpaRows.length} rows</b></div><div className="sp-subject-head sp-cgpa-input-head"><span>SEMESTER</span><span>SGPA</span><span>CREDITS</span><span/></div>{guestCgpaRows.map((row,index)=><div className="sp-subject-row sp-cgpa-input-row" key={row.id}><select aria-label={"Semester "+(index+1)} value={row.semester} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,semester:e.target.value}:x));setGuestCgpaResult(null);}}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Sem {i+1}</option>)}</select><input aria-label="Semester SGPA" type="number" min="0" max="10" step=".01" placeholder="e.g. 8.25" value={row.sgpa} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,sgpa:e.target.value}:x));setGuestCgpaResult(null);}}/><input aria-label="Semester credits" type="number" min="1" max="20" step=".5" placeholder="Credits" value={row.credits} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,credits:e.target.value}:x));setGuestCgpaResult(null);}}/><button className="sp-remove" aria-label="Remove semester" disabled={guestCgpaRows.length===1} onClick={()=>{setGuestCgpaRows(rows=>rows.filter(x=>x.id!==row.id));setGuestCgpaResult(null);}}>×</button></div>)}<div className="sp-actions"><button className="sp-add" onClick={()=>setGuestCgpaRows(rows=>[...rows,{id:Math.max(0,...rows.map(x=>x.id))+1,semester:String(Math.min(12,rows.length+1)),sgpa:"",credits:""}])} disabled={guestCgpaRows.length>=12}>＋ Add semester</button><button className="sp-primary" onClick={()=>{const valid=guestCgpaRows.filter(x=>x.sgpa!==""&&x.credits!==""&&Number(x.sgpa)>=0&&Number(x.sgpa)<=10&&Number(x.credits)>0&&Number(x.credits)<=20);if(!valid.length||valid.length!==guestCgpaRows.length){setNotice("Enter a valid SGPA from 0 to 10 and credits from 1 to 20 for every semester.");setGuestCgpaResult(null);return;}const credits=valid.reduce((sum,x)=>sum+Number(x.credits),0);setGuestCgpaResult(valid.reduce((sum,x)=>sum+Number(x.sgpa)*Number(x.credits),0)/credits);}}>Calculate CGPA →</button><button className="sp-secondary" onClick={()=>{setGuestCgpaRows([{id:1,semester:"1",sgpa:"",credits:""}]);setGuestCgpaResult(null);}}>Reset</button></div></Card><Card className="sp-result sp-cgpa-result-panel"><span>YOUR CGPA</span><div className="sp-score">{guestCgpaResult===null?"—":guestCgpaResult.toFixed(2)}<small>/ 10</small></div><h3>{guestCgpaResult===null?"Your result appears here":"Calculation complete"}</h3><p>Credit-weighted cumulative grade point average from the semester entries above.</p><div className="sp-result-line"><span>Semesters entered</span><b>{guestCgpaRows.length}</b></div><div className="sp-result-line"><span>Total credits</span><b>{guestCgpaRows.reduce((sum,x)=>sum+(Number(x.credits)||0),0)}</b></div></Card></div></>:<><div className="sp-metrics"><article><span>CURRENT CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>Credit-weighted from saved records</small></article><article><span>SEMESTERS SAVED</span><strong>{results.length}</strong><small>Academic history</small></article><article><span>TOTAL CREDITS</span><strong>{cgpaCredits}</strong><small>Across saved semesters</small></article><article><span>WEIGHTED POINTS</span><strong>{results.reduce((s,r)=>s+r.sgpa*r.credits,0).toFixed(1)}</strong><small>SGPA × semester credits</small></article></div><Card><div className="sp-card-head"><div><span>SEMESTER HISTORY</span><h2>Saved academic results</h2></div></div>{results.length?results.map(r=><div className="sp-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(3)} SGPA</strong><button onClick={()=>{const next=results.filter(x=>x.id!==r.id);setResults(next);localStorage.setItem("gradly_semester_results",JSON.stringify(next));}}>Remove</button></div>):<div className="sp-empty"><span>◈</span><h3>Your academic history starts here</h3><p>Calculate and save a semester SGPA to build your CGPA profile.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Calculate SGPA →</button></div>}</Card></>}</>}

{section==="cgpaWhatIf"&&<><SectionTitle kicker="CGPA ANALYSIS" title="CGPA what-if analysis" copy="Model how a future semester result could change your cumulative grade point average."/><Card><div className="sp-card-head"><div><span>FUTURE SEMESTER SIMULATION</span><h2>Try a hypothetical result</h2></div></div><div className="sp-inline-form"><label>Hypothetical SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={e=>setWhatIf(e.target.value)}/></label><label>Next semester credits<input type="number" min="1" value={totalCredits} onChange={e=>setTotalCredits(e.target.value)}/></label><div className="sp-inline-result"><span>Projected CGPA</span><strong>{cgpaCredits+Number(totalCredits)>0?((cgpaValue*cgpaCredits+Number(whatIf)*Number(totalCredits))/(cgpaCredits+Number(totalCredits))).toFixed(2):"—"}</strong></div></div><p className="sp-muted">Projection is credit-weighted using the semester credits entered. It is an estimate, not an official result.</p></Card></>}

{section==="cgpaTracker"&&<><SectionTitle kicker="CUMULATIVE PERFORMANCE" title="CGPA progress tracker" copy="Track how your credit-weighted CGPA changes as you add semester results."/><Card><div className="sp-card-head"><div><span>CUMULATIVE TREND</span><h2>CGPA after each semester</h2></div><b>{results.length} records</b></div>{results.length?<div className="sp-chart">{results.reduce((acc,row)=>{const prev=acc.length?acc[acc.length-1]:{credits:0,points:0};const credits=prev.credits+row.credits;const points=prev.points+row.sgpa*row.credits;acc.push({semester:row.semester,cgpa:credits?points/credits:0,credits,points});return acc;},[] as {semester:number;cgpa:number;credits:number;points:number}[]).map(row=><div className="sp-bar-col" key={row.semester}><strong>{row.cgpa.toFixed(2)}</strong><div className="sp-bar-track"><i style={{height:(row.cgpa*10)+"%"}}/></div><span>Sem {row.semester}</span></div>)}</div>:<div className="sp-empty"><span>▥</span><h3>No cumulative history yet</h3><p>Save semester SGPA and credit records to build your CGPA graph.</p></div>}</Card></>}

{section==="planner"&&<><SectionTitle kicker="GOAL-BASED PLANNING" title="CGPA planner" copy="Set a target CGPA and estimate the credit-weighted performance needed in your remaining semesters."/><Card><div className="sp-card-head"><div><span>CGPA GOAL PLANNER</span><h2>What do you want to achieve?</h2></div></div><div className="sp-inline-form"><label>Desired final CGPA<input type="number" min="0" max="10" step=".01" value={targetSgpa} onChange={e=>setTargetSgpa(e.target.value)}/></label><label>Expected total semesters<input type="number" min={Math.max(1,results.length+1)} max="12" value={remainingSemesters+results.length} readOnly/></label></div><div className="sp-plan-result"><span>ESTIMATED AVERAGE SGPA NEEDED IN REMAINING SEMESTERS</span><strong>{results.length?requiredAverage.toFixed(2):"Enter and save your semester results first"}</strong><p>{results.length?(requiredAverage>10?"This target is not mathematically reachable under a 10-point scale using the current assumptions.":requiredAverage<=0?"Your saved results already meet or exceed this target.":"This estimate uses your saved semester credits and the average credits per future semester; actual future credit loads may change the requirement."):"Your saved academic history is needed to calculate a meaningful target."}</p></div><button className="sp-primary" onClick={()=>navigate("sgpa")}>Plan a semester SGPA →</button></Card><Card><div className="sp-card-head"><div><span>PLANNING CHECKLIST</span><h2>Build a practical plan</h2></div></div><ul className="sp-checklist"><li>Review your current subject credits and grade points.</li><li>Identify subjects where focused study can improve your grade.</li><li>Use what-if analysis before finalising your semester target.</li><li>Save official results to keep your tracker accurate.</li></ul></Card></>}
        {section==="tracker"&&<><SectionTitle kicker="PERFORMANCE OVER TIME" title="SGPA progress tracker" copy="A visual record of your saved semester results. Add results to see your progress chart grow."/><Card><div className="sp-card-head"><div><span>SEMESTER PERFORMANCE</span><h2>Your SGPA trend</h2></div><b>{results.length} records</b></div>{results.length?<div className="sp-chart">{results.map(r=><div className="sp-bar-col" key={r.id}><strong>{r.sgpa.toFixed(2)}</strong><div className="sp-bar-track"><i style={{height:(r.sgpa*10)+"%"}}/></div><span>Sem {r.semester}</span></div>)}</div>:<div className="sp-empty"><span>▥</span><h3>No results to chart yet</h3><p>Your semester-wise graph will appear after you save an SGPA calculation.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Add first result →</button></div>}</Card><Card><div className="sp-card-head"><div><span>PERFORMANCE LOG</span><h2>Semester records</h2></div></div>{results.map(r=><div className="sp-history-row sp-semester-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(2)} SGPA</strong><strong>{getCgpaThroughSemester(r.semester)?.toFixed(2)??"—"} CGPA</strong><small>{new Date(r.savedAt).toLocaleDateString()}</small>{!isGuest&&<><button type="button" className="sp-download-result" onClick={()=>{setSelectedSemester(r.semester);setSection("sgpa");setNotice("");}}>Edit grades</button><button type="button" className="sp-download-result" onClick={()=>downloadSemesterReport(r)}>Download PDF</button></>}</div>)}</Card></>}
        {section==="credits"&&<><SectionTitle kicker="ACADEMIC ELIGIBILITY" title="Credit analyser" copy="Understand how many credits you have completed and how many remain against your programme requirement."/><Card><div className="sp-card-head"><div><span>CREDIT COMPLETION</span><h2>Your academic credit progress</h2></div></div><div className="sp-inline-form"><label>Required credits<input type="number" min="1" value={totalCredits} onChange={e=>setTotalCredits(e.target.value)}/></label><label>Earned credits<input type="number" min="0" value={earnedCredits} onChange={e=>setEarnedCredits(e.target.value)}/></label></div><div className="sp-credit-visual"><div><strong>{remainingCredits}</strong><span>credits remaining</span></div><div className="sp-credit-track"><i style={{width:Math.min(100,Number(totalCredits)>0?Number(earnedCredits)/Number(totalCredits)*100:0)+"%"}}/></div><div className="sp-credit-labels"><span>{earnedCredits||0} earned</span><span>{totalCredits||0} required</span></div></div><p className="sp-muted">Enter the credit requirement published by your institution. Eligibility rules, compulsory courses and minimum grade conditions must also be checked before treating this as an official clearance.</p></Card></>}
        {section==="community"&&<><SectionTitle kicker="LEARN TOGETHER" title="Community group chat" copy="A shared study space for classmates to exchange questions and learning material."/><div className="sp-two-col"><Card><div className="sp-card-head"><div><span>STUDENT DISCUSSION</span><h2>Group conversation</h2></div><b>Preview</b></div><div className="sp-chat-list">{messages.map(m=><div className={"sp-chat-message "+(m.mine?"mine":"")} key={m.id}><div><b>{m.author}</b><small>{m.time}</small></div><p>{m.body}</p>{m.mine&&<div className="sp-message-actions"><button onClick={()=>{setEditingId(m.id);setMessage(m.body);}}>Edit</button><button onClick={()=>setMessages(cur=>cur.filter(x=>x.id!==m.id))}>Delete</button></div>}</div>)}</div><form className="sp-chat-compose" onSubmit={submitMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder={editingId?"Edit your message…":"Write a message…"}/><button className="sp-primary">{editingId?"Save":"Send"} →</button></form><small className="sp-muted">Frontend preview: messages are currently local to this browser, not shared with other students.</small></Card><Card><div className="sp-card-head"><div><span>STUDY MATERIAL</span><h2>Notes library</h2></div></div><button className="sp-upload" onClick={()=>fileRef.current?.click()}>＋ Upload notes or documents</button><input ref={fileRef} type="file" hidden multiple onChange={e=>setNotes(cur=>[...cur,...Array.from(e.target.files||[]).map(f=>({name:f.name,size:(f.size/1024).toFixed(0)+" KB",file:f}))])}/>{notes.length?notes.map((n,i)=><div className="sp-note-row" key={i}><span>▤</span><div><b>{n.name}</b><small>{n.size}</small></div><button onClick={()=>setNotes(cur=>cur.filter((_,j)=>i!==j))}>Remove</button></div>):<div className="sp-empty compact"><span>▤</span><p>Your uploaded files will appear here in this preview.</p></div>}<small className="sp-muted">Cloud sharing and downloads will activate with the notes-storage API.</small></Card></div></>}
        {section==="events"&&<><SectionTitle kicker="COMMUNITY" title="Upcoming events & holidays" copy="A shared calendar for academic events, campus activities and holidays."/><Card><div className="sp-card-head"><div><span>EVENT CALENDAR</span><h2>What's coming up</h2></div><b>Campus feed</b></div><div className="sp-empty"><span>✦</span><h3>Campus calendar is ready for connection</h3><p>Upcoming events and official holiday lists will appear here once an institution calendar feed is connected. No dates are invented in this preview.</p></div></Card></>}

{section==="assistant"&&<><SectionTitle kicker="YOUR ACADEMIC COMPANION" title="AI chatbot" copy="Ask questions about study planning, concepts and your academic journey."/><Card className="sp-ai-card"><div className="sp-ai-head"><span>✳</span><div><b>Gradly AI</b><small>Academic assistant · preview</small></div><i/></div><div className="sp-ai-thread">{aiMessages.map((m,i)=><div className={"sp-ai-bubble "+m.role} key={i}>{m.text}</div>)}</div><form className="sp-chat-compose" onSubmit={submitAi}><input value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Ask an academic question…"/><button className="sp-primary">Send →</button></form><p className="sp-muted">This interface is a frontend preview. Institution-specific answers require approved college documents, a retrieval system and a connected AI service. Do not rely on this preview for official rules.</p></Card></>}
        {section==="aiStudyPlanner"&&<><SectionTitle kicker="AI ASSISTANT" title="AI study planner" copy="Create a study routine around your subjects, deadlines and available time."/><Card><div className="sp-card-head"><div><span>STUDY PLAN SETUP</span><h2>Build your weekly study plan</h2></div></div><div className="sp-inline-form"><label>Daily study time<input type="number" min="1" max="16" defaultValue="3"/></label><label>Priority subject<input placeholder="e.g. Engineering Mathematics"/></label><label>Target date<input type="date"/></label></div><div className="sp-empty compact"><span>✳</span><p>Connect the AI planner service to generate and adapt a personalised schedule. This screen is the setup interface; it will not pretend a plan was generated.</p></div></Card></>}

{section==="academicManagement"&&<><SectionTitle kicker="ACADEMICS" title="Academic management" copy="Manage the academic records connected to your student profile."/><Card><div className="sp-card-head"><div><span>ACADEMIC RECORD</span><h2>Institution and programme</h2></div></div><div className="sp-profile-grid"><div><span>Institution</span><b>{profile.institutionName||"Not selected"}</b></div><div><span>Programme</span><b>{profile.programName||"Not configured"}</b></div><div><span>Branch</span><b>{profile.branchName||"Not configured"}</b></div><div><span>Current semester</span><b>{profile.semester||"Not configured"}</b></div><div><span>Admission mode</span><b>{profile.admissionMode||"Not configured"}</b></div><div><span>Scheme</span><b>{profile.scheme||"Not configured"}</b></div></div><div className="sp-actions"><button className="sp-primary" onClick={()=>setOnboarding(true)}>Manage academic profile →</button><button className="sp-secondary" onClick={()=>routeNavigate("/exam-profile")}>Edit exam profile →</button></div></Card></>}

{section==="settings"&&<><SectionTitle kicker="YOUR WORKSPACE" title="Personalise Gradly" copy="Make your academic workspace comfortable, clear and easy to use."/><Card className="sp-preference-card"><div className="sp-card-head"><div><span>DISPLAY EXPERIENCE</span><h2>Choose your appearance</h2></div></div><div className="sp-theme-choices">{[{id:"light",icon:"☀",label:"Light",copy:"Bright and focused"},{id:"dark",icon:"☾",label:"Dark",copy:"Easy on the eyes"},{id:"system",icon:"◐",label:"Device",copy:"Follow your device"}].map(option=><button type="button" key={option.id} className={themeMode===option.id?"selected":""} onClick={()=>{setThemeMode(option.id as "light"|"dark"|"system");updateSetting("gradly_theme",option.id);}}><span>{option.icon}</span><strong>{option.label}</strong><small>{option.copy}</small>{themeMode===option.id&&<b>✓ Selected</b>}</button>)}</div></Card><Card className="sp-preference-card"><div className="sp-card-head"><div><span>READABILITY</span><h2>Typography</h2></div></div><div className="sp-inline-form"><label>Font family<select value={fontFamily} onChange={e=>{setFontFamily(e.target.value);updateSetting("gradly_font_family",e.target.value);}}><option>DM Sans</option><option>Manrope</option><option>Inter</option><option>Arial</option><option>Georgia</option><option>Verdana</option></select></label><label>Text size · {textSize}px<input type="range" min="12" max="20" value={textSize} onChange={e=>{setTextSize(Number(e.target.value));updateSetting("gradly_text_size",e.target.value);}}/></label></div><div className="sp-type-preview" style={{fontFamily,fontSize:textSize+"px"}}>The quick brown fox jumps over the lazy dog. <strong>Academic progress, made clearer.</strong></div><p className="sp-muted">Your appearance and typography preferences are saved in this browser.</p></Card></>}

{section==="profile"&&<><SectionTitle kicker="YOUR DETAILS" title="Academic profile" copy="Review and update your institution and academic identity."/><Card><div className="sp-card-head"><div><span>STUDENT IDENTITY</span><h2>{user?.displayName||"Student"}</h2></div><span className="sp-status"><i/> Google verified</span></div><div className="sp-profile-grid"><div><span>Email</span><b>{user?.email||"—"}</b></div><div><span>Institution</span><b>{profile.institutionName||"Not selected"}</b></div><div><span>Programme</span><b>{profile.programName||"—"}</b></div><div><span>Branch</span><b>{profile.branchName||"—"}</b></div><div><span>Semester</span><b>{profile.semester||"—"}</b></div><div><span>Enrollment</span><b>{profile.enrollment||"—"}</b></div><div><span>Admission mode</span><b>{profile.admissionMode||"—"}</b></div><div><span>Scheme</span><b>{profile.scheme||"—"}</b></div></div><div className="sp-actions"><button className="sp-primary" onClick={()=>setOnboarding(true)}>Edit academic profile →</button><button className="sp-secondary" onClick={()=>routeNavigate("/exam-profile")}>Edit exam profile →</button></div>
{!isGuest && [0,6].includes(new Date().getMonth()) && Number(profile.semester) > 0 && <div className="sp-actions" style={{marginTop:14,alignItems:"end"}}><label className="sp-muted">Promote to next semester<select value={nextSemester} onChange={event=>setNextSemester(event.target.value)}><option value="">Select semester</option><option value={String(Number(profile.semester)+1)}>Semester {Number(profile.semester)+1}</option></select></label><button className="sp-secondary" type="button" onClick={()=>void promoteSemester()} disabled={semesterPromotion || !nextSemester}>{semesterPromotion?"Updating…":"Update semester"}</button></div>}</Card><Card className="sp-preference-card"><div className="sp-card-head"><div><span>ACCOUNT CONTROL</span><h2>Delete Gradly account</h2></div></div><p className="sp-muted">This closes your Gradly student account and deletes your saved academic profile and semester records. Signing in again starts a new academic setup. Minimal account and audit history may remain for security and administrator review.</p><div className="sp-actions"><button className="sp-secondary" type="button" onClick={() => void deleteStudentAccount()} disabled={deletingAccount || isGuest}>{deletingAccount ? "Deleting account…" : "Delete my Gradly account"}</button></div>{notice && <p className="sp-muted" role="alert">{notice}</p>}</Card><Card><div className="sp-card-head"><div><span>SUPPORT</span><h2>Contact the developer</h2></div></div><p className="sp-muted">Report an issue, suggest a feature or share feedback about Gradly.</p><a className="sp-primary sp-link" href="https://github.com/jugal4096/gradly/issues" target="_blank" rel="noreferrer">Contact developer ↗</a></Card></>}
      </div>
      <footer className="sp-footer"><span>© {new Date().getFullYear()} Gradly</span><span>CALCULATE · UNDERSTAND · PLAN</span><span>Built for your next chapter ✦</span></footer>
    </main>

    {gradeReminderOpen&&section==="sgpa"&&<div className="sp-modal-backdrop top"><section className="sp-modal sp-request-modal"><div className="sp-modal-head"><div><span className="sp-kicker">A QUICK CHECK BEFORE YOU START</span><h2>Enter your grades carefully</h2><p>Even one incorrect grade or credit value can change your SGPA. Before continuing, verify each subject, its credits and the grade you select. Your result will recalculate automatically whenever you make a change.</p></div><button type="button" aria-label="Close grade reminder" onClick={()=>setGradeReminderOpen(false)}>×</button></div><div className="sp-actions"><button className="sp-primary" type="button" onClick={()=>setGradeReminderOpen(false)}>I’ve checked — continue →</button></div></section></div>}

    {loginGate&&<div className="sp-modal-backdrop top"><section className="sp-modal sp-request-modal"><div className="sp-modal-head"><div><span className="sp-kicker">GRADLY ACCOUNT</span><h2>Unlock your student workspace</h2><p>This feature is available to signed-in students. Your guest calculations remain on this device.</p></div><button onClick={()=>setLoginGate(false)}>×</button></div><div className="sp-actions"><button className="sp-primary" onClick={()=>void loginWithGoogle()}>Continue with Google →</button><button className="sp-secondary" onClick={()=>setLoginGate(false)}>Maybe later</button></div></section></div>}

  </div>;
}
