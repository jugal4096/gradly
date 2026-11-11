export type ExamResultState = "NOT_APPEARED" | "AWAITING_RESULT" | "DECLARED" | "UNKNOWN";
export type ExamSession = { semester: number; parity: "ODD" | "EVEN"; sessionLabel: string; academicYear: string; estimated: boolean; state: ExamResultState };
export type ExamProfile = { version: 1; scheme: string; programme: string; totalSemesters: number; currentSemester: number | null; admissionYear: number; admissionMode: string; entrySemester: number; confirmedAt: string; sessions: ExamSession[] };

export function semesterSession(semester: number, admissionYear: number, now = new Date()) {
  const academicYearStart = admissionYear + Math.floor((semester - 1) / 2);
  const odd = semester % 2 === 1;
  const start = odd ? academicYearStart : academicYearStart;
  const year = odd ? start : start + 1;
  const label = odd ? `November–December ${year}` : `May–June ${year}`;
  return { parity: odd ? "ODD" as const : "EVEN" as const, sessionLabel: label, academicYear: `${start}-${String(start + 1).slice(-2)}`, estimated: true };
}

export function buildExamTimeline(input: { totalSemesters: number; currentSemester: number | null; admissionYear: number; entrySemester?: number; now?: Date }): ExamSession[] {
  const total = Math.max(1, Math.min(12, Math.trunc(input.totalSemesters || 1)));
  const entry = Math.max(1, Math.min(total, Math.trunc(input.entrySemester || 1)));
  return Array.from({ length: total - entry + 1 }, (_, index) => {
    const semester = entry + index;
    const session = semesterSession(semester, input.admissionYear, input.now);
    const state: ExamResultState = input.currentSemester === null ? "UNKNOWN" : semester < input.currentSemester ? "UNKNOWN" : semester === input.currentSemester ? "UNKNOWN" : "NOT_APPEARED";
    return { semester, ...session, state };
  });
}

export function detectSchemeFamily(scheme: string, programme: string, totalSemesters: number): string {
  const value = `${scheme} ${programme}`.toLowerCase();
  if (/mca/.test(value)) return "MCA";
  if (/m\.?tech|mtech/.test(value)) return "MTECH";
  if (/cbcs/.test(value)) return "CBCS";
  if (/nep/.test(value)) return "NEP";
  return totalSemesters === 4 ? "FOUR_SEMESTER" : totalSemesters === 8 ? "EIGHT_SEMESTER" : "CUSTOM";
}
