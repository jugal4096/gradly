export type StudentAcademicStatus = "ENROLLED" | "GRADUATED";
export type SemesterPeriod = "ODD" | "EVEN";

/** Returns only semesters that can plausibly be active in the current institute calendar period. */
export function availableSemesterOptions(
  totalSemesters: number,
  entrySemester = 1,
  predictedSemester: number | null = null,
  semesterPeriod?: SemesterPeriod,
  expectedDurationEnded = false,
): number[] {
  if (!Number.isInteger(totalSemesters) || totalSemesters < 1) return [];
  const first = Number.isInteger(entrySemester) && entrySemester >= 1 && entrySemester <= totalSemesters ? entrySemester : 1;
  if (!semesterPeriod) return Array.from({ length: totalSemesters - first + 1 }, (_, index) => first + index);
  const parity = semesterPeriod === "ODD" ? 1 : 0;
  const max = predictedSemester !== null && Number.isInteger(predictedSemester)
    ? Math.min(predictedSemester, totalSemesters)
    : expectedDurationEnded
      ? (totalSemesters % 2 === parity ? totalSemesters : totalSemesters - 1)
      : 0;
  if (max < first) return [];
  return Array.from({ length: max - first + 1 }, (_, index) => first + index)
    .filter(number => number % 2 === parity);
}

/** Keep a manual choice only while it remains valid for the selected programme and current term. */
export function resolveCurrentSemesterSelection(
  expectedSemester: number | null,
  totalSemesters: number,
  hasManuallySelected: boolean,
  currentSelection: string,
  entrySemester = 1,
  semesterPeriod?: SemesterPeriod,
  expectedDurationEnded = false,
): string {
  const options = availableSemesterOptions(totalSemesters, entrySemester, expectedSemester, semesterPeriod, expectedDurationEnded);
  if (hasManuallySelected && currentSelection === "COMPLETED") return currentSelection;
  const current = Number(currentSelection);
  if (hasManuallySelected && Number.isInteger(current) && options.includes(current)) return currentSelection;
  return expectedSemester !== null && options.includes(expectedSemester) ? String(expectedSemester) : "";
}

export function academicStatusForSemester(selection: string): StudentAcademicStatus {
  return selection === "COMPLETED" ? "GRADUATED" : "ENROLLED";
}
