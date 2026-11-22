import assert from "node:assert/strict";
import test from "node:test";
import {
  academicSectionsForEnrollment,
  selectGecaAcademicDocuments,
  type GecaAcademicSection,
} from "./tester-result-sync.service";

test("regular BT25 Semester II resolves to the first-year GECA section", () => {
  assert.deepEqual(
    academicSectionsForEnrollment("BT25F05F033", "ESE APRIL-MAY 2026", 2),
    ["FIRST_YEAR"],
  );
});

test("direct-second-year BT25 Semester III resolves to the second-year GECA section", () => {
  assert.deepEqual(
    academicSectionsForEnrollment("BT25S05F033", "ESE APRIL-MAY 2026", 3),
    ["SECOND_YEAR"],
  );
});

test("academic-section mismatch falls back to all official result documents", () => {
  const documents: Array<{ title: string; academicSection: GecaAcademicSection | null }> = [
    { title: "CSE first-year PDF", academicSection: "SECOND_YEAR" },
    { title: "CSE individual subject PDF", academicSection: null },
  ];
  const selection = selectGecaAcademicDocuments(documents, ["FIRST_YEAR"], true);
  assert.equal(selection.fallbackUsed, true);
  assert.deepEqual(selection.documents, documents);
});

test("matching academic-section headings retain the targeted first-year scan", () => {
  const documents: Array<{ title: string; academicSection: GecaAcademicSection | null }> = [
    { title: "First-year CSE PDF", academicSection: "FIRST_YEAR" },
    { title: "Second-year CSE PDF", academicSection: "SECOND_YEAR" },
  ];
  const selection = selectGecaAcademicDocuments(documents, ["FIRST_YEAR"], true);
  assert.equal(selection.fallbackUsed, false);
  assert.deepEqual(selection.documents, [documents[0]]);
});
