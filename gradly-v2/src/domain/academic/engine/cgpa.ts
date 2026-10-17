export interface CGPASemester {
    sgpa: number;
    credits: number;
  }
  
  export interface CGPAResult {
    cgpa: number;
    totalCredits: number;
    totalWeightedPoints: number;
  }
  
  export function calculateCGPA(
    semesters: CGPASemester[],
    decimalPlaces = 2
  ): CGPAResult {
    if (semesters.length === 0) {
      return {
        cgpa: 0,
        totalCredits: 0,
        totalWeightedPoints: 0,
      };
    }
  
    let totalCredits = 0;
    let totalWeightedPoints = 0;
  
    for (const semester of semesters) {
      if (semester.credits <= 0) {
        throw new Error("Semester credits must be greater than zero.");
      }
  
      if (semester.sgpa < 0) {
        throw new Error("SGPA cannot be negative.");
      }
  
      totalCredits += semester.credits;
      totalWeightedPoints += semester.sgpa * semester.credits;
    }
  
    if (totalCredits === 0) {
      throw new Error("Total credits cannot be zero.");
    }
  
    const rawCGPA = totalWeightedPoints / totalCredits;
  
    const multiplier = 10 ** decimalPlaces;
  
    const cgpa =
      Math.round((rawCGPA + Number.EPSILON) * multiplier) / multiplier;
  
    return {
      cgpa,
      totalCredits,
      totalWeightedPoints,
    };
  }