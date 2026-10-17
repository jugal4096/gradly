import type { GradeDefinition } from "../../grading/gradingSystem.types";

export function findGradeBySymbol(
  grades: GradeDefinition[],
  symbol: string
): GradeDefinition | undefined {
  return grades.find(
    (grade) => grade.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function findGradeByPoint(
  grades: GradeDefinition[],
  gradePoint: number
): GradeDefinition | undefined {
  return grades.find((grade) => grade.gradePoint === gradePoint);
}

export function getPassingGrades(
  grades: GradeDefinition[]
): GradeDefinition[] {
  return grades.filter((grade) => grade.pass);
}