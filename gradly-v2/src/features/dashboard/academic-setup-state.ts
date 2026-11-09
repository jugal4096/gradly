export type StudentAcademicStatus = "ENROLLED" | "GRADUATED";

/** Returns a safe controlled-select value without replacing a valid manual choice. */
export function resolveCurrentSemesterSelection(
  expectedSemester: number | null,
  totalSemesters: number,
  hasManuallySelected: boolean,
  currentSelection: string,
): string {
  if (hasManuallySelected) {
    if (currentSelection === "COMPLETED") return currentSelection;
    const current = Number(currentSelection);
    if (Number.isInteger(current) && current >= 1 && current <= totalSemesters) return currentSelection;
  }
  return Number.isInteger(expectedSemester) && expectedSemester !== null &&
    expectedSemester >= 1 && expectedSemester <= totalSemesters
    ? String(expectedSemester)
    : "";
}

export function academicStatusForSemester(selection: string): StudentAcademicStatus {
  return selection === "COMPLETED" ? "GRADUATED" : "ENROLLED";
}

export function availableSemesterOptions(totalSemesters: number): number[] {
  return Number.isInteger(totalSemesters) && totalSemesters > 0
    ? Array.from({ length: totalSemesters }, (_, index) => index + 1)
    : [];
}
