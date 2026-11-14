import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./StudentPlatform.css";
import GuestOnboarding from "./GuestOnboarding";
import { findNepOpenElective, getNepOpenElectiveDisplayCode, getNepOpenElectives, isNepSchemeName, NEP_OPEN_ELECTIVES } from "./nep-open-electives";

type Section = "home" | "sgpa" | "sgpaWhatIf" | "sgpaPlanner" | "tracker" | "cgpa" | "cgpaWhatIf" | "planner" | "cgpaTracker" | "community" | "events" | "assistant" | "aiStudyPlanner" | "profile" | "academicManagement" | "settings" | "credits";
type Profile = { institutionId: string; institutionName: string; programId: string; programName: string; branchId: string; branchName: string; curriculumId: string; semester: string; enrollment: string; admissionYear: string; admissionMode: string; admissionNumber: string; scheme: string };
type Subject = { id: number; name: string; credits: number; grade: string; courseCode?: string; courseType?: string; curriculumSubjectId?: string; electiveKind?: "OE"|"HS"|"PE4"|"PE4LAB"|"PE5"|"PE6A"|"PE6ALAB"|"PE6B"|"PE6BLAB"|"PE6C"|null; electiveSlotCode?: string; pe4Option?: (typeof PE4_OPTIONS)[number]; isCustom?: boolean };
type ElectiveOption = { code: string; name: string; credits: number; officialCode?: string; department?: string; semester?: number };
const OE_OPTIONS: ElectiveOption[] = [
  {code:"CE3008",name:"Disaster Management",credits:3},{code:"CE2014",name:"Rural Technology",credits:3},{code:"CEOE0040",name:"Infrastructure Management",credits:3},
  {code:"ME2022",name:"Total Quality Management",credits:3},{code:"ME4015",name:"Industrial Management",credits:3},{code:"ME4031",name:"Renewable Energy Engineering",credits:3},{code:"ME3027",name:"Quality Management System",credits:3},{code:"MEOE0050",name:"Additive Manufacturing",credits:3},
  {code:"EE3018",name:"Entrepreneurship Development",credits:3},{code:"EE4046",name:"Energy and Environment",credits:3},
  {code:"ET3033",name:"Consumer Electronics",credits:3},{code:"ET3034",name:"Microcontroller Applications",credits:3},{code:"ET3035",name:"Industrial Automation Applications",credits:3},
  {code:"CS2017",name:"Introduction to C & C++",credits:3},{code:"OEIT4001",name:"Machine Learning",credits:3},
];
const PE4_OPTIONS = [
  {code:"ITPE4001",name:"Advanced DBMS",labCode:"ITPE4002",labName:"Lab Advanced DBMS"},
  {code:"ITPE4003",name:"Image Processing and Computer Vision",labCode:"ITPE4004",labName:"Lab Image Processing and Computer Vision"},
  {code:"ITPE4005",name:"Cloud Computing",labCode:"ITPE4006",labName:"Lab Cloud Computing"},
];
const PE6_PAIR_OPTIONS = [
  {code:"ITPE3001",name:"Mobile Computing",credits:3,labCode:"ITPE3002",labName:"Lab Mobile Computing"},
  {code:"ITPE3003",name:"Cryptography & Network Security",credits:3,labCode:"ITPE3004",labName:"Lab Cryptography & Network Security"},
  {code:"ITPE3005",name:"Advanced DBMS",credits:3,labCode:"ITPE3006",labName:"Lab Advanced DBMS"},
  {code:"ITPE3007",name:"Data Mining",credits:3,labCode:"ITPE3008",labName:"Lab Data Mining"},
];
const PE6_THIRD_OPTIONS: ElectiveOption[] = [
  {code:"ITPE3031",name:"Speech and Natural Language Processing",credits:3},
  {code:"ITPE3032",name:"Deep Learning",credits:3},
];
const PE5_OPTIONS: ElectiveOption[] = [
  {code:"ITPE4010",name:"Reinforcement Learning",credits:3},{code:"ITPE4011",name:"Applied Accelerated Artificial Intelligence",credits:3},
  {code:"ITPE4012",name:"Deep Learning for Computer Vision",credits:3},{code:"ITPE4013",name:"Cyber Security and Privacy",credits:3},
  {code:"ITPE4015",name:"Social Networks",credits:3},
];
const PE_OPTIONS: ElectiveOption[] = [
  ...PE4_OPTIONS.map(option=>({code:option.code,name:option.name,credits:3})),
  ...PE5_OPTIONS,
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
function isNepBtechProfile(profile:Profile):boolean {
  return isNepSchemeName(profile.scheme)&&/bachelor of technology|\bb\.?\s*tech\b|\bb\.?\s*e\.?\b/i.test(profile.programName);
}
function getOEOptionsForStudent(profile:Profile,semester:number):ElectiveOption[] {
  return isNepBtechProfile(profile)?getNepOpenElectives(profile.branchName,semester):OE_OPTIONS;
}
function getAllOEOptionsForStudent(profile:Profile):ElectiveOption[] {
  return isNepBtechProfile(profile)?NEP_OPEN_ELECTIVES:OE_OPTIONS;
}
function isOECodeForStudent(profile:Profile,code:string):boolean {
  return isNepBtechProfile(profile)?Boolean(findNepOpenElective(code)):OE_OPTIONS.some(option=>option.code.toUpperCase()===String(code||"").toUpperCase());
}
function getOECodeLabel(profile:Profile,code:string):string {
  return isNepBtechProfile(profile)?getNepOpenElectiveDisplayCode(code):code;
}
function getOEOptionsForSlot(profile:Profile,semester:number,credits:number):ElectiveOption[] {
  if(!isNepBtechProfile(profile)) return OE_OPTIONS;
  return getOEOptionsForStudent(profile,semester).filter(option=>!option.credits||!credits||option.credits===credits);
}
function electiveKind(code:string, semester:number, name="", courseType="", isNep=false):"OE"|"HS"|"PE4"|"PE4LAB"|"PE5"|"PE6A"|"PE6ALAB"|"PE6B"|"PE6BLAB"|"PE6C"|null {
  const slotName=name.toLowerCase().replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  if(semester===6 && /professional elective/.test(slotName)) {
    if(/iii|3rd|third/.test(slotName)) return "PE6C";
    if(/lab/.test(slotName) && /ii\b|2nd|second/.test(slotName)) return "PE6BLAB";
    if(/lab/.test(slotName) && /i\b|1st|first/.test(slotName)) return "PE6ALAB";
    if(/ii\b|2nd|second/.test(slotName)) return "PE6B";
    if(/i\b|1st|first/.test(slotName)) return "PE6A";
  }
  if(semester===7 && /professional elective/.test(slotName)) {
    if(/lab/.test(slotName) && /iv\b|4th|fourth/.test(slotName)) return "PE4LAB";
    if(/iv\b|4th|fourth/.test(slotName)) return "PE4";
    if(/v\b|5th|fifth/.test(slotName)) return "PE5";
  }
  if (isNep && (/^[A-Z]{2}OEC/i.test(code) || /open\s*elective/i.test(name+" "+courseType) || /(^|[^A-Z])OE([^A-Z]|$)/i.test(courseType))) return "OE";
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
  const totalCreditUnits=rows.reduce((sum,subject)=>sum+Math.round(subject.credits*1000),0);
  const target=Math.max(0,Math.min(10,Number.isFinite(targetInput)?targetInput:0));
  const gradeOptions=Object.entries(POINTS).sort((a,b)=>a[1]-b[1]);
  const empty={grades:{} as Record<number,string>,projected:0};
  if(!rows.length||!totalCreditUnits) return Array.from({length:3},(_,index)=>({label:["Balanced exact plan","Credit-priority exact plan","Alternative exact plan"][index],description:"Add subjects with credits to calculate this report card.",...empty}));
  let states=new Map<number,string[][]>([[0,[[]]]]);
  for(const subject of rows) {
    const creditUnits=Math.round(subject.credits*1000);
    const next=new Map<number,string[][]>();
    for(const [weightedUnits,assignments] of states) {
      for(const [grade,points] of gradeOptions) {
        const score=weightedUnits+points*creditUnits;
        let bucket=next.get(score);
        if(!bucket) {bucket=[];next.set(score,bucket);}
        for(const assignment of assignments) {
          if(bucket.length>=3) break;
          bucket.push([...assignment,grade]);
        }
      }
    }
    states=next;
  }
  let bestScore=0;
  let bestDifference=Number.POSITIVE_INFINITY;
  for(const score of states.keys()) {
    const difference=Math.abs(score/totalCreditUnits-target);
    if(difference<bestDifference) {bestDifference=difference;bestScore=score;}
  }
  const exact=bestDifference<0.0005;
  const assignments=states.get(bestScore)||[[]];
  const selected=Array.from({length:3},(_,index)=>assignments[index%assignments.length]);
  const labels=["Balanced report card","Credit-priority report card","Alternative report card"];
  const descriptions=[
    "An independent grade combination for your target SGPA.",
    "A separate grade combination using the same subject list and target.",
    "A third independent grade combination for the same target.",
  ];
  return selected.map((assignment,index)=>{
    const grades:Record<number,string>={};
    rows.forEach((subject,subjectIndex)=>{grades[subject.id]=assignment[subjectIndex]||"D";});
    return {label:labels[index],description:exact?descriptions[index]:"Closest mathematically possible grade combination for this subject and credit mix.",grades,projected:bestScore/totalCreditUnits,exact};
  });
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
  const [cgpaWhatIfSgpas,setCgpaWhatIfSgpas] = useState<Record<number,string>>(() => { try { const saved=JSON.parse(localStorage.getItem(isGuest ? "gradly_guest_semester_results" : "gradly_semester_results") || "[]") as SemesterResult[]; return Object.fromEntries(saved.map(row=>[row.semester,String(row.sgpa)])); } catch { return {}; } });
  const [whatIfSemester,setWhatIfSemester] = useState<number>(()=>Math.max(isDseAdmission(profile.admissionMode,profile.enrollment)?3:1,Number(profile.semester)||1));
  const [whatIfSubjects,setWhatIfSubjects] = useState<Subject[]>([]);
  const [whatIfLoading,setWhatIfLoading] = useState(false);
  const [whatIfNotice,setWhatIfNotice] = useState("");
  const [whatIfScenariosSaved,setWhatIfScenariosSaved] = useState<{id:number;name:string;semester:number;sgpa:number;credits:number;subjects:Subject[]}[]>([]);
  const [whatIfScenarioName,setWhatIfScenarioName] = useState("");
  const [targetSgpa,setTargetSgpa] = useState("9");
  const [trackerChartType,setTrackerChartType] = useState<"line"|"bar"|"histogram">("line");
  const [trackerSelectedSemester,setTrackerSelectedSemester] = useState(0);
  const [cgpaTrackerChartType,setCgpaTrackerChartType] = useState<"line"|"bar"|"histogram">("line");
  const [cgpaPlannerTarget,setCgpaPlannerTarget] = useState("8.5");
  const [cgpaPlannerScenarios,setCgpaPlannerScenarios] = useState<{id:number;label:string;description:string;sgpas:Record<number,string>}[]>([]);
  const [plannerSemester,setPlannerSemester] = useState<number>(()=>Math.max(isDseAdmission(profile.admissionMode,profile.enrollment)?3:1,Number(profile.semester)||(isDseAdmission(profile.admissionMode,profile.enrollment)?3:1)));
  const [plannerReportCards,setPlannerReportCards] = useState<{id:number;label:string;description:string;subjects:Subject[]}[]>([]);
  const [plannerCardAddTypes,setPlannerCardAddTypes] = useState<Record<number,"OE"|"HS">>({1:"OE",2:"OE",3:"OE"});
  const [plannerLoading,setPlannerLoading] = useState(false);
  const [plannerNotice,setPlannerNotice] = useState("");
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
    setCgpaWhatIfSgpas(Object.fromEntries(results.map(row=>[row.semester,String(row.sgpa)])));
    const ordered=[...results].filter(row=>row.credits>0).sort((a,b)=>a.semester-b.semester);
    setCgpaPlannerScenarios(current=>{
      const labels=["Conservative scenario","Balanced scenario","Ambitious scenario"];
      const descriptions=["Explore a cautious grade outcome across your semesters.","Model a realistic improvement path semester by semester.","Test a stronger performance path and its cumulative impact."];
      return labels.map((label,index)=>{
        const existing=current[index];
        const sgpas:Record<number,string>={};
        ordered.forEach(row=>{sgpas[row.semester]=existing?.sgpas[row.semester]??String(row.sgpa);});
        return {id:index+1,label,description:descriptions[index],sgpas};
      });
    });
  }, [results]);

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
              const courseType=code==="INHS1020"?"Universal Human Values (UHV)":isOECodeForStudent(profile,code)?"Open Elective (OE)":HS_OPTIONS.some(option=>option.code===code)?"Humanities & Social Sciences (HS)":PE_OPTIONS.some(option=>option.code===code)?"Professional Elective (PE)":"Additional course";
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
          const kind=electiveKind(courseCode,selectedSemester,String(item.name||""),String(item.courseType||""),isNepBtechProfile(profile));
          const selectedCode=previous?.courseCode||courseCode;
          const option=kind==="OE"?getAllOEOptionsForStudent(profile).find(x=>x.code===selectedCode):kind==="HS"?hsOptionsForSemester(selectedSemester).find(x=>x.code===selectedCode):kind==="PE5"?PE5_OPTIONS.find(x=>x.code===selectedCode):kind==="PE6C"?PE6_THIRD_OPTIONS.find(x=>x.code===selectedCode):undefined;
          const pe4=kind==="PE4"?PE4_OPTIONS.find(x=>x.code===selectedCode):kind==="PE4LAB"?PE4_OPTIONS.find(x=>x.labCode===selectedCode):undefined;
          return {id:index+1,name:previous?.name||option?.name||item.name||"",credits:previous?.credits??(option?.credits||Number(item.credits||0)),grade:previous?.grade||"",courseCode:selectedCode,courseType:String(item.courseType||""),curriculumSubjectId:subjectId,electiveKind:kind,electiveSlotCode:courseCode,pe4Option:pe4};
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

  useEffect(() => {
    if(isGuest || !user || !profile.curriculumId || section!=="sgpaWhatIf") return;
    let cancelled=false;
    setWhatIfLoading(true);
    setWhatIfNotice("");
    void (async()=>{
      try {
        const response=await fetch(API+`/api/academic/curricula/${encodeURIComponent(profile.curriculumId)}/semesters/${whatIfSemester}/subjects`);
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to load this semester's curriculum.");
        if(cancelled) return;
        const saved=savedSubjectsBySemester[whatIfSemester]||[];
        const savedByCode=new Map(saved.filter(item=>item.courseCode).map(item=>[item.courseCode!,item]));
        const rows:Subject[]=(Array.isArray(data.data)?data.data:[]).map((item:CurriculumSubjectApi,index:number)=>{
          const code=String(item.code||"");
          const previous=savedByCode.get(code);
          return {id:index+1,name:previous?.name||String(item.name||""),credits:previous?.credits??Number(item.credits||0),grade:previous?.grade||"A",courseCode:code,courseType:String(item.courseType||"Curriculum"),curriculumSubjectId:String(item.id||"")};
        });
        const custom=saved.filter(item=>!item.curriculumSubjectId).map((item,index)=>({...item,id:rows.length+index+1,grade:item.grade||"A"}));
        setWhatIfSubjects([...rows,...custom]);
      } catch(error) {
        if(!cancelled) {setWhatIfSubjects([]);setWhatIfNotice(error instanceof Error?error.message:"Unable to load semester subjects.");}
      } finally {if(!cancelled)setWhatIfLoading(false);}
    })();
    return ()=>{cancelled=true;};
  },[isGuest,user,profile.curriculumId,whatIfSemester,savedSubjectsBySemester,section]);

  useEffect(() => {
    setPlannerSemester(currentSemester);
  },[currentSemester]);

  useEffect(() => {
    if(section!=="sgpaPlanner") return;
    if(isGuest) { const guestRows=subjects.map(subject=>({...subject})); setPlannerReportCards(buildSgpaScenarios(Number(targetSgpa),guestRows).map((plan,index)=>({id:index+1,label:plan.label,description:plan.description,subjects:guestRows.map(subject=>({...subject,grade:plan.grades[subject.id]||"D"}))}))); setPlannerLoading(false); return; }
    if(!profile.curriculumId||!plannerSemester) { setPlannerReportCards([]); setPlannerLoading(false); return; }
    let cancelled=false;
    setPlannerLoading(true); setPlannerNotice(""); setPlannerReportCards([]);
    void (async()=>{
      try {
        const response=await fetch(API+`/api/academic/curricula/${encodeURIComponent(profile.curriculumId)}/semesters/${plannerSemester}/subjects`);
        const data=await response.json();
        if(!response.ok) throw new Error(data.message||"Unable to load the selected semester curriculum.");
        if(cancelled) return;
        const saved=savedSubjectsBySemester[plannerSemester]||[];
        const savedByCode=new Map(saved.filter(item=>item.courseCode).map(item=>[item.courseCode!,item]));
        const rows:Subject[]=(Array.isArray(data.data)?data.data:[]).map((item:CurriculumSubjectApi,index:number)=>{
          const code=String(item.code||"");
          const previous=savedByCode.get(code);
          return {id:index+1,name:previous?.name||String(item.name||""),credits:previous?.credits??Number(item.credits||0),grade:"A",courseCode:code,courseType:String(item.courseType||"Curriculum"),curriculumSubjectId:String(item.id||"")};
        });
        const custom=saved.filter(item=>!item.curriculumSubjectId).map((item,index)=>({...item,id:rows.length+index+1,grade:"A"}));
        const baseSubjects=[...rows,...custom];
        setPlannerReportCards(buildSgpaScenarios(Number(targetSgpa),baseSubjects).map((plan,index)=>({
          id:index+1,label:plan.label,description:plan.description,
          subjects:baseSubjects.map(subject=>({...subject,grade:plan.grades[subject.id]||"D"})),
        })));
      } catch(error) {
        if(!cancelled) {setPlannerReportCards([]);setPlannerNotice(error instanceof Error?error.message:"Unable to load semester subjects.");}
      } finally {if(!cancelled)setPlannerLoading(false);}
    })();
    return ()=>{cancelled=true;};
  },[section,isGuest,profile.curriculumId,plannerSemester,savedSubjectsBySemester,subjects]);

  const whatIfCreditTotal=whatIfSubjects.filter(subject=>subject.name.trim()&&subject.credits>0&&subject.courseCode?.toUpperCase()!=="INHS1020").reduce((sum,subject)=>sum+subject.credits,0);
  const whatIfWeighted=whatIfSubjects.filter(subject=>subject.name.trim()&&subject.credits>0&&POINTS[subject.grade]!==undefined).reduce((sum,subject)=>sum+POINTS[subject.grade]*subject.credits,0);
  const whatIfCountedCredits=whatIfSubjects.filter(subject=>subject.name.trim()&&subject.credits>0).reduce((sum,subject)=>sum+subject.credits,0);
  const whatIfLiveSgpa=whatIfCountedCredits?whatIfWeighted/whatIfCountedCredits:0;
  function updateWhatIfSubject(id:number,patch:Partial<Subject>) {
    setWhatIfSubjects(current=>current.map(subject=>{
      if(subject.id!==id)return subject;
      if(patch.credits!==undefined) {
        const nextCredits=Math.max(0,Number(patch.credits)||0);
        const currentLimit=current.filter(item=>item.id!==id&&item.name.trim()&&item.credits>0&&item.courseCode?.toUpperCase()!=="INHS1020").reduce((sum,item)=>sum+item.credits,0);
        if(subject.courseCode?.toUpperCase()!=="INHS1020"&&currentLimit+nextCredits>28) {setWhatIfNotice("The 28-credit semester limit cannot be exceeded. Reduce another subject's credits first.");return subject;}
        setWhatIfNotice("");
        return {...subject,...patch,credits:nextCredits};
      }
      return {...subject,...patch};
    }));
  }
  function addWhatIfSubject() {
    if(whatIfCreditTotal+3>28) {setWhatIfNotice("The 28-credit semester limit has been reached. Remove a subject or reduce credits before adding another.");return;}
    setWhatIfSubjects(current=>[...current,{id:Math.max(0,...current.map(subject=>subject.id))+1,name:"New subject",credits:3,grade:"A",courseCode:"",courseType:"Hypothetical subject",isCustom:true}]);
    setWhatIfNotice("");
  }
  function removeWhatIfSubject(id:number) {
    setWhatIfSubjects(current=>current.filter(subject=>subject.id!==id));
    setWhatIfNotice("");
  }
  function saveWhatIfScenario() {
    if(!whatIfSubjects.length||whatIfCountedCredits<=0) {setWhatIfNotice("Add at least one subject with credits before saving a test case.");return;}
    if(whatIfCreditTotal>28) {setWhatIfNotice("This test case exceeds the 28-credit semester limit.");return;}
    const name=whatIfScenarioName.trim()||`Test case ${whatIfScenariosSaved.length+1}`;
    setWhatIfScenariosSaved(current=>[...current,{id:Date.now(),name,semester:whatIfSemester,sgpa:whatIfLiveSgpa,credits:whatIfCountedCredits,subjects:whatIfSubjects.map(subject=>({...subject}))}]);
    setWhatIfScenarioName("");
    setWhatIfNotice("Test case saved for comparison. Your academic record has not been changed.");
  }

  const weighted = subjects.filter(s=>s.name.trim() && s.credits>0 && POINTS[s.grade]!==undefined).reduce((sum,s)=>sum+(POINTS[s.grade]??0)*s.credits,0);
  const countedCredits = subjects.filter(s=>s.name.trim() && s.credits>0).reduce((sum,s)=>sum+s.credits,0);
  const creditsForSemesterLimit = subjects.filter(s=>s.name.trim() && s.credits>0 && s.courseCode?.toUpperCase()!=="INHS1020").reduce((sum,s)=>sum+s.credits,0);
  const uhvAlreadyUsed = subjects.some(subject=>subject.courseCode==="INHS1020") || Object.values(savedSubjectsBySemester).some(semesterSubjects=>semesterSubjects.some(subject=>subject.courseCode==="INHS1020"));
  const previouslyOptedOECodes = new Set(Object.entries(savedSubjectsBySemester).filter(([semester])=>Number(semester)!==selectedSemester).flatMap(([,semesterSubjects])=>semesterSubjects.filter(subject=>isOECodeForStudent(profile,subject.courseCode||"")).map(subject=>subject.courseCode||"")));
  const openElectiveSlot = subjects.find(subject=>subject.electiveKind==="OE"&&(!subject.courseCode||subject.courseCode===subject.electiveSlotCode));
  const droppedOESlot = droppedElectives.find(subject=>subject.electiveKind==="OE");
  const oeSlotCreditRequirement = openElectiveSlot?.credits||droppedOESlot?.credits||0;
  const availableOEOptions = getOEOptionsForSlot(profile,selectedSemester,oeSlotCreditRequirement).filter(option=>(!isNepBtechProfile(profile)||option.credits>0||oeSlotCreditRequirement>0)&&!previouslyOptedOECodes.has(option.code));
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
  const cgpaWhatIfRows = [...results].filter(row=>row.credits>0).sort((a,b)=>a.semester-b.semester).map(row=>{
    const raw=cgpaWhatIfSgpas[row.semester]??String(row.sgpa);
    const value=raw.trim()===""?Number.NaN:Number(raw);
    return {...row,sgpaInput:raw,simulatedSgpa:value,valid:Number.isFinite(value)&&value>=0&&value<=10};
  });
  const cgpaWhatIfValid = cgpaWhatIfRows.every(row=>row.valid);
  const cgpaWhatIfCredits = cgpaWhatIfRows.reduce((sum,row)=>sum+row.credits,0);
  const cgpaWhatIfPoints = cgpaWhatIfRows.reduce((sum,row)=>sum+(row.valid?row.simulatedSgpa:0)*row.credits,0);
  const cgpaWhatIfValue = cgpaWhatIfValid&&cgpaWhatIfCredits>0?cgpaWhatIfPoints/cgpaWhatIfCredits:null;
  const cgpaWhatIfDelta = cgpaWhatIfValue===null?0:cgpaWhatIfValue-cgpaValue;
  const trackerRows = [...results].sort((a,b)=>a.semester-b.semester);
  const trackerAverage = trackerRows.length ? trackerRows.reduce((sum,row)=>sum+row.sgpa,0)/trackerRows.length : 0;
  const trackerPeak = trackerRows.reduce<SemesterResult|null>((best,row)=>!best||row.sgpa>best.sgpa?row:best,null);
  const trackerLow = trackerRows.reduce<SemesterResult|null>((worst,row)=>!worst||row.sgpa<worst.sgpa?row:worst,null);
  const trackerDelta = trackerRows.length>1 ? trackerRows[trackerRows.length-1].sgpa-trackerRows[trackerRows.length-2].sgpa : 0;
  const trackerOverallDelta = trackerRows.length>1 ? trackerRows[trackerRows.length-1].sgpa-trackerRows[0].sgpa : 0;
  const trackerVariance = trackerRows.length ? trackerRows.reduce((sum,row)=>sum+Math.pow(row.sgpa-trackerAverage,2),0)/trackerRows.length : 0;
  const trackerConsistency = Math.sqrt(trackerVariance);
  const trackerBestChange = trackerRows.slice(1).reduce<{change:number;from:number;to:number}|null>((best,row,index)=>{const change=row.sgpa-trackerRows[index].sgpa;return !best||change>best.change?{change,from:trackerRows[index].semester,to:row.semester}:best;},null);
  const trackerWorstChange = trackerRows.slice(1).reduce<{change:number;from:number;to:number}|null>((worst,row,index)=>{const change=row.sgpa-trackerRows[index].sgpa;return !worst||change<worst.change?{change,from:trackerRows[index].semester,to:row.semester}:worst;},null);
  const trackerHistogram = [{label:"0–2",min:0,max:2},{label:"2–4",min:2,max:4},{label:"4–6",min:4,max:6},{label:"6–8",min:6,max:8},{label:"8–10",min:8,max:10}].map((bin,index)=>({...bin,count:trackerRows.filter(row=>row.sgpa>=bin.min&&(index===4?row.sgpa<=bin.max:row.sgpa<bin.max)).length}));
  const cgpaCumulativeRows=trackerRows.reduce((acc,row)=>{const previous=acc.length?acc[acc.length-1]:{credits:0,weightedPoints:0};const credits=previous.credits+row.credits;const points=previous.weightedPoints+row.sgpa*row.credits;acc.push({semester:row.semester,sgpa:row.sgpa,credits:row.credits,cumulativeCredits:credits,weightedPoints:points,cgpa:credits?points/credits:0});return acc;},[] as {semester:number;sgpa:number;credits:number;cumulativeCredits:number;weightedPoints:number;cgpa:number}[]);
  const cgpaTrackerPeak=cgpaCumulativeRows.reduce<(typeof cgpaCumulativeRows)[number]|null>((best,row)=>!best||row.cgpa>best.cgpa?row:best,null);
  const cgpaTrackerLow=cgpaCumulativeRows.reduce<(typeof cgpaCumulativeRows)[number]|null>((worst,row)=>!worst||row.cgpa<worst.cgpa?row:worst,null);
  const cgpaTrackerDelta=cgpaCumulativeRows.length>1?cgpaCumulativeRows[cgpaCumulativeRows.length-1].cgpa-cgpaCumulativeRows[cgpaCumulativeRows.length-2].cgpa:0;
  const cgpaTrackerAverage=cgpaCumulativeRows.length?cgpaCumulativeRows.reduce((sum,row)=>sum+row.cgpa,0)/cgpaCumulativeRows.length:0;
  const cgpaTrackerVariance=cgpaCumulativeRows.length?cgpaCumulativeRows.reduce((sum,row)=>sum+Math.pow(row.cgpa-cgpaTrackerAverage,2),0)/cgpaCumulativeRows.length:0;
  const cgpaTrackerConsistency=Math.sqrt(cgpaTrackerVariance);
  const cgpaTrackerHistogram=[{label:"0–2",min:0,max:2},{label:"2–4",min:2,max:4},{label:"4–6",min:4,max:6},{label:"6–8",min:6,max:8},{label:"8–10",min:8,max:10}].map((bin,index)=>({...bin,count:cgpaCumulativeRows.filter(row=>row.cgpa>=bin.min&&(index===4?row.cgpa<=bin.max:row.cgpa<bin.max)).length}));
  const cgpaPlannerRows=trackerRows.filter(row=>row.credits>0);
  const cgpaPlannerScenarioResults=cgpaPlannerScenarios.map(scenario=>{const rows=cgpaPlannerRows.map(row=>{const raw=scenario.sgpas[row.semester]??String(row.sgpa);const value=raw.trim()===""?Number.NaN:Number(raw);return {...row,input:raw,value,valid:Number.isFinite(value)&&value>=0&&value<=10};});const credits=rows.reduce((sum,row)=>sum+row.credits,0);const points=rows.reduce((sum,row)=>sum+(row.valid?row.value:0)*row.credits,0);return {...scenario,rows,credits,cgpa:rows.length&&rows.every(row=>row.valid)&&credits?points/credits:null,delta:rows.length&&rows.every(row=>row.valid)&&credits?points/credits-cgpaValue:null};});
  const trackerPerformanceLabel = trackerAverage>=8.5?"Excellent consistency":trackerAverage>=7?"Strong academic base":trackerAverage>=5?"Room to accelerate":"A reset-and-rebuild opportunity";
  const trackerSubjectSemester = trackerRows.some(row=>row.semester===trackerSelectedSemester)?trackerSelectedSemester:(trackerRows[trackerRows.length-1]?.semester||0);
  const trackerSubjectResult = trackerRows.find(row=>row.semester===trackerSubjectSemester);
  const trackerSubjectRows = (savedSubjectsBySemester[trackerSubjectSemester]||[])
    .filter(subject=>subject.name.trim()&&subject.credits>0&&POINTS[subject.grade]!==undefined)
    .map(subject=>{const gradePoint=POINTS[subject.grade];const impact=trackerSubjectResult&&trackerSubjectResult.credits>0?(subject.credits*(gradePoint-trackerSubjectResult.sgpa))/trackerSubjectResult.credits:0;return {...subject,gradePoint,impact};})
    .sort((a,b)=>b.impact-a.impact);
  const trackerHelpingSubjects = trackerSubjectRows.filter(subject=>subject.impact>0.0005);
  const trackerDamagingSubjects = [...trackerSubjectRows].filter(subject=>subject.impact< -0.0005).sort((a,b)=>a.impact-b.impact);
  const trackerNeutralSubjects = trackerSubjectRows.filter(subject=>Math.abs(subject.impact)<=0.0005);
  const trackerSubjectComputedSgpa = trackerSubjectRows.length&&trackerSubjectRows.reduce((sum,subject)=>sum+subject.credits,0)>0?trackerSubjectRows.reduce((sum,subject)=>sum+subject.credits*subject.gradePoint,0)/trackerSubjectRows.reduce((sum,subject)=>sum+subject.credits,0):null;
  const trackerSubjectInference = !trackerSubjectRows.length?"Subject-level grade details are unavailable for this semester.":trackerDamagingSubjects.length===0?"No subject is below this semester's SGPA benchmark. Your listed subjects are all matching or lifting the semester average.":trackerHelpingSubjects.length===0?"No subject is above the semester SGPA benchmark. Prioritise the subjects with the largest negative weighted impact.":`${trackerHelpingSubjects.length} subject(s) lifted the result above the semester benchmark, while ${trackerDamagingSubjects.length} subject(s) pulled it down. Start with the largest negative impact, especially where the subject carries more credits.`;
  const normalizedSubjectSearch = subjectSearch.trim().toLowerCase();
  const visibleSubjects = normalizedSubjectSearch
    ? subjects.filter(subject => [subject.name, subject.courseCode, subject.courseType, subject.electiveKind]
        .some(value => String(value ?? "").toLowerCase().includes(normalizedSubjectSearch)))
    : subjects;
  const institutionLabel = profile.institutionName || localStorage.getItem("gradly_guest_institute_name") || "Institution selected";
  const name = user?.displayName?.split(" ")[0] || "Guest";
  const title = nav.find(item=>item.id===section)?.label || "Overview";

  function updatePlannerCardSubject(cardId:number,subjectId:number,patch:Partial<Subject>) {
    setPlannerReportCards(cards=>cards.map(card=>card.id===cardId?{...card,subjects:card.subjects.map(subject=>subject.id===subjectId?{...subject,...patch}:subject)}:card));
  }
  function regeneratePlannerCardGrades(cardId:number) {
    const card=plannerReportCards.find(item=>item.id===cardId);
    if(!card) return;
    const plan=buildSgpaScenarios(Number(targetSgpa),card.subjects)[(cardId-1)%3];
    setPlannerReportCards(cards=>cards.map(item=>item.id===cardId?{...item,subjects:item.subjects.map(subject=>({...subject,grade:plan.grades[subject.id]||"D"}))}:item));
  }
  function addPlannerCardElective(cardId:number,kind:"OE"|"HS",code:string) {
    const options=kind==="OE"?getOEOptionsForStudent(profile,plannerSemester):hsOptionsForSemester(plannerSemester);
    const option=options.find(item=>item.code===code);
    if(!option) return;
    if(kind==="OE"&&option.credits<=0) { setPlannerNotice("This language elective inherits credits from the approved semester OE slot. Select it in the SGPA curriculum instead."); return; }
    const card=plannerReportCards.find(item=>item.id===cardId);
    if(!card||card.subjects.some(subject=>subject.courseCode===code)) return;
    const previouslyUsedOE=new Set(Object.entries(savedSubjectsBySemester).filter(([semester])=>Number(semester)!==plannerSemester).flatMap(([,rows])=>rows.filter(subject=>isOECodeForStudent(profile,subject.courseCode||"")).map(subject=>subject.courseCode||"")));
    if(kind==="OE"&&previouslyUsedOE.has(code)) { setPlannerNotice("This open elective was already selected in another semester."); return; }
    const credits=card.subjects.reduce((sum,subject)=>sum+Math.max(0,subject.credits),0);
    if(credits+option.credits>28) { setPlannerNotice("Adding this elective would exceed the 28-credit semester limit."); return; }
    const nextId=Math.max(0,...card.subjects.map(subject=>subject.id))+1;
    setPlannerReportCards(cards=>cards.map(item=>{if(item.id!==cardId)return item;const nextSubjects=[...item.subjects,{id:nextId,name:option.name,credits:option.credits,grade:"A",courseCode:option.code,courseType:kind==="OE"?"Open Elective (OE)":"Humanities & Social Sciences (HS)",isCustom:true,electiveKind:kind}];const plan=buildSgpaScenarios(Number(targetSgpa),nextSubjects)[(cardId-1)%3];return {...item,subjects:nextSubjects.map(subject=>({...subject,grade:plan.grades[subject.id]||"D"}))};}));
    setPlannerNotice("");
  }
  function removePlannerCardSubject(cardId:number,subjectId:number) {
    setPlannerReportCards(cards=>cards.map(card=>{if(card.id!==cardId)return card;const nextSubjects=card.subjects.filter(subject=>subject.id!==subjectId);const plan=buildSgpaScenarios(Number(targetSgpa),nextSubjects)[(cardId-1)%3];return {...card,subjects:nextSubjects.map(subject=>({...subject,grade:plan.grades[subject.id]||"D"}))};}));
  }
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
          <td>${escapeReportHtml(course.courseCode ? getOECodeLabel(profile,course.courseCode) : "—")}</td>
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
    const pairGroups:Record<string,{theory:"PE6A"|"PE6B";lab:"PE6ALAB"|"PE6BLAB"}> = {
      PE6A:{theory:"PE6A",lab:"PE6ALAB"}, PE6ALAB:{theory:"PE6A",lab:"PE6ALAB"},
      PE6B:{theory:"PE6B",lab:"PE6BLAB"}, PE6BLAB:{theory:"PE6B",lab:"PE6BLAB"},
    };
    const pair=subject.electiveKind?pairGroups[subject.electiveKind]:undefined;
    if(pair) {
      const option=PE6_PAIR_OPTIONS.find(candidate=>candidate.code===code);
      setSubjects(current=>current.map(item=>{
        if(item.electiveKind===pair.theory) return {...item,courseCode:option?.code||item.electiveSlotCode,name:option?.name||"",credits:option?3:item.credits};
        if(item.electiveKind===pair.lab) return {...item,courseCode:option?.labCode||item.electiveSlotCode,name:option?.labName||"",credits:option?1:item.credits};
        return item;
      }));
      setSgpa(null); return;
    }
    setSubjects(current=>current.map(item=>{
      if(item.id!==subject.id) return item;
      if(item.electiveKind==="PE4"||item.electiveKind==="PE4LAB") {
        const option=PE4_OPTIONS.find(candidate=>candidate.code===code);
        if(!code||!option) return {...item,courseCode:item.electiveSlotCode||"",name:""};
        return item.electiveKind==="PE4"
          ? {...item,courseCode:option.code,name:option.name,credits:3}
          : {...item,courseCode:option.labCode,name:option.labName,credits:1};
      }
      const options=item.electiveKind==="OE"?getOEOptionsForSlot(profile,selectedSemester,item.credits):item.electiveKind==="HS"?hsOptionsForSemester(selectedSemester):item.electiveKind==="PE6C"?PE6_THIRD_OPTIONS:PE5_OPTIONS;
      const option=options.find(candidate=>candidate.code===code);
      return {...item,courseCode:option?.code||item.electiveSlotCode,name:option?.name||"",credits:option?.credits||item.credits,courseType:isNepBtechProfile(profile)&&item.electiveKind==="OE"?"Open Elective (OE)":item.courseType};
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
    const options:ElectiveOption[]=addCourseType==="OE"?getOEOptionsForStudent(profile,selectedSemester):addCourseType==="HS"?hsOptionsForSemester(selectedSemester):[{code:"INHS1020",name:"Universal Human Values",credits:3}];
    const option=options.find(item=>item.code===addCourseCode);
    if(!option) { setNotice("That subject is not available for this semester or programme."); return; }
    if(addCourseType==="UHV" && uhvAlreadyUsed) { setNotice("Universal Human Values can be added only once throughout your degree."); return; }
    const emptySlot=isNepBtechProfile(profile)?(addCourseType==="OE"?subjects.find(subject=>subject.electiveKind==="OE"&&(!subject.courseCode||subject.courseCode===subject.electiveSlotCode)):addCourseType==="HS"?subjects.find(subject=>subject.electiveKind==="HS"&&(!subject.courseCode||subject.courseCode===subject.electiveSlotCode)):undefined):undefined;
    const removedSlot=isNepBtechProfile(profile)?(addCourseType==="OE"?droppedElectives.find(subject=>subject.electiveKind==="OE"):addCourseType==="HS"?droppedElectives.find(subject=>subject.electiveKind==="HS"):undefined):undefined;
    const targetSlot=emptySlot||removedSlot;
    const optionCredits=option.credits||targetSlot?.credits||0;
    if(addCourseType!=="UHV"&&optionCredits<=0) { setNotice("The approved elective slot credit value is missing. Configure the semester credit value before selecting this course."); return; }
    if(targetSlot&&option.credits&&targetSlot.credits&&option.credits!==targetSlot.credits) { setNotice("This course does not match the credit requirement of the semester elective slot."); return; }
    if(isNepBtechProfile(profile)&&addCourseType==="OE"&&!targetSlot&&subjects.some(subject=>subject.electiveKind==="OE"&&subject.courseCode!==subject.electiveSlotCode&&subject.name.trim())) { setNotice("The Open Elective slot for this semester is already selected. Change that selection instead of adding a second OE."); return; }
    if(addCourseType!=="UHV"&&creditsForSemesterLimit+optionCredits>28) { setNotice("Adding this course would exceed the 28-credit semester limit."); return; }
    if(subjects.some(subject=>subject.courseCode===option.code)) { setNotice("This course is already added to the semester."); return; }
    const courseType=addCourseType==="OE"?"Open Elective (OE)":addCourseType==="HS"?"Humanities & Social Sciences (HS)":"Universal Human Values (UHV)";
    if(targetSlot) {
      setSubjects(current=>[...current.filter(subject=>subject.id!==targetSlot.id),{...targetSlot,name:option.name,credits:optionCredits,grade:"",courseCode:option.code,courseType,isCustom:false}].sort((a,b)=>a.id-b.id));
      if(removedSlot) {
        const nextDropped=droppedElectives.filter(subject=>subject.id!==removedSlot.id);
        setDroppedElectives(nextDropped);
        localStorage.setItem("gradly_dropped_electives_"+profile.curriculumId+"_"+selectedSemester,JSON.stringify(nextDropped));
      }
    } else {
      const nextId=Math.max(0,...subjects.map(subject=>subject.id))+1;
      setSubjects(current=>[...current,{id:nextId,name:option.name,credits:optionCredits,grade:"",courseCode:option.code,courseType,isCustom:true,electiveKind:addCourseType==="OE"?"OE":addCourseType==="HS"?"HS":null}]);
    }
    setSgpa(null); setNotice(""); setAddCourseDialogOpen(false); setAddCourseType(null); setAddCourseCode("");
  }
  function removeSubject(subjectId:number) {
    setSubjects(current=>{
      const selected=current.find(subject=>subject.id===subjectId);
      const paired=selected?PE6_PAIR_OPTIONS.find(option=>option.code===selected.courseCode||option.labCode===selected.courseCode):undefined;
      if(!paired) return current.filter(subject=>subject.id!==subjectId);
      return current.filter(subject=>subject.id!==subjectId&&subject.courseCode!==paired.code&&subject.courseCode!==paired.labCode);
    });
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
    if(subjects.some(subject=>subject.electiveKind&&(!subject.name.trim()||(isNepBtechProfile(profile)&&(subject.electiveKind==="OE"||subject.electiveKind==="HS")&&subject.courseCode===subject.electiveSlotCode)))){setNotice("Choose a course for every available elective slot before saving.");return;}
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
  const programmeName=profile.programName.toLowerCase();
  const totalProgrammeSemesters=programmeName.includes("mca")||programmeName.includes("m.tech")||programmeName.includes("mtech")?4:8;
  const whatIfScenarios=buildSgpaScenarios(Number(whatIf),whatIfSubjects);

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
        {!isGuest&&addCourseDialogOpen&&<div className="sp-save-success-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget){setAddCourseDialogOpen(false);setAddCourseType(null);setAddCourseCode("");}}}><section className="sp-add-elective-modal" role="dialog" aria-modal="true" aria-labelledby="sp-add-elective-title"><span className="sp-save-success-kicker">GRADLY · COURSE SELECTION</span><h2 id="sp-add-elective-title">Add an elective course</h2><p>Choose the course category, then select one of the existing subjects available for Semester {selectedSemester}.</p><div className="sp-add-elective-types"><button type="button" className={addCourseType==="OE"?"selected":""} onClick={()=>{setAddCourseType("OE");setAddCourseCode("");setNotice("");}}>Open Elective <strong>OE</strong></button><button type="button" className={addCourseType==="HS"?"selected":""} onClick={()=>{setAddCourseType("HS");setAddCourseCode("");setNotice("");}}>Humanities &amp; Social Sciences <strong>HS</strong></button><button type="button" className={addCourseType==="UHV"?"selected":""} disabled={uhvAlreadyUsed} onClick={()=>{setAddCourseType("UHV");setAddCourseCode("INHS1020");setNotice("");}}>Universal Human Values <strong>UHV · 3 credits</strong></button></div>{addCourseType?<label className="sp-add-elective-select">AVAILABLE {addCourseType==="OE"?"OPEN ELECTIVES":addCourseType==="HS"?"HUMANITIES & SOCIAL SCIENCES":"UNIVERSAL HUMAN VALUES"}<select value={addCourseCode} onChange={event=>setAddCourseCode(event.target.value)}><option value="">Select an existing subject</option>{(addCourseType==="OE"?availableOEOptions:addCourseType==="HS"?hsOptionsForSemester(selectedSemester):[{code:"INHS1020",name:"Universal Human Values",credits:3}]).map(option=><option key={option.code} value={option.code} disabled={addCourseType!=="UHV"&&(creditsForSemesterLimit+(option.credits||oeSlotCreditRequirement)>28||subjects.some(subject=>subject.courseCode===option.code))}>{getOECodeLabel(profile,option.code)} · {option.name} ({option.credits||oeSlotCreditRequirement||"slot"} credits)</option>)}</select></label>:<p className="sp-add-elective-credit-note">Choose OE, HS, or the one-time UHV subject. Professional Electives are already included in the semester curriculum. UHV can be added only once throughout your degree.</p>}{addCourseType==="UHV"?<p className="sp-add-elective-credit-note">UHV is exempt from the 28-credit semester limit. It may take your semester total above 28 credits.</p>:<p className="sp-add-elective-credit-note">Available semester capacity: {(28-countedCredits).toFixed(1)} credits. Subjects that exceed the limit cannot be selected.</p>}{uhvAlreadyUsed&&<p className="sp-add-elective-credit-note">UHV has already been added in another semester or is already present in this semester.</p>}<div className="sp-save-success-actions"><button type="button" className="sp-secondary" onClick={()=>{setAddCourseDialogOpen(false);setAddCourseType(null);setAddCourseCode("");}}>Cancel</button><button type="button" className="sp-primary" onClick={confirmAddElectiveCourse} disabled={!addCourseCode||!addCourseType||(addCourseType==="UHV"?uhvAlreadyUsed:!(addCourseType==="OE"?availableOEOptions:hsOptionsForSemester(selectedSemester)).some(option=>option.code===addCourseCode&&creditsForSemesterLimit+(option.credits||oeSlotCreditRequirement)<=28&&!subjects.some(subject=>subject.courseCode===option.code)))}>{addCourseType==="UHV"?"Add UHV":"Add selected course"}</button></div></section></div>}
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
        {section==="sgpa"&&<><section className="sp-calculator-hero"><div className="sp-calculator-hero-copy"><span className="sp-calc-eyebrow">GRADLY · ACADEMIC TOOLS</span><h1>SGPA calculator</h1><p>Bring your semester grades together and see your performance clearly.</p></div><div className="sp-calc-art" aria-hidden="true"><div className="sp-calc-orbit sp-calc-orbit-one"/><div className="sp-calc-orbit sp-calc-orbit-two"/><div className="sp-calc-cube"><span>G</span><i>✦</i></div><div className="sp-calc-float sp-calc-float-one">A+</div><div className="sp-calc-float sp-calc-float-two">10</div></div><div className="sp-calc-glow"/></section><div className="sp-entry-modes"><button type="button" className="sp-entry-mode selected" aria-pressed="true"><span>MANUAL ENTRY</span><strong>Enter grades yourself</strong><small>Available now</small></button><button type="button" className="sp-entry-mode unavailable" disabled aria-disabled="true"><span>ONLINE FETCHING</span><strong>Fetch official results</strong><small>Coming soon</small></button></div><div className="sp-two-col"><Card><div className="sp-card-head sp-sgpa-card-head"><div><span>YOUR SUBJECTS</span><h2>Grade entry</h2></div>{!isGuest&&<label className="sp-semester-picker">SEMESTER<select value={String(selectedSemester)} onChange={event=>{setSelectedSemester(Number(event.target.value));setSgpa(null);setNotice("");setSubjectSearch("");}}>{Array.from({length:Math.max(0,currentSemester-firstAvailableSemester+1)},(_,index)=>index+firstAvailableSemester).map(semester=><option key={semester} value={semester}>Semester {semester}{semester===currentSemester?" · Current":""}</option>)}</select></label>}<label className="sp-subject-search"><span>SEARCH SUBJECTS</span><input type="search" aria-label="Search subjects by name, code or course type" placeholder="Name or course code" value={subjectSearch} onChange={event=>setSubjectSearch(event.target.value)}/></label><b>{subjects.length} subjects</b></div>{!isGuest&&isCurrentSemesterInProgress&&<div className="sp-semester-journey"><div className="sp-semester-journey-mark"><span>✦</span></div><div className="sp-semester-journey-copy"><div className="sp-semester-journey-meta"><span className="sp-semester-live-dot"/><span>YOUR CURRENT CHAPTER</span><b>SEMESTER {currentSemester}</b></div><h3>Oh, you’re in the middle of the journey!</h3><p>Your Semester {currentSemester} is still in progress. Since the official result hasn’t been announced yet, your SGPA is not ready to be recorded. You can explore possible grade combinations and see where your efforts could take you with What-if Analysis.</p><button type="button" onClick={()=>navigate("sgpaWhatIf")}>Explore your possibilities <span>→</span></button><small>Official SGPA entry unlocks when you advance your academic profile to the next semester.</small></div><div className="sp-semester-journey-progress"><span>IN PROGRESS</span><strong>{currentSemester}</strong><small>Keep going</small></div></div>}{!isGuest&&!isCurrentSemesterInProgress&&<p className="sp-muted sp-semester-saved">{results.some(result=>result.semester===selectedSemester)?"Saved grades are loaded. You can edit and save them again.":"Completed semester · Enter grades, calculate SGPA and save it to your tracker."}</p>}{!isGuest&&loadingCurriculum&&<p className="sp-muted">Loading subjects from your curriculum…</p>}{!isGuest&&!loadingCurriculum&&subjects.length===0&&<div className="sp-empty compact"><span>◈</span><p>No subjects are configured for Semester {selectedSemester} in your selected curriculum.</p></div>}<div className={isGuest?"sp-subject-table sp-guest-subject-table":"sp-subject-table sp-curriculum-table"}><div className={isGuest?"sp-subject-head":"sp-subject-head sp-curriculum-head"}>{isGuest?<><span>SUBJECT</span><span>CREDITS</span><span>GRADE</span><span/></>:<><span>SUBJECT</span><span>COURSE CODE</span><span>COURSE TYPE</span><span>CREDITS</span><span>GRADE</span><span/></>}</div>{visibleSubjects.map((s,index)=><div className={isGuest?"sp-subject-row":"sp-subject-row sp-curriculum-row"} key={s.id}><div className="sp-subject-identity">{!isGuest&&s.electiveKind?<><strong>{s.electiveKind==="OE"?"OPEN ELECTIVE · OE":s.electiveKind==="HS"?"HUMANITIES & SOCIAL SCIENCES · HS":s.electiveKind==="PE6A"?"PROFESSIONAL ELECTIVE · I":s.electiveKind==="PE6ALAB"?"PROFESSIONAL ELECTIVE · I LAB":s.electiveKind==="PE6B"?"PROFESSIONAL ELECTIVE · II":s.electiveKind==="PE6BLAB"?"PROFESSIONAL ELECTIVE · II LAB":s.electiveKind==="PE6C"?"PROFESSIONAL ELECTIVE · III":(s.electiveKind==="PE4"||s.electiveKind==="PE4LAB")?"PROFESSIONAL ELECTIVE · PE-IV":"PROFESSIONAL ELECTIVE · PE-V"}</strong>{(s.electiveKind==="PE6ALAB"||s.electiveKind==="PE6BLAB")?<span className="sp-muted">{s.name||"Matching lab is added automatically when its theory subject is selected."}</span>:<select aria-label={"Choose "+s.electiveKind+" course"} value={s.electiveKind==="PE4LAB"?(PE4_OPTIONS.find(o=>o.labCode===s.courseCode)?.code||""):(s.courseCode===s.electiveSlotCode?"":s.courseCode||"")} onChange={e=>updateElectiveCourse(s,e.target.value)}><option value="">Choose an approved course</option>{(s.electiveKind==="OE"?getOEOptionsForSlot(profile,selectedSemester,s.credits):s.electiveKind==="HS"?hsOptionsForSemester(selectedSemester):(s.electiveKind==="PE6A"||s.electiveKind==="PE6B")?PE6_PAIR_OPTIONS.filter(option=>option.code!==(s.electiveKind==="PE6A"?subjects.find(item=>item.electiveKind==="PE6B")?.courseCode:subjects.find(item=>item.electiveKind==="PE6A")?.courseCode)).map(({code,name})=>({code,name,credits:3})):s.electiveKind==="PE6C"?PE6_THIRD_OPTIONS:s.electiveKind==="PE5"?PE5_OPTIONS:PE4_OPTIONS).map(option=><option key={option.code} value={option.code}>{getOECodeLabel(profile,option.code)} · {option.name}</option>)}</select>}</>:<input aria-label={"Subject "+(index+1)} title={s.courseCode||s.name} placeholder={"Subject "+(index+1)} value={s.name} readOnly={!isGuest&&!s.isCustom} onChange={e=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,name:e.target.value}:x));setSgpa(null);}}/>}</div>{!isGuest&&<><span className="sp-course-code-cell">{s.isCustom&&!(isNepBtechProfile(profile)&&s.courseType==="Open Elective (OE)")?<input aria-label="Course code" placeholder="Course code" value={s.courseCode||""} onChange={e=>setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,courseCode:e.target.value}:x))}/>:s.courseCode?getOECodeLabel(profile,s.courseCode):"—"}</span><span className="sp-course-type-cell">{s.courseType||"—"}</span></>}<input aria-label="Credits" type="number" min="0" max={isGuest?Math.max(0,20-(countedCredits-s.credits)):s.isCustom?28:undefined} step="0.5" value={s.credits} readOnly={!isGuest&&!s.isCustom} onChange={e=>{const value=Math.max(0,Number(e.target.value)||0);setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,credits:isGuest?Math.min(value,Math.max(0,20-cur.filter(y=>y.id!==s.id).reduce((sum,y)=>sum+y.credits,0))):value}:x));setSgpa(null);}}/><div className="sp-grade-options" role="radiogroup" aria-label={"Choose grade for "+(s.name||"subject "+(index+1))}>{gradeNames.map(g=><button type="button" key={g} role="radio" aria-checked={s.grade===g} className={s.grade===g?"selected":""} onClick={()=>{setSubjects(cur=>cur.map(x=>x.id===s.id?{...x,grade:g}:x));setSgpa(null);}}><strong>{g}</strong><small>{POINTS[g]} pts</small></button>)}</div>{(!isGuest&&(s.electiveKind==="OE"||s.electiveKind==="HS"))&&<button type="button" className="sp-remove" aria-label={"Remove "+(s.name||"elective course")} title="Remove this curriculum OE/HS elective from the current semester" onClick={()=>removeElective(s.id)}>×</button>}{(!isGuest&&s.isCustom&&(s.courseType==="Open Elective (OE)"||s.courseType==="Humanities & Social Sciences (HS)"||s.courseType==="Professional Elective (PE)"))&&<button type="button" className="sp-remove" aria-label={"Remove "+(s.name||"elective course")} title="Remove this added elective course" onClick={()=>removeSubject(s.id)}>×</button>}</div>)}</div>{subjectSearch.trim()&&visibleSubjects.length===0&&<p className="sp-subject-search-empty">No subjects match “{subjectSearch}”. Try another name or course code.</p>}{!isGuest&&<div className="sp-actions sp-course-management"><button type="button" className="sp-add" onClick={addSubject} >＋ Add course</button><p className="sp-muted sp-elective-credit-meter">Semester credits (limit-counted): <strong>{creditsForSemesterLimit.toFixed(1)} / 28</strong> · Total including UHV: {countedCredits.toFixed(1)} · Programme limit: {isDirectSecondYear?121:160} credits</p></div>}{!isGuest&&droppedElectives.length>0&&<div className="sp-dropped-electives"><span>Removed from this semester</span>{droppedElectives.map(subject=><button type="button" key={subject.id} onClick={()=>restoreElective(subject.id)}>＋ Restore {subject.electiveKind==="OE"?"OE":"HS"} · {subject.electiveSlotCode}</button>)}</div>}{isGuest&&<button className="sp-add" onClick={addSubject} disabled={countedCredits>=20}>＋ Add subject</button>}{isGuest&&<div className="sp-muted">Credits used: {countedCredits.toFixed(1)} / 20 maximum</div>}<div className="sp-actions">{!isCurrentSemesterInProgress&&!isGuest&&<button className="sp-secondary" onClick={saveSemester} disabled={sgpa===null||savingSemester}>{savingSemester?"Saving…":"Save to tracker"}</button>}</div></Card><Card className="sp-result"><span>YOUR SGPA</span><div className="sp-score">{isCurrentSemesterInProgress||sgpa===null?"—":sgpa.toFixed(3)}<small>/ 10</small></div><h3>{isCurrentSemesterInProgress?"Your semester is still underway":sgpa===null?"Complete your grade selection":"Live SGPA"}</h3><p>{isCurrentSemesterInProgress?"Use What-if Analysis for estimates. Official SGPA becomes available after the semester is completed.":sgpa===null?"Choose a valid grade for every subject. Your SGPA will update automatically as you make changes.":"Your weighted semester grade point average, recalculated whenever a grade or credit changes."}</p><div className="sp-result-line"><span>Counted credits</span><b>{countedCredits}</b></div><div className="sp-result-line"><span>Weighted points</span><b>{weighted.toFixed(2)}</b></div></Card></div></>}
        {section==="sgpaWhatIf"&&<><SectionTitle kicker="SGPA ANALYSIS" title="SGPA what-if analysis" copy="Build temporary semester models, change grades and compare different test cases. Nothing here changes your saved academic record."/><div className="sp-whatif-hero"><div className="sp-whatif-hero-copy"><span className="sp-whatif-eyebrow">YOUR ACADEMIC SIMULATOR</span><h2>What could your SGPA look like?</h2><p>Experiment with grades, build your own semester and discover how every mark changes your result.</p><div className="sp-whatif-hero-tags"><span>NO RECORD CHANGES</span><span>LIVE CALCULATIONS</span><span>UNLIMITED TEST CASES</span></div></div><div className="sp-whatif-score-orb"><span>LIVE SGPA</span><strong>{whatIfCountedCredits?whatIfLiveSgpa.toFixed(2):"—"}</strong><small>out of 10</small></div></div><Card className="sp-whatif-semester-card"><div className="sp-whatif-semester-picker"><div><span className="sp-whatif-eyebrow">01 / SELECT YOUR CHALLENGE</span><h2>Which semester are we simulating?</h2><p>Choose any semester to load its curriculum and build a fresh scenario.</p></div><label className="sp-whatif-semester-control"><span>SEMESTER</span><select aria-label="Choose semester for What-If Analysis" value={whatIfSemester} onChange={event=>setWhatIfSemester(Number(event.target.value))}>{Array.from({length:Math.max(1,(profile.programName.toLowerCase().includes("mca")||/m\.?tech/i.test(profile.programName)?4:8)-(isDseAdmission(profile.admissionMode,profile.enrollment)?2:0))},(_,index)=>index+(isDseAdmission(profile.admissionMode,profile.enrollment)?3:1)).map(semester=><option key={semester} value={semester}>Semester {semester}</option>)}</select></label></div><div className="sp-whatif-semester-footer"><label>Target SGPA<input type="number" min="0" max="10" step=".01" value={whatIf} onChange={event=>setWhatIf(event.target.value)}/></label><span>{whatIfSubjects.length} subjects currently in this model</span><span className="sp-whatif-loading-label">{whatIfLoading?"Loading curriculum…":"Ready to simulate"}</span></div></Card><div className="sp-whatif-workspace"><Card className="sp-whatif-editor-card"><div className="sp-card-head"><div><span>02 / BUILD YOUR SEMESTER</span><h2>Pick subjects. Set your grades.</h2><p className="sp-muted">Tap a grade button to instantly update your projected SGPA.</p></div><button type="button" className="sp-add" onClick={addWhatIfSubject} disabled={whatIfLoading||whatIfCreditTotal+3>28}>＋ Add subject</button></div>{whatIfLoading?<p className="sp-muted">Loading Semester {whatIfSemester} curriculum…</p>:whatIfSubjects.length===0?<p className="sp-muted">No curriculum subjects found. You can still add hypothetical subjects.</p>:null}{whatIfSubjects.map((subject,index)=><div className="sp-whatif-subject" key={subject.id}><div className="sp-whatif-subject-top"><div className="sp-whatif-subject-identity"><span className="sp-whatif-index">{String(index+1).padStart(2,"0")}</span><div><input aria-label={"Subject name "+(index+1)} value={subject.name} onChange={event=>updateWhatIfSubject(subject.id,{name:event.target.value})}/><input aria-label={"Course code "+(index+1)} value={subject.courseCode||""} onChange={event=>updateWhatIfSubject(subject.id,{courseCode:event.target.value})} placeholder="Course code"/></div></div><div className="sp-whatif-subject-actions"><label>Credits<input aria-label={"Credits for "+subject.name} type="number" min="0" max="28" step=".5" value={subject.credits} onChange={event=>updateWhatIfSubject(subject.id,{credits:Number(event.target.value)})}/></label><button type="button" className="sp-whatif-remove" onClick={()=>removeWhatIfSubject(subject.id)} aria-label={"Remove "+subject.name}>Remove</button></div></div><div className="sp-whatif-grade-area"><div className="sp-whatif-grade-heading"><span>CHOOSE YOUR GRADE</span><strong>{subject.grade} <small>· {POINTS[subject.grade]??0} points</small></strong></div><div className="sp-grade-options sp-whatif-grade-options" role="radiogroup" aria-label={"Choose grade for "+(subject.name||"subject "+(index+1))}>{gradeNames.map(grade=><button type="button" key={grade} role="radio" aria-checked={subject.grade===grade} className={subject.grade===grade?"selected":""} onClick={()=>updateWhatIfSubject(subject.id,{grade})}><strong>{grade}</strong><small>{POINTS[grade]} pts</small></button>)}</div></div></div>)}{whatIfNotice&&<p className="sp-muted" role="status">{whatIfNotice}</p>}</Card><aside className="sp-whatif-sidebar"><Card className="sp-whatif-estimate-card"><div className="sp-whatif-estimate-top"><span>LIVE ESTIMATED SGPA</span><span className="sp-whatif-live-dot">LIVE</span></div><div className="sp-whatif-estimate-number">{whatIfCountedCredits?whatIfLiveSgpa.toFixed(3):"—"}<small>/ 10</small></div><p>Projected result for Semester {whatIfSemester}</p><div className="sp-whatif-estimate-divider"/><div className="sp-whatif-stat-row"><span>Subjects</span><strong>{whatIfSubjects.length}</strong></div><div className="sp-whatif-stat-row"><span>Counted credits</span><strong>{whatIfCountedCredits}</strong></div><div className="sp-whatif-stat-row"><span>Weighted points</span><strong>{whatIfSubjects.reduce((sum,subject)=>sum+Math.max(0,subject.credits)*(POINTS[subject.grade]??0),0).toFixed(2)}</strong></div><div className="sp-whatif-credit-meter"><div><span>SEMESTER CREDIT CAPACITY</span><strong>{whatIfCreditTotal} <small>/ 28</small></strong></div><div className="sp-whatif-credit-track"><span style={{width:Math.min(100,(whatIfCreditTotal/28)*100)+"%"}}/></div><small>{Math.max(0,28-whatIfCreditTotal)} credits remaining</small></div><p className="sp-whatif-credit-note">28-credit threshold is always enforced. UHV remains exempt under the existing rule.</p></Card><Card className="sp-whatif-target-card"><span className="sp-whatif-eyebrow">YOUR TARGET</span><h3>{Number(whatIf)>0?Number(whatIf).toFixed(2):"—"} SGPA</h3><p>{whatIfCountedCredits&&whatIfLiveSgpa>=Number(whatIf)?"Target reached. Nice work!":"Adjust your grades to reach your target."}</p><div className="sp-whatif-target-track"><span style={{width:Math.min(100,whatIfCountedCredits?whatIfLiveSgpa/Math.max(1,Number(whatIf))*100:0)+"%"}}/></div></Card></aside></div><Card><div className="sp-card-head"><div><span>03 / CHALLENGE YOURSELF</span><h2>Save and compare test cases</h2><p className="sp-muted">Try a few different grade combinations and compare the outcomes.</p></div></div><div className="sp-inline-form"><label>Test case name<input value={whatIfScenarioName} onChange={event=>setWhatIfScenarioName(event.target.value)} placeholder="e.g. Strong theory grades"/></label><div className="sp-inline-result"><span>Projected SGPA</span><strong>{whatIfCountedCredits?whatIfLiveSgpa.toFixed(3):"—"}</strong></div><button type="button" onClick={saveWhatIfScenario} disabled={!whatIfSubjects.length||whatIfCreditTotal>28}>Save test case</button></div>{whatIfScenariosSaved.map(scenario=><div className="sp-history-row" key={scenario.id}><div><strong>{scenario.name}</strong><p className="sp-muted">Semester {scenario.semester} · {scenario.subjects.length} subjects · {scenario.credits} credits</p></div><strong>{scenario.sgpa.toFixed(3)} SGPA</strong><button type="button" className="sp-secondary" onClick={()=>{setWhatIfSemester(scenario.semester);setWhatIfSubjects(scenario.subjects.map(subject=>({...subject})));}}>Load case</button><button type="button" className="sp-secondary" onClick={()=>setWhatIfScenariosSaved(current=>current.filter(item=>item.id!==scenario.id))}>Remove</button></div>)}</Card><div className="sp-feature-grid sp-plan-scenarios">{whatIfScenarios.map((plan,i)=><Card key={plan.label}><div className="sp-card-head"><div><span>GRADE ESTIMATE {String(i+1).padStart(2,"0")}</span><h2>{plan.label}</h2></div></div><div className="sp-score">{plan.projected.toFixed(3)}<small> projected SGPA</small></div><p className="sp-muted">{plan.description}</p>{whatIfSubjects.filter(subject=>subject.credits>0).map((subject,index)=><div className="sp-history-row" key={subject.id}><span>{subject.name.trim()||"Subject "+(index+1)} · {subject.credits} credits</span><strong>{plan.grades[subject.id]||"D"} · {POINTS[plan.grades[subject.id]||"D"]}</strong></div>)}</Card>)}</div><p className="sp-muted">All calculations are estimates only. Test cases are kept in this session and do not represent awarded grades or saved academic records.</p></>}

