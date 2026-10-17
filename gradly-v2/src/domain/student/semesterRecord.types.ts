export type SemesterRecordStatus =
  | "DRAFT"
  | "RESULT_PENDING"
  | "COMPLETED"
  | "WITHHELD";

export interface SemesterRecord {
  id: string;

  studentId: string;

  curriculumId: string;

  semesterNumber: number;

  academicYearId?: string;

  attempt: number;

  status: SemesterRecordStatus;

  creditsRegistered?: number;

  creditsEarned?: number;

  sgpa?: number;

  resultSource:
    | "OFFICIAL_RESULT"
    | "MANUAL_ENTRY"
    | "IMPORTED"
    | "SIMULATION";

  verified: boolean;

  createdAt: string;
  updatedAt: string;
}