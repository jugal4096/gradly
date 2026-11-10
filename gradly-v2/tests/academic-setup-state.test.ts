import test from "node:test";
import assert from "node:assert/strict";
import { availableSemesterOptions, calculateAcademicGapYears, requiresBacklogDeclaration, resolveCurrentSemesterSelection } from "../src/features/dashboard/academic-setup-state.ts";

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


test("regular first-year choices include even-semester backlogs through the predicted semester", () => {
  assert.deepEqual(availableSemesterOptions(8, 1, 3, "ODD"), [1, 2, 3]);
});

test("direct second-year choices start at semester three and include even-semester backlog options", () => {
  assert.deepEqual(availableSemesterOptions(8, 3, 7, "ODD"), [3, 4, 5, 6, 7]);
});

test("even semester window also permits earlier odd-semester backlog choices", () => {
  assert.deepEqual(availableSemesterOptions(8, 1, 4, "EVEN"), [1, 2, 3, 4]);
});

test("when normal programme duration has ended, delayed students can select any semester through programme completion", () => {
  assert.deepEqual(availableSemesterOptions(8, 3, null, "ODD", true), [3, 4, 5, 6, 7, 8]);
});


test("a regular student predicted in semester three can select semester two for a backlog", () => {
  assert.deepEqual(availableSemesterOptions(8, 1, 3, "ODD"), [1, 2, 3]);
  assert.equal(resolveCurrentSemesterSelection(3, 8, true, "2", 1, "ODD"), "2");
});

test("academic gap years default to zero and are calculated from semesters below prediction", () => {
  assert.equal(calculateAcademicGapYears(3, "3"), 0);
  assert.equal(calculateAcademicGapYears(3, "1"), 1);
  assert.equal(calculateAcademicGapYears(5, "1"), 2);
  assert.equal(calculateAcademicGapYears(3, "2"), 0);
  assert.equal(calculateAcademicGapYears(3, "COMPLETED"), 0);
  assert.equal(calculateAcademicGapYears(null, "1"), 0);
});

test("backlog declaration is required only when the selected active semester is below prediction", () => {
  assert.equal(requiresBacklogDeclaration(5, "3"), true);
  assert.equal(requiresBacklogDeclaration(5, "5"), false);
  assert.equal(requiresBacklogDeclaration(5, "COMPLETED"), false);
  assert.equal(requiresBacklogDeclaration(null, "3"), false);
  assert.equal(requiresBacklogDeclaration(5, ""), false);
});
