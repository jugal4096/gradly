export type EnrollmentComponents = {
  enrollmentNumber: string; classificationKey: string; prefix: string; admissionYear: number;
  admissionModeCode: string; branchCode: string; suffix: string;
};

export function parseEnrollmentNumber(input: string, pivotStart = 70): EnrollmentComponents {
  const enrollmentNumber = String(input ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
  if (enrollmentNumber.length < 8 || !/^[A-Z]{2}\d{2}[A-Z]\d{2}[A-Z0-9]+$/.test(enrollmentNumber)) {
    throw new Error("INVALID_ENROLLMENT_NUMBER");
  }
  const yy = Number(enrollmentNumber.slice(2, 4));
  return {
    enrollmentNumber, classificationKey: enrollmentNumber.slice(0, 7),
    prefix: enrollmentNumber.slice(0, 2),
    admissionYear: yy >= pivotStart ? 1900 + yy : 2000 + yy,
    admissionModeCode: enrollmentNumber.slice(4, 5),
    branchCode: enrollmentNumber.slice(5, 7), suffix: enrollmentNumber.slice(7),
  };
}

export type SemesterPrediction = {
  expectedSemester: number | null;
  academicYear: string;
  semesterType: "ODD" | "EVEN";
  academicYearLabel: "First Year" | "Second Year" | "Third Year" | "Final Year" | null;
  expectedGraduationSession: string;
  expectedDurationEnded: boolean;
  progressionStatus: "ESTIMATED";
};

/** One academic-session based calculation. A null semester means normal duration has ended. */
export function predictSemester(input: {
  admissionYear: number; entrySemester: number; totalSemesters: number;
  academicYearStartMonth: number; oddSemesterStartMonth: number; oddSemesterEndMonth: number;
  date?: Date;
}): SemesterPrediction {
  const date = input.date ?? new Date();
  const month = date.getMonth() + 1;
  const startYear = month >= input.academicYearStartMonth ? date.getFullYear() : date.getFullYear() - 1;
  const inOddWindow = input.oddSemesterStartMonth <= input.oddSemesterEndMonth
    ? month >= input.oddSemesterStartMonth && month <= input.oddSemesterEndMonth
    : month >= input.oddSemesterStartMonth || month <= input.oddSemesterEndMonth;
  const semesterType: "ODD" | "EVEN" = inOddWindow ? "ODD" : "EVEN";
  const sessionOffset = semesterType === "ODD" ? 0 : 1;
  const expected = input.entrySemester + (startYear - input.admissionYear) * 2 + sessionOffset;
  const expectedSemester = expected < input.entrySemester || expected > input.totalSemesters ? null : expected;
  const academicYearLabel = expectedSemester === null ? null :
    Math.ceil(expectedSemester / 2) === 1 ? "First Year" :
    Math.ceil(expectedSemester / 2) === 2 ? "Second Year" :
    Math.ceil(expectedSemester / 2) === 3 ? "Third Year" : "Final Year";
  const graduationYear = input.admissionYear + Math.ceil((input.totalSemesters - input.entrySemester + 1) / 2);
  return {
    expectedSemester, academicYear: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    semesterType, academicYearLabel,
    expectedGraduationSession: `${graduationYear}-${String((graduationYear + 1) % 100).padStart(2, "0")}`,
    expectedDurationEnded: expected > input.totalSemesters,
    progressionStatus: "ESTIMATED",
  };
}
