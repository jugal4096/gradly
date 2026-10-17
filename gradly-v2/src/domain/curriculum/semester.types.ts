export interface Semester {
    id: string;
    curriculumId: string;
    semesterNumber: number;
    name?: string;
    academicYearId?: string;
    expectedCredits?: number;
    active: boolean;
  }