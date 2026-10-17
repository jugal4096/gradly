export interface AcademicScheme {
    id: string;
    institutionId: string;
    programId: string;
    name: string;
    code?: string;
    regulations?: string;
    effectiveFromAcademicYear?: string;
    effectiveToAcademicYear?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }