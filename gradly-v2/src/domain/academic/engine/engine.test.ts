import { calculateSGPA, calculateCGPA } from "./index";

const sgpaResult = calculateSGPA([
  { credits: 4, gradePoint: 10 },
  { credits: 3, gradePoint: 9 },
  { credits: 3, gradePoint: 8 },
]);

console.log("SGPA:", sgpaResult);

const cgpaResult = calculateCGPA([
  { sgpa: 8.5, credits: 20 },
  { sgpa: 9.0, credits: 22 },
]);

console.log("CGPA:", cgpaResult);