import test from "node:test";
import assert from "node:assert/strict";
import { availableSemesterOptions, resolveCurrentSemesterSelection } from "../src/features/dashboard/academic-setup-state.ts";

test("regular admission exposes every semester from the first", () => {
  assert.deepEqual(availableSemesterOptions(8, 1), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("direct second year admission starts semester choices at semester three", () => {
  assert.deepEqual(availableSemesterOptions(8, 3), [3, 4, 5, 6, 7, 8]);
});

test("DSY prediction and manual selection cannot fall back to first-year semesters", () => {
  assert.equal(resolveCurrentSemesterSelection(4, 8, false, "", 3), "4");
  assert.equal(resolveCurrentSemesterSelection(2, 8, false, "", 3), "");
  assert.equal(resolveCurrentSemesterSelection(5, 8, true, "3", 3), "3");
  assert.equal(resolveCurrentSemesterSelection(5, 8, true, "2", 3), "5");
});

test("invalid entry semester safely falls back to semester one", () => {
  assert.deepEqual(availableSemesterOptions(4, 8), [1, 2, 3, 4]);
});
