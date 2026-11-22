import assert from "node:assert/strict";
import test from "node:test";
import {
  academicSectionsForEnrollment,
  selectGecaAcademicDocuments,
  selectGecaBranchDocuments,
  selectGecaSemesterDocuments,
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

test("semester filtering uses the enclosing GECA section for subject PDFs without semester in filename", () => {
  const documents = [
    { title: "CEESC1003_RESULT", url: "https://geca.ac.in/sem2.pdf", sectionSemester: 2 },
    { title: "CIVIL ENGINEERING II SEM REGULAR", url: "https://geca.ac.in/sem2-regular.pdf", sectionSemester: null },
    { title: "CIVIL ENGINEERING IV SEM REGULAR", url: "https://geca.ac.in/sem4-regular.pdf", sectionSemester: null },
    { title: "CEESC1005_RESULT", url: "https://geca.ac.in/unknown.pdf", sectionSemester: null },
  ];
  assert.deepEqual(
    selectGecaSemesterDocuments(documents, 2),
    [documents[0], documents[1]],
  );
});

test("semester filtering recognizes GECA filenames ending in IV REGULAR", () => {
  const documents = [
    { title: "CIVIL ENGINEERING IV REGULAR", url: "https://geca.ac.in/iv-regular.pdf", sectionSemester: null },
    { title: "CIVIL ENGINEERING V REGULAR", url: "https://geca.ac.in/v-regular.pdf", sectionSemester: null },
  ];
  assert.deepEqual(selectGecaSemesterDocuments(documents, 5), [documents[1]]);
});

test("semester filtering excludes a PDF when its filename and section identify another semester", () => {
  const documents = [
    { title: "Civil Engineering II SEM REGULAR", url: "https://geca.ac.in/sem2.pdf", sectionSemester: 4 },
    { title: "Civil Engineering IV SEM REGULAR", url: "https://geca.ac.in/sem4.pdf", sectionSemester: 2 },
    { title: "CEESC1005_RESULT", url: "https://geca.ac.in/unknown.pdf", sectionSemester: null },
  ];
  assert.deepEqual(selectGecaSemesterDocuments(documents, 4), [documents[0]]);
});

test("semester filtering leaves all documents untouched when no semester is selected", () => {
  const documents = [
    { title: "CEESC1003_RESULT", url: "https://geca.ac.in/subject.pdf", sectionSemester: 2 },
  ];
  assert.deepEqual(selectGecaSemesterDocuments(documents), documents);
});


test("branch filtering never falls back to unrelated PDFs when no branch label matches", () => {
  const documents = [
    { title: "CIVIL ENGINEERING V REGULAR", url: "https://geca.ac.in/civil-v.pdf" },
    { title: "Mechanical Engineering V REGULAR", url: "https://geca.ac.in/mech-v.pdf" },
    { title: "List of PhD Students", url: "https://geca.ac.in/phd.pdf" },
  ];
  assert.deepEqual(
    selectGecaBranchDocuments(documents, ["civil"], ["CEESC", "CEOE"]),
    [documents[0]],
  );
  assert.deepEqual(
    selectGecaBranchDocuments(documents.slice(1), ["civil"], ["CEESC", "CEOE"]),
    [],
  );
});

test("branch filtering accepts only known subject-code prefixes for the selected branch", () => {
  const documents = [
    { title: "CEESC1005_RESULT", url: "https://geca.ac.in/subject.pdf" },
    { title: "CSESC1005_RESULT", url: "https://geca.ac.in/cse.pdf" },
  ];
  assert.deepEqual(
    selectGecaBranchDocuments(documents, ["civil"], ["CEESC", "CEOE"]),
    [documents[0]],
  );
});
