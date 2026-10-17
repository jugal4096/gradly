export interface StudentProfile {
    id: string;
  
    userId: string;
  
    studentId: string;
  
    institutionId: string;
  
    programId: string;
  
    departmentId: string;
  
    curriculumId: string;
  
    admissionModeId?: string;
  
    admissionYear: number;
  
    currentSemester: number;
  
    currentAcademicYearId?: string;
  
    graduationYear?: number;
  
    targetCGPA?: number;
  
    createdAt: string;
    updatedAt: string;
  }