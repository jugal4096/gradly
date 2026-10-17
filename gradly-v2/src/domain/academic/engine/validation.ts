export interface ValidationResult {
    valid: boolean;
    errors: string[];
  }
  
  export function validateCredits(credits: number): ValidationResult {
    const errors: string[] = [];
  
    if (!Number.isFinite(credits)) {
      errors.push("Credits must be a valid number.");
    }
  
    if (credits <= 0) {
      errors.push("Credits must be greater than zero.");
    }
  
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  export function validateGradePoint(
    gradePoint: number
  ): ValidationResult {
    const errors: string[] = [];
  
    if (!Number.isFinite(gradePoint)) {
      errors.push("Grade point must be a valid number.");
    }
  
    if (gradePoint < 0) {
      errors.push("Grade point cannot be negative.");
    }
  
    return {
      valid: errors.length === 0,
      errors,
    };
  }