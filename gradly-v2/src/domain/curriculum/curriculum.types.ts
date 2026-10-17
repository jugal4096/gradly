export type CurriculumStatus =
  | "DRAFT"
  | "REVIEW"
  | "PUBLISHED"
  | "RETIRED";

export interface Curriculum {
  id: string;
  institutionId: string;
  programId: string;
  departmentId: string;
  schemeId: string;
  academicYearId: string;
  version: number;
  status: CurriculumStatus;
  gradingSystemId: string;
  totalSemesters: number;
  totalCredits?: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}