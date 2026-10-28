import assert from "node:assert/strict";
import { calculateSGPA } from "./sgpa.ts";
import { calculateCGPA } from "./cgpa.ts";

const sgpa = calculateSGPA([
  { credits: 4, gradePoint: 10 },
  { credits: 3, gradePoint: 9 },
  { credits: 3, gradePoint: 8 },
]);
assert.deepEqual(sgpa, {
  sgpa: 9.1,
  totalCredits: 10,
  totalWeightedPoints: 91,
});

const cgpa = calculateCGPA([
  { sgpa: 8.5, credits: 20 },
  { sgpa: 9, credits: 22 },
]);
assert.deepEqual(cgpa, {
  cgpa: 8.76,
  totalCredits: 42,
  totalWeightedPoints: 368,
});

assert.deepEqual(calculateSGPA([]), {
  sgpa: 0,
  totalCredits: 0,
  totalWeightedPoints: 0,
});
assert.deepEqual(calculateCGPA([]), {
  cgpa: 0,
  totalCredits: 0,
  totalWeightedPoints: 0,
});

assert.throws(() => calculateSGPA([{ credits: Number.NaN, gradePoint: 8 }]), /finite number/);
assert.throws(() => calculateSGPA([{ credits: 3, gradePoint: Number.POSITIVE_INFINITY }]), /finite, non-negative/);
assert.throws(() => calculateSGPA([{ credits: 0, gradePoint: 8 }]), /finite number greater than zero/);
assert.throws(() => calculateCGPA([{ credits: 20, sgpa: Number.NaN }]), /finite, non-negative/);
assert.throws(() => calculateCGPA([{ credits: Number.POSITIVE_INFINITY, sgpa: 8 }]), /finite number/);
assert.throws(() => calculateCGPA([{ credits: 20, sgpa: -1 }]), /finite, non-negative/);
assert.throws(() => calculateSGPA([{ credits: 1, gradePoint: 8 }], 1.5), /integer between 0 and 10/);

console.log("Academic calculation assertions passed.");
