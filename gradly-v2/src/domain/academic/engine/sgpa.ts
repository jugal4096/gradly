export interface SGPASubject {
    credits: number;
    gradePoint: number;
  }
  
  export interface SGPAResult {
    sgpa: number;
    totalCredits: number;
    totalWeightedPoints: number;
  }
  
  export function calculateSGPA(
    subjects: SGPASubject[],
    decimalPlaces = 2
  ): SGPAResult {
    if (subjects.length === 0) {
      return {
        sgpa: 0,
        totalCredits: 0,
        totalWeightedPoints: 0,
      };
    }
  
    let totalCredits = 0;
    let totalWeightedPoints = 0;
  
    for (const subject of subjects) {
      if (subject.credits <= 0) {
        throw new Error("Credits must be greater than zero.");
      }
  
      if (subject.gradePoint < 0) {
        throw new Error("Grade point cannot be negative.");
      }
  
      totalCredits += subject.credits;
      totalWeightedPoints += subject.credits * subject.gradePoint;
    }
  
    if (totalCredits === 0) {
      throw new Error("Total credits cannot be zero.");
    }
  
    const rawSGPA = totalWeightedPoints / totalCredits;
  
    const multiplier = 10 ** decimalPlaces;
  
    const sgpa =
      Math.round((rawSGPA + Number.EPSILON) * multiplier) / multiplier;
  
    return {
      sgpa,
      totalCredits,
      totalWeightedPoints,
    };
  }