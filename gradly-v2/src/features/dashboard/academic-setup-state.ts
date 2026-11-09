export type StudentAcademicStatus = "ENROLLED" | "GRADUATED";
export type SemesterPeriod = "ODD" | "EVEN";

/** Returns only semesters that can plausibly be active in the current institute calendar period. */
export function availableSemesterOptions(
  totalSemesters: number,
  entrySemester = 1,
  predictedSemester: number | null = null,
  _semesterPeriod?: SemesterPeriod,
  expectedDurationEnded = false,
): number[] {
  if (!Number.isInteger(totalSemesters) || totalSemesters < 1) return [];
  const first = Number.isInteger(entrySemester) && entrySemester >= 1 && entrySemester <= totalSemesters ? entrySemester : 1;
  if (!_semesterPeriod) return Array.from({ length: totalSemesters - first + 1 }, (_, index) => first + index);
  const max = predictedSemester !== null && Number.isInteger(predictedSemester)
    ? Math.min(predictedSemester, totalSemesters)
    : expectedDurationEnded
      ? totalSemesters
      : 0;
  if (max < first) return [];
  // Backlog students may be active in either semester parity. The prediction is an upper bound,
  // not a filter that removes even semesters during an odd term (or vice versa).
  return Array.from({ length: max - first + 1 }, (_, index) => first + index);
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


export type AcademicDelayReason = "PENDING_BACKLOGS" | "ACADEMIC_GAP" | "OTHER";

/** Only ask for an explanation when an enrolled student's declared semester differs from prediction. */
export function shouldAskAcademicDelayReason(predictedSemester: number | null, actualSemester: string, completed = false): boolean {
  if (completed || actualSemester === "COMPLETED" || !actualSemester || predictedSemester === null) return false;
  return Number(actualSemester) !== predictedSemester;
}

/** Backlog and gap declarations are relevant only to a mismatch and their matching reason. */
export function academicDelayDeclarations(
  reason: AcademicDelayReason | "",
  gapYears: string,
  backlogCount: string,
  shouldAsk: boolean,
) {
  return {
    academicGapYears: shouldAsk && reason === "ACADEMIC_GAP" && gapYears !== "" ? Number(gapYears) : null,
    pendingBacklogCount: shouldAsk && reason === "PENDING_BACKLOGS" && backlogCount !== "" ? Number(backlogCount) : null,
  };
}
