import { calculateSGPA } from "./sgpa.ts";
import { calculateCGPA } from "./cgpa.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message + "\nExpected: " + JSON.stringify(expected) +
      "\nReceived: " + JSON.stringify(actual)
    );
  }
}

function assertThrows(action: () => unknown, pattern: RegExp): void {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), "Unexpected error message: " + message);
    return;
  }

  throw new Error("Expected the operation to throw " + pattern.toString());
}

const sgpa = calculateSGPA([
  { credits: 4, gradePoint: 10 },
  { credits: 3, gradePoint: 9 },
  { credits: 3, gradePoint: 8 },
]);
assertDeepEqual(
  sgpa,
  { sgpa: 9.1, totalCredits: 10, totalWeightedPoints: 91 },
  "SGPA should be credit-weighted"
);

const cgpa = calculateCGPA([
  { sgpa: 8.5, credits: 20 },
  { sgpa: 9, credits: 22 },
]);
assertDeepEqual(
  cgpa,
  { cgpa: 8.76, totalCredits: 42, totalWeightedPoints: 368 },
  "CGPA should be weighted by semester credits"
);

assertDeepEqual(
  calculateSGPA([]),
  { sgpa: 0, totalCredits: 0, totalWeightedPoints: 0 },
  "Empty SGPA input should return the documented empty result"
);
assertDeepEqual(
  calculateCGPA([]),
  { cgpa: 0, totalCredits: 0, totalWeightedPoints: 0 },
  "Empty CGPA input should return the documented empty result"
);

assertThrows(
  () => calculateSGPA([{ credits: Number.NaN, gradePoint: 8 }]),
  /finite number/
);
assertThrows(
  () => calculateSGPA([{ credits: 3, gradePoint: Number.POSITIVE_INFINITY }]),
  /finite, non-negative/
);
assertThrows(
  () => calculateSGPA([{ credits: 0, gradePoint: 8 }]),
  /finite number greater than zero/
);
assertThrows(
  () => calculateCGPA([{ credits: 20, sgpa: Number.NaN }]),
  /finite, non-negative/
);
assertThrows(
  () => calculateCGPA([{ credits: Number.POSITIVE_INFINITY, sgpa: 8 }]),
  /finite number/
);
assertThrows(
  () => calculateCGPA([{ credits: 20, sgpa: -1 }]),
  /finite, non-negative/
);
assertThrows(
  () => calculateSGPA([{ credits: 1, gradePoint: 8 }], 1.5),
  /integer between 0 and 10/
);

console.log("Academic calculation assertions passed.");
