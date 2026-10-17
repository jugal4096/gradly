export type CourseType =
  | "THEORY"
  | "PRACTICAL"
  | "PROJECT"
  | "ELECTIVE"
  | "AUDIT"
  | "OTHER";

export interface CurriculumCourse {
  id: string;
  curriculumId: string;
  courseId: string;

  semesterNumber: number;

  courseCode: string;
  courseName: string;

  credits: number;

  type: CourseType;

  mandatory: boolean;

  electiveGroupId?: string;

  active: boolean;
}