{section==="sgpaPlanner"&&<><SectionTitle kicker="CURRENT & FUTURE SEMESTER GOAL SIMULATOR" title="SGPA planner" copy="Build three independent report cards for the same exact SGPA target. Customise subjects and grades separately in each one."/><div className="sp-sgpa-planner-hero"><div><span>{plannerSemester===currentSemester?"YOUR CURRENT SEMESTER":"YOUR FUTURE ACADEMIC MILESTONE"}</span><h2>Three independent ways to your target.</h2><p>Each report card has its own subjects, elective choices and grades. All three use the same target SGPA.</p></div><div className="sp-sgpa-planner-hero-mark"><strong>{plannerSemester}</strong><small>SEMESTER</small></div></div><Card className="sp-sgpa-planner-setup"><div className="sp-card-head"><div><span>01 / SET YOUR DESTINATION</span><h2>Choose your semester and target</h2></div></div><div className="sp-sgpa-planner-controls"><label className="sp-sgpa-planner-semester"><span>PLAN FOR SEMESTER</span><select value={plannerSemester} onChange={event=>setPlannerSemester(Number(event.target.value))}>{Array.from({length:Math.max(0,totalProgrammeSemesters-currentSemester+1)},(_,index)=>index+currentSemester).map(semester=><option key={semester} value={semester}>Semester {semester}{semester===currentSemester?" · Current semester":semester===currentSemester+1?" · Next semester":""}</option>)}</select></label><label className="sp-sgpa-planner-target"><span>DESIRED SGPA · SHARED BY ALL THREE</span><div><input type="number" min="0" max="10" step=".01" value={targetSgpa} onChange={event=>{const value=event.target.value;setTargetSgpa(value);const target=Number(value);if(value.trim()&&Number.isFinite(target)&&target>=0&&target<=10){setPlannerReportCards(cards=>cards.map(card=>{const plan=buildSgpaScenarios(target,card.subjects)[(card.id-1)%3];return {...card,subjects:card.subjects.map(subject=>({...subject,grade:plan.grades[subject.id]||"D"}))};}));}}}/><small>/ 10</small></div></label><div className="sp-sgpa-planner-fact"><span>YOUR CURRENT SEMESTER</span><strong>{currentSemester}</strong></div><div className="sp-sgpa-planner-fact"><span>SEMESTERS AFTER THIS</span><strong>{Math.max(0,(profile.programName.toLowerCase().includes("mca")||/m\.?tech/i.test(profile.programName)?4:8)-plannerSemester)}</strong></div></div><p className="sp-muted">Changing the semester loads its curriculum into three separate copies. Editing one report card never changes the other two or your saved academic record.</p></Card>{plannerNotice&&<p className="sp-muted" role="status">{plannerNotice}</p>}<div className="sp-sgpa-planner-results-heading"><div><span>02 / THREE INDEPENDENT REPORT CARDS</span><h2>Same target. Separate combinations.</h2><p>Choose subjects and grades independently in each card. Each score is recalculated live.</p></div><span className="sp-sgpa-planner-live">LIVE GOAL SIMULATOR</span></div>{plannerLoading?<Card><p className="sp-muted">Loading Semester {plannerSemester} curriculum…</p></Card>:plannerReportCards.length?<div className="sp-feature-grid sp-plan-scenarios sp-sgpa-planner-cards">{plannerReportCards.map((card,index)=>{const valid=card.subjects.filter(subject=>subject.credits>0&&POINTS[subject.grade]!==undefined);const credits=valid.reduce((sum,subject)=>sum+subject.credits,0);const weighted=valid.reduce((sum,subject)=>sum+POINTS[subject.grade]*subject.credits,0);const score=credits?weighted/credits:0;const target=Number(targetSgpa);const exact=credits>0&&Number.isFinite(target)&&Math.abs(score-target)<0.0005;return <Card key={card.id} className="sp-sgpa-planner-report"><div className="sp-sgpa-planner-report-top"><span>REPORT CARD 0{index+1}</span><span>{index===0?"BALANCED START":index===1?"CREDIT PRIORITY START":"ALTERNATIVE START"}</span></div><h3>{card.label}</h3><div className="sp-sgpa-planner-report-score">{score.toFixed(3)}<small>/ 10 SGPA</small></div><div className="sp-sgpa-planner-target-status">{exact?"EXACT TARGET MATCH":credits?("TARGET DIFFERENCE · "+(score-target>0?"+":"")+(score-target).toFixed(3)):"ADD SUBJECTS TO CALCULATE"}</div><p className="sp-muted">Shared target: {Number.isFinite(target)?target.toFixed(2):"—"} · {card.description}</p><button type="button" className="sp-secondary" onClick={()=>regeneratePlannerCardGrades(card.id)}>↻ Rebuild grades for shared target</button><div className="sp-sgpa-planner-elective-tools"><label>ADD TYPE<select value={plannerCardAddTypes[card.id]||"OE"} onChange={event=>setPlannerCardAddTypes(current=>({...current,[card.id]:event.target.value as "OE"|"HS"}))}><option value="OE">Open Elective (OE)</option><option value="HS">Humanities &amp; Social Sciences (HS)</option></select></label><label>AVAILABLE SUBJECTS<select id={"planner-course-"+card.id} defaultValue=""><option value="">Choose a subject</option>{(plannerCardAddTypes[card.id]==="HS"?hsOptionsForSemester(plannerSemester):getOEOptionsForStudent(profile,plannerSemester).filter(option=>!Object.entries(savedSubjectsBySemester).some(([semester,rows])=>Number(semester)!==plannerSemester&&rows.some(subject=>subject.courseCode===option.code)))).filter(option=>!card.subjects.some(subject=>subject.courseCode===option.code)).map(option=><option key={option.code} value={option.code}>{getOECodeLabel(profile,option.code)} · {option.name} ({option.credits||"slot"} cr)</option>)}</select></label><button type="button" className="sp-add" onClick={()=>{const select=document.getElementById("planner-course-"+card.id) as HTMLSelectElement|null;addPlannerCardElective(card.id,plannerCardAddTypes[card.id]||"OE",select?.value||"");if(select)select.value="";}}>＋ Add</button></div><div className="sp-sgpa-planner-report-rows">{card.subjects.map((subject,subjectIndex)=>{const type=String(subject.courseType||"").toUpperCase();const code=String(subject.courseCode||"").toUpperCase();const removable=subject.electiveKind==="OE"||subject.electiveKind==="HS"||isOECodeForStudent(profile,code)||HS_OPTIONS.some(option=>option.code===code)||/OPEN ELECTIVE|HUMANITIES|SOCIAL SCIENCES/.test(type)||/(^|[^A-Z])(OE|HS)([^A-Z]|$)/.test(type)||/(OE|HS)\d{3,}/.test(code);return <div className="sp-history-row" key={subject.id}><span><b>{subject.courseCode?getOECodeLabel(profile,subject.courseCode):String(subjectIndex+1).padStart(2,"0")}</b> {subject.name}<small> · {subject.credits} cr</small></span><select aria-label={"Grade for "+subject.name+" in report card "+(index+1)} value={subject.grade} onChange={event=>updatePlannerCardSubject(card.id,subject.id,{grade:event.target.value})}>{gradeNames.map(grade=><option key={grade} value={grade}>{grade} · {POINTS[grade]} pts</option>)}</select>{removable&&<button type="button" className="sp-remove" aria-label={"Remove "+subject.name+" from report card "+(index+1)} onClick={()=>removePlannerCardSubject(card.id,subject.id)}>×</button>}</div>})}</div><div className="sp-sgpa-planner-report-foot"><span>Semester {plannerSemester} · {card.subjects.length} subjects</span><strong>{credits} credits</strong></div><p className="sp-muted">Only this report card is affected when you change its subjects or grades.</p></Card>})}</div>:<Card><p className="sp-muted">No curriculum subjects were returned for this semester.</p></Card>}<p className="sp-muted">An exact match is shown only when the calculated weighted SGPA equals the target to three decimal places. If the selected grade scale and credits cannot produce the target, adjust grades or elective subjects; Gradly will show the real score and difference rather than claiming an approximate score is exact.</p></>}{section==="cgpa"&&<>{isGuest?<><section className="sp-calculator-hero sp-cgpa-calculator-hero"><div className="sp-calculator-hero-copy"><span className="sp-calc-eyebrow">GRADLY · ACADEMIC TOOLS</span><h1>CGPA calculator</h1><p>Bring every completed semester together and see your cumulative performance.</p></div><div className="sp-calc-glow"/></section><div className="sp-cgpa-workspace-grid"><Card><div className="sp-card-head"><div><span>SEMESTER INPUT</span><h2>Enter semester results</h2></div><b>{guestCgpaRows.length} rows</b></div><div className="sp-subject-head sp-cgpa-input-head"><span>SEMESTER</span><span>SGPA</span><span>CREDITS</span><span/></div>{guestCgpaRows.map((row,index)=><div className="sp-subject-row sp-cgpa-input-row" key={row.id}><select aria-label={"Semester "+(index+1)} value={row.semester} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,semester:e.target.value}:x));setGuestCgpaResult(null);}}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>Sem {i+1}</option>)}</select><input aria-label="Semester SGPA" type="number" min="0" max="10" step=".01" placeholder="e.g. 8.25" value={row.sgpa} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,sgpa:e.target.value}:x));setGuestCgpaResult(null);}}/><input aria-label="Semester credits" type="number" min="1" max="20" step=".5" placeholder="Credits" value={row.credits} onChange={e=>{setGuestCgpaRows(rows=>rows.map(x=>x.id===row.id?{...x,credits:e.target.value}:x));setGuestCgpaResult(null);}}/><button className="sp-remove" aria-label="Remove semester" disabled={guestCgpaRows.length===1} onClick={()=>{setGuestCgpaRows(rows=>rows.filter(x=>x.id!==row.id));setGuestCgpaResult(null);}}>×</button></div>)}<div className="sp-actions"><button className="sp-add" onClick={()=>setGuestCgpaRows(rows=>[...rows,{id:Math.max(0,...rows.map(x=>x.id))+1,semester:String(Math.min(12,rows.length+1)),sgpa:"",credits:""}])} disabled={guestCgpaRows.length>=12}>＋ Add semester</button><button className="sp-primary" onClick={()=>{const valid=guestCgpaRows.filter(x=>x.sgpa!==""&&x.credits!==""&&Number(x.sgpa)>=0&&Number(x.sgpa)<=10&&Number(x.credits)>0&&Number(x.credits)<=20);if(!valid.length||valid.length!==guestCgpaRows.length){setNotice("Enter a valid SGPA from 0 to 10 and credits from 1 to 20 for every semester.");setGuestCgpaResult(null);return;}const credits=valid.reduce((sum,x)=>sum+Number(x.credits),0);setGuestCgpaResult(valid.reduce((sum,x)=>sum+Number(x.sgpa)*Number(x.credits),0)/credits);}}>Calculate CGPA →</button><button className="sp-secondary" onClick={()=>{setGuestCgpaRows([{id:1,semester:"1",sgpa:"",credits:""}]);setGuestCgpaResult(null);}}>Reset</button></div></Card><Card className="sp-result sp-cgpa-result-panel"><span>YOUR CGPA</span><div className="sp-score">{guestCgpaResult===null?"—":guestCgpaResult.toFixed(2)}<small>/ 10</small></div><h3>{guestCgpaResult===null?"Your result appears here":"Calculation complete"}</h3><p>Credit-weighted cumulative grade point average from the semester entries above.</p><div className="sp-result-line"><span>Semesters entered</span><b>{guestCgpaRows.length}</b></div><div className="sp-result-line"><span>Total credits</span><b>{guestCgpaRows.reduce((sum,x)=>sum+(Number(x.credits)||0),0)}</b></div></Card></div></>:<><div className="sp-metrics"><article><span>CURRENT CGPA</span><strong>{results.length?cgpaValue.toFixed(2):"—"}</strong><small>Credit-weighted from saved records</small></article><article><span>SEMESTERS SAVED</span><strong>{results.length}</strong><small>Academic history</small></article><article><span>TOTAL CREDITS</span><strong>{cgpaCredits}</strong><small>Across saved semesters</small></article><article><span>WEIGHTED POINTS</span><strong>{results.reduce((s,r)=>s+r.sgpa*r.credits,0).toFixed(1)}</strong><small>SGPA × semester credits</small></article></div><Card><div className="sp-card-head"><div><span>SEMESTER HISTORY</span><h2>Saved academic results</h2></div></div>{results.length?results.map(r=><div className="sp-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(3)} SGPA</strong><button onClick={()=>{const next=results.filter(x=>x.id!==r.id);setResults(next);localStorage.setItem("gradly_semester_results",JSON.stringify(next));}}>Remove</button></div>):<div className="sp-empty"><span>◈</span><h3>Your academic history starts here</h3><p>Calculate and save a semester SGPA to build your CGPA profile.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Calculate SGPA →</button></div>}</Card></>}</>}

{section==="cgpaWhatIf"&&<><SectionTitle kicker="CGPA ANALYSIS" title="CGPA what-if analysis" copy="Change the SGPA of each saved semester independently and see how every combination changes your cumulative result."/>
          {cgpaWhatIfRows.length?<>
            <Card className="sp-cgpa-whatif-summary"><div className="sp-cgpa-whatif-summary-top"><div><span>SIMULATED CGPA</span><strong>{cgpaWhatIfValue===null?"—":cgpaWhatIfValue.toFixed(3)}</strong><small>{cgpaWhatIfDelta>0.0005?"Higher than your saved CGPA":cgpaWhatIfDelta< -0.0005?"Lower than your saved CGPA":"Same as your saved CGPA"}</small></div><div className={cgpaWhatIfDelta>0.0005?"positive":cgpaWhatIfDelta< -0.0005?"negative":""}><span>CHANGE</span><strong>{cgpaWhatIfValue===null?"—":`${cgpaWhatIfDelta>0?"+":""}${cgpaWhatIfDelta.toFixed(3)}`}</strong><small>Saved CGPA: {cgpaValue.toFixed(3)}</small></div><div><span>FIXED CREDIT BASE</span><strong>{cgpaWhatIfCredits}</strong><small>{cgpaWhatIfRows.length} semesters · credits unchanged</small></div></div><div className="sp-cgpa-whatif-meter"><i style={{width:(cgpaWhatIfValue===null?0:Math.max(0,Math.min(100,cgpaWhatIfValue*10)))+"%"}}/></div><div className="sp-cgpa-whatif-scale"><span>0.00</span><span>10.00</span></div></Card>
            <Card><div className="sp-card-head"><div><span>SEMESTER SCENARIO BUILDER</span><h2>Adjust your semester SGPAs</h2><p className="sp-muted">Every semester is an independent input. Credits are locked to the saved semester record, preserving its credit threshold and weighting.</p></div><button type="button" className="sp-secondary" onClick={()=>setCgpaWhatIfSgpas(Object.fromEntries(results.map(row=>[row.semester,String(row.sgpa)])))}>Reset all</button></div>
              <div className="sp-cgpa-whatif-list">{cgpaWhatIfRows.map(row=><div className="sp-cgpa-whatif-row" key={row.id}><div className="sp-cgpa-whatif-sem"><span>SEMESTER</span><strong>{String(row.semester).padStart(2,"0")}</strong></div><label className="sp-cgpa-whatif-input">Hypothetical SGPA<input aria-label={`Hypothetical SGPA for semester ${row.semester}`} type="number" min="0" max="10" step=".01" value={row.sgpaInput} onChange={event=>setCgpaWhatIfSgpas(current=>({...current,[row.semester]:event.target.value}))}/>{!row.valid&&<small>Enter a value from 0.00 to 10.00</small>}</label><div className="sp-cgpa-whatif-credit"><span>FIXED CREDITS</span><strong>{row.credits}</strong></div><div className="sp-cgpa-whatif-weight"><span>WEIGHTED POINTS</span><strong>{row.valid?(row.simulatedSgpa*row.credits).toFixed(2):"—"}</strong></div><div className="sp-cgpa-whatif-change"><span>CHANGE</span><strong className={row.valid&&row.simulatedSgpa>row.sgpa+0.0005?"positive":row.valid&&row.simulatedSgpa<row.sgpa-0.0005?"negative":""}>{row.valid?`${row.simulatedSgpa-row.sgpa>0?"+":""}${(row.simulatedSgpa-row.sgpa).toFixed(2)}`:"—"}</strong></div></div>)}</div>
              <div className="sp-cgpa-whatif-foot"><span><b>Credit threshold protected</b> · semester credits cannot be changed in this simulation.</span><span>Changes are temporary and won't overwrite saved academic records.</span></div>
            </Card>
            <Card><div className="sp-card-head"><div><span>CUMULATIVE IMPACT</span><h2>How your CGPA builds</h2></div></div><div className="sp-cgpa-whatif-progression">{cgpaWhatIfRows.map((row,index)=>{const upto=cgpaWhatIfRows.slice(0,index+1);const credits=upto.reduce((sum,item)=>sum+item.credits,0);const points=upto.reduce((sum,item)=>sum+(item.valid?item.simulatedSgpa:0)*item.credits,0);const cumulative=cgpaWhatIfValid&&credits?points/credits:null;return <div className="sp-cgpa-whatif-progress" key={row.id}><span>SEM {row.semester}</span><strong>{cumulative===null?"—":cumulative.toFixed(2)}</strong><i><b style={{width:(cumulative===null?0:cumulative*10)+"%"}}/></i></div>})}</div><p className="sp-muted">The cumulative line is recalculated from the first available semester through each row using the fixed credit weights.</p></Card>
          </>:<Card><div className="sp-empty"><span>◈</span><h3>Save a semester result to start experimenting</h3><p>Once your semester SGPA and credits are saved, you can adjust each semester independently here. Your official records will remain unchanged.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Open SGPA calculator →</button></div></Card>}
        </>}

{section==="cgpaTracker"&&<><SectionTitle kicker="CUMULATIVE PERFORMANCE INTELLIGENCE" title="CGPA progress tracker" copy="Follow your credit-weighted CGPA journey, understand every semester's influence and spot long-term patterns."/>
{cgpaCumulativeRows.length?<>
<div className="sp-tracker-overview sp-cgpa-tracker-overview"><div className="sp-tracker-score"><span>CURRENT CGPA</span><strong>{cgpaValue.toFixed(3)}</strong><small>{cgpaValue>=8.5?"Excellent cumulative standing":cgpaValue>=7?"Strong academic foundation":cgpaValue>=5?"Room to accelerate":"A focused recovery plan can help"}</small><div className="sp-tracker-score-meter"><i style={{width:(cgpaValue*10)+"%"}}/></div></div><div className="sp-tracker-stat"><span>HIGHEST CGPA</span><strong>{cgpaTrackerPeak?.cgpa.toFixed(2)}</strong><small>After semester {cgpaTrackerPeak?.semester}</small><b>Cumulative peak</b></div><div className="sp-tracker-stat"><span>LOWEST CGPA</span><strong>{cgpaTrackerLow?.cgpa.toFixed(2)}</strong><small>After semester {cgpaTrackerLow?.semester}</small><b>Earlier milestone</b></div><div className="sp-tracker-stat"><span>LATEST MOVEMENT</span><strong className={cgpaTrackerDelta>0.0005?"is-positive":cgpaTrackerDelta< -0.0005?"is-negative":""}>{cgpaCumulativeRows.length>1?(cgpaTrackerDelta>0?"+":"")+cgpaTrackerDelta.toFixed(3):"—"}</strong><small>Change after latest semester</small><b>{cgpaTrackerDelta>0.0005?"Cumulative score rising":cgpaTrackerDelta< -0.0005?"Recent result pulled it down":"Holding steady"}</b></div></div>
<div className="sp-tracker-analysis-grid sp-cgpa-tracker-insights"><Card><span className="sp-tracker-section-label">CUMULATIVE STABILITY</span><h2>How steady is your CGPA?</h2><div className="sp-tracker-extreme"><span>CGPA VARIATION</span><strong>{cgpaTrackerConsistency.toFixed(3)}</strong><b>{cgpaTrackerConsistency<0.15?"Very steady":cgpaTrackerConsistency<0.4?"Fairly consistent":"Noticeable movement"}</b><p>Standard deviation of the cumulative CGPA milestones. A smaller value means the cumulative score has moved less between milestones.</p></div><div className="sp-tracker-insight"><span className="sp-tracker-insight-icon">↗</span><div><b>{cgpaCumulativeRows.length} cumulative milestones</b><p>{cgpaCredits} credits contribute to your current CGPA across {trackerRows.length} recorded semesters.</p></div></div></Card><Card><span className="sp-tracker-section-label">PERFORMANCE READOUT</span><h2>What your journey says</h2><div className="sp-tracker-insight"><span className="sp-tracker-insight-icon">◎</span><div><b>{cgpaTrackerPeak?.cgpa.toFixed(2)} is your highest cumulative point</b><p>Your strongest cumulative milestone came after semester {cgpaTrackerPeak?.semester}. Later semesters can shift CGPA more gradually because the earlier credits remain in the calculation.</p></div></div><div className="sp-tracker-insight"><span className="sp-tracker-insight-icon">⌁</span><div><b>{cgpaTrackerDelta>0.0005?"The latest semester improved your CGPA":cgpaTrackerDelta< -0.0005?"The latest semester reduced your CGPA":"The latest semester maintained your CGPA"}</b><p>{cgpaTrackerDelta>0.0005?"Keep the pattern going and protect high-credit subjects.":cgpaTrackerDelta< -0.0005?"Review the latest semester's SGPA and use the CGPA planner to model recovery paths.":"A similar SGPA to your existing CGPA will help preserve the current level."}</p></div></div></Card></div>
<Card><div className="sp-tracker-chart-head"><div><span>CREDIT-WEIGHTED JOURNEY</span><h2>CGPA milestone explorer</h2><p>Choose a chart to see how your cumulative score evolves after each completed semester.</p></div><span className="sp-tracker-record-count">{cgpaCumulativeRows.length} milestones</span></div><div className="sp-tracker-chart-switch" role="group" aria-label="CGPA chart type"><button type="button" className={cgpaTrackerChartType==="line"?"active":""} onClick={()=>setCgpaTrackerChartType("line")}>↗ Trend graph</button><button type="button" className={cgpaTrackerChartType==="bar"?"active":""} onClick={()=>setCgpaTrackerChartType("bar")}>▥ Bar chart</button><button type="button" className={cgpaTrackerChartType==="histogram"?"active":""} onClick={()=>setCgpaTrackerChartType("histogram")}>▤ Histogram</button></div>
{cgpaTrackerChartType==="line"&&<div className="sp-tracker-chart-wrap sp-cgpa-tracker-chart-wrap"><svg className="sp-tracker-svg" viewBox="0 0 760 300" role="img" aria-label="Credit-weighted CGPA trend by semester"><defs><linearGradient id="cgpaTrackerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#38bdf8"/><stop offset="55%" stopColor="#818cf8"/><stop offset="100%" stopColor="#34d399"/></linearGradient><linearGradient id="cgpaTrackerAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#60a5fa" stopOpacity=".25"/><stop offset="100%" stopColor="#60a5fa" stopOpacity="0"/></linearGradient></defs>{[0,2,4,6,8,10].map(value=><g key={value}><line x1="54" x2="738" y1={254-value*22} y2={254-value*22} className="sp-tracker-gridline"/><text x="35" y={258-value*22} className="sp-tracker-axis-label">{value}</text></g>)}{cgpaCumulativeRows.length>1&&<><path className="sp-tracker-area" fill="url(#cgpaTrackerAreaGradient)" d={cgpaCumulativeRows.map((row,index)=>`${index===0?"M":"L"} ${54+index*(684/Math.max(1,cgpaCumulativeRows.length-1))} ${254-row.cgpa*22}`).join(" ")+" L "+(54+(cgpaCumulativeRows.length-1)*(684/Math.max(1,cgpaCumulativeRows.length-1)))+" 254 L 54 254 Z"}/><path className="sp-tracker-line" stroke="url(#cgpaTrackerLineGradient)" d={cgpaCumulativeRows.map((row,index)=>`${index===0?"M":"L"} ${54+index*(684/Math.max(1,cgpaCumulativeRows.length-1))} ${254-row.cgpa*22}`).join(" ")}/></>}{cgpaCumulativeRows.map((row,index)=><g key={row.semester}><circle className="sp-tracker-point" cx={cgpaCumulativeRows.length===1?396:54+index*(684/(cgpaCumulativeRows.length-1))} cy={254-row.cgpa*22} r="6"/><text className="sp-tracker-value" textAnchor="middle" x={cgpaCumulativeRows.length===1?396:54+index*(684/(cgpaCumulativeRows.length-1))} y={239-row.cgpa*22}>{row.cgpa.toFixed(2)}</text><text className="sp-tracker-axis-label" textAnchor="middle" x={cgpaCumulativeRows.length===1?396:54+index*(684/(cgpaCumulativeRows.length-1))} y="278">S{row.semester}</text></g>)}</svg><div className="sp-tracker-chart-caption"><span>CGPA milestones · weighted by completed credits</span><span className="sp-tracker-legend"><i className="legend-trend"/> CGPA trend</span></div></div>}
{cgpaTrackerChartType==="bar"&&<div className="sp-tracker-bars">{cgpaCumulativeRows.map(row=><div className="sp-tracker-bar-item" key={row.semester}><span className="sp-tracker-bar-value">{row.cgpa.toFixed(2)}</span><div className="sp-tracker-bar-rail"><i style={{height:(row.cgpa*10)+"%"}}/></div><b>Sem {row.semester}</b><small>{row.cumulativeCredits} cr</small></div>)}</div>}
{cgpaTrackerChartType==="histogram"&&<div className="sp-tracker-histogram"><div className="sp-tracker-histogram-plot">{cgpaTrackerHistogram.map(bin=><div className="sp-tracker-histogram-column" key={bin.label}><strong>{bin.count}</strong><i style={{height:(bin.count/Math.max(1,...cgpaTrackerHistogram.map(item=>item.count))*100)+"%"}}/><span>{bin.label}</span></div>)}</div><p>Distribution of cumulative CGPA milestones across score bands. Each semester contributes one cumulative milestone.</p></div>}</Card>
<Card><div className="sp-tracker-chart-head"><div><span>SEMESTER-BY-SEMESTER AUDIT</span><h2>Understand every CGPA milestone</h2><p>Each row shows the semester result and cumulative position after its credits are included.</p></div></div><div className="sp-tracker-table-wrap"><table className="sp-tracker-table"><thead><tr><th>SEMESTER</th><th>SGPA</th><th>SEMESTER CREDITS</th><th>TOTAL CREDITS</th><th>WEIGHTED POINTS</th><th>CGPA AFTER SEMESTER</th></tr></thead><tbody>{cgpaCumulativeRows.map(row=><tr key={row.semester}><td><b>Semester {row.semester}</b></td><td>{row.sgpa.toFixed(3)}</td><td>{row.credits}</td><td>{row.cumulativeCredits}</td><td>{row.weightedPoints.toFixed(2)}</td><td><strong>{row.cgpa.toFixed(3)}</strong></td></tr>)}</tbody></table></div><div className="sp-tracker-actions"><div><b>Want to see how a different SGPA path changes your CGPA?</b><p>Use independent semester scenarios to test alternatives without touching your saved results.</p></div><button type="button" className="sp-primary" onClick={()=>navigate("planner")}>Open CGPA planner →</button></div></Card>
</>:<Card><div className="sp-empty"><span>▥</span><h3>No cumulative history yet</h3><p>Save semester SGPA and credit records to build your CGPA progress tracker.</p><button type="button" className="sp-primary" onClick={()=>navigate("sgpa")}>Enter semester results →</button></div></Card>}</>}

{section==="planner"&&<><SectionTitle kicker="CUMULATIVE SCENARIO STUDIO" title="CGPA planner" copy="Build three independent semester-by-semester performance paths, edit each SGPA and compare the cumulative outcome without changing your saved academic record."/>
{cgpaPlannerRows.length?<>
<Card className="sp-cgpa-planner-goal"><div className="sp-card-head"><div><span>YOUR DESTINATION</span><h2>Set a CGPA target</h2><p className="sp-muted">All three scenarios use the same saved semester credit weights. The 28-credit semester cap is preserved; UHV remains outside that cap as in the SGPA rules. Only hypothetical SGPAs change.</p></div><label className="sp-cgpa-planner-target">TARGET CGPA<input type="number" min="0" max="10" step=".01" value={cgpaPlannerTarget} onChange={event=>setCgpaPlannerTarget(event.target.value)}/></label></div><div className="sp-cgpa-planner-target-scale"><span>0.00</span><span>10.00</span></div></Card>
<div className="sp-cgpa-planner-grid">{cgpaPlannerScenarioResults.map((scenario,index)=><Card key={scenario.id} className="sp-cgpa-planner-card"><div className="sp-cgpa-planner-card-head"><div><span>SCENARIO 0{index+1}</span><h2>{scenario.label}</h2><p>{scenario.description}</p></div><span className="sp-cgpa-planner-card-mark">{["A","B","C"][index]}</span></div><div className="sp-cgpa-planner-score"><strong>{scenario.cgpa===null?"—":scenario.cgpa.toFixed(3)}</strong><span>/ 10 CGPA</span><small>{scenario.delta===null?"Complete every SGPA input":scenario.delta>0.0005?`+${scenario.delta.toFixed(3)} vs saved CGPA`:scenario.delta< -0.0005?`${scenario.delta.toFixed(3)} vs saved CGPA`:"Same as saved CGPA"}</small></div><div className="sp-cgpa-planner-progress"><i style={{width:(scenario.cgpa===null?0:scenario.cgpa*10)+"%"}}/><b style={{left:(Number(cgpaPlannerTarget)>=0&&Number(cgpaPlannerTarget)<=10?Number(cgpaPlannerTarget)*10:0)+"%"}}/></div><div className="sp-cgpa-planner-target-result">{scenario.cgpa!==null&&cgpaPlannerTarget.trim()!==""&&Number.isFinite(Number(cgpaPlannerTarget))&&Number(cgpaPlannerTarget)>=0&&Number(cgpaPlannerTarget)<=10?(scenario.cgpa+0.0005>=Number(cgpaPlannerTarget)?"TARGET REACHED":"TARGET GAP · "+(Number(cgpaPlannerTarget)-scenario.cgpa).toFixed(3)):"Enter a valid target from 0 to 10"}</div><div className="sp-cgpa-planner-semesters">{scenario.rows.map(row=><label className="sp-cgpa-planner-semester" key={row.semester}><span><b>SEMESTER {String(row.semester).padStart(2,"0")}</b><small>{row.credits} fixed credits · saved {row.sgpa.toFixed(2)}</small></span><input aria-label={`Scenario ${index+1} SGPA for semester ${row.semester}`} type="number" min="0" max="10" step=".01" value={row.input} onChange={event=>setCgpaPlannerScenarios(current=>current.map(item=>item.id===scenario.id?{...item,sgpas:{...item.sgpas,[row.semester]:event.target.value}}:item))}/></label>)}</div><div className="sp-cgpa-planner-card-foot"><span>{scenario.credits} total credits</span><button type="button" onClick={()=>setCgpaPlannerScenarios(current=>current.map(item=>item.id===scenario.id?{...item,sgpas:Object.fromEntries(cgpaPlannerRows.map(row=>[row.semester,String(row.sgpa)]))}:item))}>↺ Reset this scenario</button></div></Card>)}</div>
<Card><div className="sp-card-head"><div><span>COMPARE YOUR POSSIBILITIES</span><h2>Three outcomes, one academic record</h2><p className="sp-muted">Compare each path. These are temporary simulations and never overwrite official results.</p></div></div><div className="sp-cgpa-planner-compare">{cgpaPlannerScenarioResults.map((scenario,index)=><div key={scenario.id}><span>0{index+1} · {scenario.label}</span><strong>{scenario.cgpa===null?"—":scenario.cgpa.toFixed(3)}</strong><i><b style={{width:(scenario.cgpa===null?0:scenario.cgpa*10)+"%"}}/></i><small>{scenario.cgpa===null?"Invalid or incomplete inputs":scenario.cgpa>=Number(cgpaPlannerTarget)?"At or above target":"Below target"}</small></div>)}</div><div className="sp-cgpa-whatif-foot"><span><b>Credit threshold protected</b> · saved semester credits are fixed and remain the CGPA weights.</span><span>SGPA must be between 0.00 and 10.00. Blank or invalid entries are not given a projected result.</span></div></Card>
</>:<Card><div className="sp-empty"><span>◇</span><h3>Save your first semester result to start planning</h3><p>Once semester SGPA and registered credits are saved, you can build three independent CGPA paths and edit every semester's hypothetical SGPA.</p><button type="button" className="sp-primary" onClick={()=>navigate("sgpa")}>Open SGPA calculator →</button></div></Card>}</>}
        {section==="tracker"&&<><SectionTitle kicker="PERFORMANCE INTELLIGENCE" title="SGPA progress tracker" copy="Explore your semester journey, spot your strongest results and understand exactly where your performance is rising or dipping."/>
          {trackerRows.length?<>
            <div className="sp-tracker-overview">
              <div className="sp-tracker-score"><span>YOUR AVERAGE SGPA</span><strong>{trackerAverage.toFixed(2)}</strong><small>{trackerPerformanceLabel}</small><div className="sp-tracker-score-meter"><i style={{width:(trackerAverage*10)+"%"}}/></div></div>
              <div className="sp-tracker-stat"><span>PERSONAL BEST</span><strong>{trackerPeak?.sgpa.toFixed(2)}</strong><small>Semester {trackerPeak?.semester}</small><b>Peak performance</b></div>
              <div className="sp-tracker-stat"><span>LOWEST RESULT</span><strong>{trackerLow?.sgpa.toFixed(2)}</strong><small>Semester {trackerLow?.semester}</small><b>Opportunity to improve</b></div>
              <div className="sp-tracker-stat"><span>LATEST MOVEMENT</span><strong className={trackerDelta>0?"is-positive":trackerDelta<0?"is-negative":""}>{trackerRows.length>1?(trackerDelta>0?"+":"")+trackerDelta.toFixed(2):"—"}</strong><small>{trackerRows.length>1?"Since previous semester":"Need another result"}</small><b>{trackerDelta>0?"Moving upward":trackerDelta<0?"Needs attention":"No change yet"}</b></div>
            </div>
            <Card><div className="sp-tracker-chart-head"><div><span>SEMESTER-BY-SEMESTER</span><h2>Visual performance explorer</h2><p>Switch views to see your SGPA trend from different angles.</p></div><span className="sp-tracker-record-count">{trackerRows.length} semesters</span></div>
              <div className="sp-tracker-chart-switch" role="group" aria-label="Chart type">
                <button type="button" className={trackerChartType==="line"?"active":""} onClick={()=>setTrackerChartType("line")}>↗ Trend graph</button>
                <button type="button" className={trackerChartType==="bar"?"active":""} onClick={()=>setTrackerChartType("bar")}>▥ Bar chart</button>
                <button type="button" className={trackerChartType==="histogram"?"active":""} onClick={()=>setTrackerChartType("histogram")}>▤ Histogram</button>
              </div>
              {trackerChartType==="line"&&<div className="sp-tracker-chart-wrap"><svg className="sp-tracker-svg" viewBox="0 0 760 300" role="img" aria-label="Line graph showing SGPA across semesters">
                <defs><linearGradient id="spTrackerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#38bdf8"/><stop offset="55%" stopColor="#818cf8"/><stop offset="100%" stopColor="#34d399"/></linearGradient><linearGradient id="spTrackerAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#60a5fa" stopOpacity=".28"/><stop offset="100%" stopColor="#60a5fa" stopOpacity="0"/></linearGradient><filter id="spTrackerLineGlow" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                {[0,2,4,6,8,10].map(value=><g key={value}><line x1="54" x2="738" y1={254-value*22} y2={254-value*22} className="sp-tracker-gridline"/><text x="36" y={258-value*22} className="sp-tracker-axis-label">{value}</text></g>)}
                {trackerRows.length>1&&<polygon points={`${trackerRows.map((row,index)=>`${trackerRows.length===1?396:70+index*(650/(trackerRows.length-1))},${254-row.sgpa*22}`).join(" ")} 720,254 70,254`} className="sp-tracker-area"/>}
                <polyline points={trackerRows.map((row,index)=>`${trackerRows.length===1?396:70+index*(650/(trackerRows.length-1))},${254-row.sgpa*22}`).join(" ")} className="sp-tracker-line"/>
                {trackerRows.map((row,index)=><g key={row.id}><circle cx={trackerRows.length===1?396:70+index*(650/(trackerRows.length-1))} cy={254-row.sgpa*22} r="7" className={row.id===trackerPeak?.id?"sp-tracker-point is-peak":row.id===trackerLow?.id?"sp-tracker-point is-low":"sp-tracker-point"}/><text x={trackerRows.length===1?396:70+index*(650/(trackerRows.length-1))} y={Math.max(18,238-row.sgpa*22)} textAnchor="middle" className="sp-tracker-value">{row.sgpa.toFixed(2)}</text><text x={trackerRows.length===1?396:70+index*(650/(trackerRows.length-1))} y="282" textAnchor="middle" className="sp-tracker-axis-label">S{row.semester}</text></g>)}
              </svg><div className="sp-tracker-chart-caption"><span className="sp-tracker-legend"><i className="legend-trend"/> SGPA trend <i className="legend-peak"/> Personal best <i className="legend-low"/> Lowest</span><span>Scale <b>0.00–10.00</b></span></div></div>}
              {trackerChartType==="bar"&&<div className="sp-tracker-bars">{trackerRows.map(row=><div className="sp-tracker-bar-item" key={row.id}><div className="sp-tracker-bar-value">{row.sgpa.toFixed(2)}</div><div className="sp-tracker-bar-rail"><i style={{height:(row.sgpa*10)+"%"}}/></div><b>Sem {row.semester}</b><small>{row.credits} credits</small></div>)}</div>}
              {trackerChartType==="histogram"&&<div className="sp-tracker-histogram"><div className="sp-tracker-histogram-plot">{trackerHistogram.map(bin=><div className="sp-tracker-histogram-column" key={bin.label}><strong>{bin.count}</strong><i style={{height:(trackerRows.length?Math.max(bin.count?12:0,bin.count/trackerRows.length*100):0)+"%"}}/><span>{bin.label}</span></div>)}</div><p>Distribution of your saved semester scores across SGPA bands. Taller columns mean more semesters fall in that range.</p></div>}
              <div className="sp-tracker-chart-foot"><span>Every chart uses saved semester results only.</span><button type="button" onClick={()=>setTrackerChartType("line")}>Reset view ↗</button></div>
            </Card>
            <div className="sp-tracker-analysis-grid">
              <Card><div className="sp-tracker-section-label">01 / YOUR PERFORMANCE STORY</div><h2>What your results are telling you</h2><div className="sp-tracker-insight"><span className="sp-tracker-insight-icon">↗</span><div><b>{trackerOverallDelta>0?"Long-term progress is positive":trackerOverallDelta<0?"Your latest score is below your starting point":"Your score is holding steady"}</b><p>{trackerRows.length>1?`From Semester ${trackerRows[0].semester} to Semester ${trackerRows[trackerRows.length-1].semester}, your SGPA ${trackerOverallDelta>0?"increased":trackerOverallDelta<0?"decreased":"remained unchanged"} by ${Math.abs(trackerOverallDelta).toFixed(2)} points.`:"Save another semester result to reveal your long-term direction."}</p></div></div>
                <div className="sp-tracker-insight"><span className="sp-tracker-insight-icon">◎</span><div><b>{trackerConsistency<=0.35?"Very steady performance":trackerConsistency<=0.8?"Moderate semester-to-semester variation":"Noticeable score variation"}</b><p>Your standard deviation is {trackerConsistency.toFixed(2)}. {trackerConsistency<=0.35?"Your results are tightly grouped around your average.":trackerConsistency<=0.8?"Your results move around your average, but the pattern is still fairly controlled.":"Your semester scores vary considerably; compare the subjects and study routines in your stronger and weaker semesters."}</p></div></div>
                <div className="sp-tracker-insight"><span className="sp-tracker-insight-icon">✦</span><div><b>Strongest turning point</b><p>{trackerBestChange&&trackerBestChange.change>0?`Your biggest improvement was +${trackerBestChange.change.toFixed(2)} between Semester ${trackerBestChange.from} and ${trackerBestChange.to}.`:"No upward jump between consecutive saved semesters yet. A new result will update this insight."}</p></div></div>
              </Card>
              <Card><div className="sp-tracker-section-label">02 / PEAKS & DIPS</div><h2>Know your high and low points</h2>
                <div className="sp-tracker-extreme sp-tracker-peak"><span>PERSONAL PEAK</span><strong>{trackerPeak?.sgpa.toFixed(2)}</strong><b>Semester {trackerPeak?.semester}</b><p>{trackerPeak&&trackerAverage>0?`You scored ${(trackerPeak.sgpa-trackerAverage).toFixed(2)} points above your overall average.`:"Your best recorded semester."}</p></div>
                <div className="sp-tracker-extreme sp-tracker-dip"><span>LOWEST POINT</span><strong>{trackerLow?.sgpa.toFixed(2)}</strong><b>Semester {trackerLow?.semester}</b><p>{trackerLow?`${(trackerAverage-trackerLow.sgpa).toFixed(2)} points below your overall average. Review what changed in this semester.`:"Your lowest recorded semester."}</p></div>
                {trackerWorstChange&&trackerWorstChange.change<0&&<div className="sp-tracker-drop-note">Largest semester dip: <b>{trackerWorstChange.change.toFixed(2)}</b> points from Sem {trackerWorstChange.from} to Sem {trackerWorstChange.to}.</div>}
              </Card>
            </div>
            <Card><div className="sp-card-head"><div><span>03 / SUBJECT-LEVEL INTELLIGENCE</span><h2>Which subjects helped or hurt your SGPA?</h2><p className="sp-tracker-subject-intro">Choose a semester to see how each subject's grade point and credit weight moved its SGPA up or down.</p></div><label className="sp-tracker-semester-select">ANALYSE SEMESTER<select value={String(trackerSubjectSemester)} onChange={event=>setTrackerSelectedSemester(Number(event.target.value))}>{trackerRows.map(row=><option key={row.semester} value={row.semester}>Semester {row.semester}</option>)}</select></label></div>
              {trackerSubjectRows.length?<>
                <div className="sp-tracker-subject-summary"><div><span>SEMESTER SGPA</span><strong>{trackerSubjectResult?.sgpa.toFixed(2)??"—"}</strong></div><div><span>SUBJECTS ANALYSED</span><strong>{trackerSubjectRows.length}</strong></div><div><span>HELPING</span><strong className="is-positive">{trackerHelpingSubjects.length}</strong></div><div><span>PULLING DOWN</span><strong className="is-negative">{trackerDamagingSubjects.length}</strong></div></div>
                <div className="sp-tracker-inference"><b>Gradly's inference</b><p>{trackerSubjectInference}</p>{trackerSubjectComputedSgpa!==null&&trackerSubjectResult&&Math.abs(trackerSubjectComputedSgpa-trackerSubjectResult.sgpa)>0.02&&<small>Note: the weighted SGPA recomputed from the listed subjects is {trackerSubjectComputedSgpa.toFixed(3)}, while the saved SGPA is {trackerSubjectResult.sgpa.toFixed(3)}. Small differences can come from rounding or record data.</small>}</div>
                <div className="sp-tracker-subject-columns">
                  <section className="sp-tracker-subject-group"><div className="sp-tracker-subject-group-head"><span className="sp-tracker-subject-mark helping">↑</span><div><b>Helping your SGPA</b><small>Above the semester SGPA benchmark</small></div><strong>{trackerHelpingSubjects.length}</strong></div>
                    {trackerHelpingSubjects.length?trackerHelpingSubjects.map(subject=><div className="sp-tracker-subject-row helping" key={subject.id}><div className="sp-tracker-subject-name"><b>{subject.name}</b><small>{subject.courseCode||subject.courseType||"Course"} · {subject.credits} credits</small></div><span className="sp-tracker-grade">{subject.grade}</span><span className="sp-tracker-subject-impact">+{subject.impact.toFixed(3)}<small>SGPA impact</small></span></div>):<p className="sp-tracker-subject-empty">No subject scored above the semester SGPA.</p>}
                  </section>
                  <section className="sp-tracker-subject-group"><div className="sp-tracker-subject-group-head"><span className="sp-tracker-subject-mark damaging">↓</span><div><b>Pulling your SGPA down</b><small>Below the semester SGPA benchmark</small></div><strong>{trackerDamagingSubjects.length}</strong></div>
                    {trackerDamagingSubjects.length?trackerDamagingSubjects.map(subject=><div className="sp-tracker-subject-row damaging" key={subject.id}><div className="sp-tracker-subject-name"><b>{subject.name}</b><small>{subject.courseCode||subject.courseType||"Course"} · {subject.credits} credits</small></div><span className="sp-tracker-grade">{subject.grade}</span><span className="sp-tracker-subject-impact">{subject.impact.toFixed(3)}<small>SGPA impact</small></span></div>):<p className="sp-tracker-subject-empty">No subject scored below the semester SGPA.</p>}
                  </section>
                </div>
                {trackerNeutralSubjects.length>0&&<div className="sp-tracker-neutral"><b>At the semester benchmark</b><span>{trackerNeutralSubjects.map(subject=>subject.name).join(" · ")}</span></div>}
                <div className="sp-tracker-subject-method">How impact is calculated: <b>(subject grade point − semester SGPA) × subject credits ÷ total semester credits.</b> Positive values lift the weighted average; negative values reduce it. This is a mathematical contribution, not proof that a subject caused a change in your performance.</div>
              </>:<div className="sp-tracker-subject-empty sp-tracker-subject-empty-large"><h3>Subject grades aren't available for this semester</h3><p>Gradly needs saved subject names, credits and grades to calculate which courses helped or pulled down your SGPA. Open the SGPA calculator and save the semester's subject grades to enable this breakdown.</p><button className="sp-secondary" onClick={()=>{setSelectedSemester(trackerSubjectSemester);setSection("sgpa");setNotice("");}}>Review semester grades →</button></div>}
            </Card>
            <Card><div className="sp-card-head"><div><span>SEMESTER-BY-SEMESTER REVIEW</span><h2>Your academic performance breakdown</h2></div><b>{trackerRows.length} records</b></div>
              <div className="sp-tracker-table-wrap"><table className="sp-tracker-table"><thead><tr><th>SEMESTER</th><th>SGPA</th><th>VS YOUR AVG.</th><th>CHANGE</th><th>CREDITS</th><th>CGPA</th><th>PERFORMANCE</th></tr></thead><tbody>{trackerRows.map((row,index)=>{const previous=trackerRows[index-1];const difference=row.sgpa-trackerAverage;const change=previous?row.sgpa-previous.sgpa:null;return <tr key={row.id}><td><b>Semester {row.semester}</b>{row===trackerPeak&&<small className="sp-tracker-tag">PERSONAL BEST</small>}{row===trackerLow&&trackerPeak?.id!==row.id&&<small className="sp-tracker-tag">NEEDS REVIEW</small>}</td><td><strong>{row.sgpa.toFixed(2)}</strong></td><td className={difference>=0?"is-positive":"is-negative"}>{difference>=0?"+":""}{difference.toFixed(2)}</td><td className={change===null?"":change>=0?"is-positive":"is-negative"}>{change===null?"First record":`${change>=0?"+":""}${change.toFixed(2)}`}</td><td>{row.credits}</td><td>{getCgpaThroughSemester(row.semester)?.toFixed(2)??"—"}</td><td><span className="sp-tracker-performance-pill">{row.sgpa>=8.5?"Excellent":row.sgpa>=7?"Strong":row.sgpa>=5?"Developing":"Needs focus"}</span></td></tr>})}</tbody></table></div>
            </Card>
            <Card><div className="sp-card-head"><div><span>YOUR NEXT MOVE</span><h2>Turn insights into action</h2></div></div><div className="sp-tracker-actions"><div><b>{trackerDelta<0?"Recover your recent dip":trackerDelta>0?"Build on your momentum":"Set your next benchmark"}</b><p>{trackerDelta<0?"Compare the subjects, attendance and preparation pattern from your latest semester with your stronger semesters.":trackerDelta>0?"Identify what worked in your latest semester and repeat those study habits in the next one.":"Use your personal average as a baseline and set a realistic improvement target."}</p></div><button className="sp-primary" onClick={()=>navigate("sgpaWhatIf")}>Open what-if analysis →</button><button className="sp-secondary" onClick={()=>navigate("sgpa")}>Update semester grades</button></div></Card>
          </>:<Card><div className="sp-empty"><span>▥</span><h3>Your academic story starts here</h3><p>Save your first semester SGPA to unlock trend graphs, score distributions, personal bests, semester dips and detailed performance insights.</p><button className="sp-primary" onClick={()=>navigate("sgpa")}>Add first result →</button></div></Card>}
          <Card><div className="sp-card-head"><div><span>PERFORMANCE LOG</span><h2>Saved semester records</h2></div></div>{trackerRows.map(r=><div className="sp-history-row sp-semester-history-row" key={r.id}><b>Semester {r.semester}</b><span>{r.credits} credits</span><strong>{r.sgpa.toFixed(2)} SGPA</strong><strong>{getCgpaThroughSemester(r.semester)?.toFixed(2)??"—"} CGPA</strong><small>{new Date(r.savedAt).toLocaleDateString()}</small>{!isGuest&&<><button type="button" className="sp-download-result" onClick={()=>{setSelectedSemester(r.semester);setSection("sgpa");setNotice("");}}>Edit grades</button><button type="button" className="sp-download-result" onClick={()=>downloadSemesterReport(r)}>Download PDF</button></>}</div>)}</Card></>}
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
