export type NepOpenElectiveOption = {
  /** Stable internal key when GECA has not supplied an official course code. */
  code: string;
  /** Official department course code, when supplied in the source list. */
  officialCode?: string;
  name: string;
  department: "CE" | "ME" | "EE" | "ET" | "CS";
  semester: 3 | 4 | 5;
  /** Zero means use the credit value of the approved OE slot in the student's curriculum. */
  credits: number;
};

// GECA B.Tech NEP Open Elective basket, transcribed from the department lists supplied for this change.
// NEPOE_* values are internal identifiers only; they are not official GECA course codes.
export const NEP_OPEN_ELECTIVES: NepOpenElectiveOption[] = [
  { code: "NEPOE_CE_3_RURAL_TECHNOLOGY", name: "Rural Technology", department: "CE", semester: 3, credits: 3 },
  { code: "NEPOE_CE_4_DISASTER_MANAGEMENT", name: "Disaster Management", department: "CE", semester: 4, credits: 3 },
  { code: "NEPOE_CE_5_WATERSHED_MANAGEMENT", name: "Watershed Management", department: "CE", semester: 5, credits: 2 },

  { code: "NEPOE_ME_3_INDUSTRIAL_PSYCHOLOGY", name: "Industrial Psychology", department: "ME", semester: 3, credits: 3 },
  { code: "NEPOE_ME_3_ENGINEERING_ECONOMICS", name: "Engineering Economics", department: "ME", semester: 3, credits: 3 },
  { code: "NEPOE_ME_3_ETHICAL_VALUES", name: "Ethical Values", department: "ME", semester: 3, credits: 3 },
  { code: "NEPOE_ME_3_SMART_MOBILITY_ROAD_SAFETY", name: "Smart Mobility & Road Safety", department: "ME", semester: 3, credits: 3 },
  { code: "MEOEC2020", officialCode: "MEOEC2020", name: "Total Quality Management", department: "ME", semester: 4, credits: 3 },
  { code: "MEOEC2021", officialCode: "MEOEC2021", name: "Industrial Management", department: "ME", semester: 4, credits: 3 },
  { code: "MEOEC2022", officialCode: "MEOEC2022", name: "Manufacturing Management", department: "ME", semester: 4, credits: 3 },
  { code: "NEPOE_ME_4_GREEN_HYDROGEN_FINANCING", name: "Fundamentals of Financing for Green Hydrogen Projects", department: "ME", semester: 4, credits: 3 },
  { code: "NEPOE_ME_5_ENTREPRENEURSHIP_DEVELOPMENT", name: "Entrepreneurship Development", department: "ME", semester: 5, credits: 2 },
  { code: "NEPOE_ME_5_FINANCIAL_MANAGEMENT", name: "Financial Management", department: "ME", semester: 5, credits: 2 },

  { code: "EEOEC2001", officialCode: "EEOEC2001", name: "Music Engineering", department: "EE", semester: 3, credits: 3 },
  { code: "EEOEC2010", officialCode: "EEOEC2010", name: "Basic Engineering Economics", department: "EE", semester: 4, credits: 2 },
  { code: "EEOEC3001", officialCode: "EEOEC3001", name: "Smart Building Services", department: "EE", semester: 5, credits: 3 },

  { code: "ETOEC0010", officialCode: "ETOEC0010", name: "German I", department: "ET", semester: 3, credits: 0 },
  { code: "ETOEC1020", officialCode: "ETOEC1020", name: "German II", department: "ET", semester: 4, credits: 0 },
  { code: "ETOEC0030", officialCode: "ETOEC0030", name: "German III", department: "ET", semester: 5, credits: 0 },
  { code: "ETOEC0011", officialCode: "ETOEC0011", name: "Japanese I", department: "ET", semester: 3, credits: 0 },
  { code: "ETOEC1021", officialCode: "ETOEC1021", name: "Japanese II", department: "ET", semester: 4, credits: 0 },
  { code: "ETOEC0031", officialCode: "ETOEC0031", name: "Japanese III", department: "ET", semester: 5, credits: 0 },

  { code: "NEPOE_CS_3_DESIGN_THINKING", name: "Design Thinking", department: "CS", semester: 3, credits: 3 },
  { code: "NEPOE_CS_3_CRITICAL_THINKING", name: "Critical Thinking", department: "CS", semester: 3, credits: 3 },
  { code: "NEPOE_CS_4_PECL", name: "PECL", department: "CS", semester: 4, credits: 3 },
  { code: "NEPOE_CS_4_SOFTWARE_DEVELOPMENT_CYCLE", name: "Software Development Cycle", department: "CS", semester: 4, credits: 3 },
  { code: "NEPOE_CS_5_BEHAVIORAL_SCIENCE_ORGANIZATION", name: "Behavioral Science & Organization", department: "CS", semester: 5, credits: 2 },
];

export function isNepSchemeName(schemeName: string): boolean {
  return /\bnep\b/i.test(String(schemeName || "")) && !/new\s*cbcs/i.test(String(schemeName || ""));
}

export function getNepDepartmentCode(branchName: string): string | null {
  const value = String(branchName || "").trim().toLowerCase();
  if (/civil/.test(value)) return "CE";
  if (/mechanical/.test(value)) return "ME";
  if (/electrical/.test(value)) return "EE";
  if (/electronics|telecommunication|entc|e\s*&\s*tc/.test(value)) return "ET";
  if (/computer science|\bcse\b/.test(value)) return "CS";
  if (/information technology|\bit\b/.test(value)) return "IT";
  return null;
}

export function getNepOpenElectives(branchName: string, semester: number): NepOpenElectiveOption[] {
  const ownDepartment = getNepDepartmentCode(branchName);
  return NEP_OPEN_ELECTIVES.filter(option => option.semester === semester && option.department !== ownDepartment);
}

export function findNepOpenElective(code: string): NepOpenElectiveOption | undefined {
  const normalized = String(code || "").trim().toUpperCase();
  return NEP_OPEN_ELECTIVES.find(option => option.code.toUpperCase() === normalized || option.officialCode?.toUpperCase() === normalized);
}

export function getNepOpenElectiveDisplayCode(code: string): string {
  const option = findNepOpenElective(code);
  if (!option) return code;
  return option.officialCode || "Official code pending";
}