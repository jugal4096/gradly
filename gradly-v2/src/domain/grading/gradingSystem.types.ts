export interface GradeDefinition {
    id: string;
    gradingSystemId: string;
  
    symbol: string;
    gradePoint: number;
  
    minimumMarks?: number;
    maximumMarks?: number;
  
    pass: boolean;
  
    description?: string;
  }
  
  export interface GradingSystem {
    id: string;
  
    institutionId: string;
  
    name: string;
  
    description?: string;
  
    gradeCalculationMode:
      | "ABSOLUTE"
      | "RELATIVE"
      | "HYBRID"
      | "CUSTOM";
  
    roundingMode?:
      | "NONE"
      | "HALF_UP"
      | "HALF_DOWN"
      | "UP"
      | "DOWN";
  
    decimalPlaces?: number;
  
    active: boolean;
  
    createdAt: string;
    updatedAt: string;
  }