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
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 10) {
    throw new Error("Decimal places must be an integer between 0 and 10.");
  }

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
      if (!Number.isFinite(subject.credits) || subject.credits <= 0) {
        throw new Error("Credits must be a finite number greater than zero.");
      }
  
      if (!Number.isFinite(subject.gradePoint) || subject.gradePoint < 0) {
        throw new Error("Grade point must be a finite, non-negative number.");
      }
  
      totalCredits += subject.credits;
      totalWeightedPoints += subject.credits * subject.gradePoint;
    }

    if (!Number.isFinite(totalCredits) || !Number.isFinite(totalWeightedPoints)) {
      throw new Error("Academic totals exceed the supported numeric range.");
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