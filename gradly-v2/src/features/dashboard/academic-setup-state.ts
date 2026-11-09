export type StudentAcademicStatus = "ENROLLED" | "GRADUATED";

/** Returns a safe controlled-select value without replacing a valid manual choice. */
export function resolveCurrentSemesterSelection(
  expectedSemester: number | null,
  totalSemesters: number,
  hasManuallySelected: boolean,
  currentSelection: string,
  entrySemester = 1,
): string {
  const firstValidSemester = Number.isInteger(entrySemester) && entrySemester >= 1 && entrySemester <= totalSemesters
    ? entrySemester
    : 1;
  if (hasManuallySelected) {
    if (currentSelection === "COMPLETED") return currentSelection;
    const current = Number(currentSelection);
    if (Number.isInteger(current) && current >= firstValidSemester && current <= totalSemesters) return currentSelection;
  }
  return Number.isInteger(expectedSemester) && expectedSemester !== null &&
    expectedSemester >= firstValidSemester && expectedSemester <= totalSemesters
    ? String(expectedSemester)
    : "";
}

export function academicStatusForSemester(selection: string): StudentAcademicStatus {
  return selection === "COMPLETED" ? "GRADUATED" : "ENROLLED";
}

export function availableSemesterOptions(totalSemesters: number, entrySemester = 1): number[] {
  if (!Number.isInteger(totalSemesters) || totalSemesters < 1) return [];
  const first = Number.isInteger(entrySemester) && entrySemester >= 1 && entrySemester <= totalSemesters ? entrySemester : 1;
  return Array.from({ length: totalSemesters - first + 1 }, (_, index) => first + index);
}
