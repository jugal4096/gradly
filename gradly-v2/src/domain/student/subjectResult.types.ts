export type ResultStatus =
  | "PASS"
  | "FAIL"
  | "BACKLOG"
  | "CLEARED"
  | "REPEAT"
  | "ABSENT"
  | "WITHHELD";

export interface SubjectResult {
  id: string;

  semesterRecordId: string;

  courseId: string;

  courseCodeSnapshot: string;

  courseNameSnapshot: string;

  credits: number;

  gradeSymbol?: string;

  gradePoint?: number;

  marks?: number;

  maximumMarks?: number;

  status: ResultStatus;

  resultSource:
    | "OFFICIAL_RESULT"
    | "MANUAL_ENTRY"
    | "IMPORTED"
    | "SIMULATION";

  verified: boolean;

  createdAt: string;
  updatedAt: string;
}