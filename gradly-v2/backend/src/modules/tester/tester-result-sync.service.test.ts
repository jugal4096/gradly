import assert from "node:assert/strict";
import test from "node:test";
import {
  academicSectionsForEnrollment,
  selectGecaAcademicDocuments,
  selectGecaBranchDocuments,
  selectGecaSemesterDocuments,
  extractSubjectResultGrades,
  extractMatchingGrades,
  isRestrictedGecaResultFetch,
  type GecaAcademicSection,
} from "./tester-result-sync.service";

test("only Semester II of GECA ESE April-May 2026 is restricted", () => {
  assert.equal(isRestrictedGecaResultFetch({ id: "3018" }, 2), true);
  assert.equal(isRestrictedGecaResultFetch({ id: "3018" }, 1), false);
  assert.equal(isRestrictedGecaResultFetch({ id: "3018" }, 3), false);
  assert.equal(isRestrictedGecaResultFetch({ id: "3017" }, 2), false);
  assert.equal(isRestrictedGecaResultFetch({ id: "9999" }, 2), false);
});

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

test("unlabelled subject PDFs remain candidates when academic-section headings mismatch", () => {
  const documents: Array<{ title: string; academicSection: GecaAcademicSection | null }> = [
    { title: "CSE first-year PDF", academicSection: "SECOND_YEAR" },
    { title: "CSE individual subject PDF", academicSection: null },
  ];
  const selection = selectGecaAcademicDocuments(documents, ["FIRST_YEAR"], true);
  assert.equal(selection.fallbackUsed, false);
  assert.deepEqual(selection.documents, [documents[1]]);
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

test("semester filtering recognizes GECA's abbreviated IV REG and IV BACK labels", () => {
  const documents = [
    { title: "INFORMATION TECHNOLOGY-2021-22 ( CBCS-NEW ) IV REG", url: "https://geca.ac.in/it-iv-reg.pdf", sectionSemester: null },
    { title: "INFORMATION TECHNOLOGY-2021-22 ( CBCS-NEW ) IV BACK", url: "https://geca.ac.in/it-iv-back.pdf", sectionSemester: null },
    { title: "INFORMATION TECHNOLOGY-2021-22 ( CBCS-NEW ) VI REG", url: "https://geca.ac.in/it-vi-reg.pdf", sectionSemester: null },
  ];
  assert.deepEqual(
    selectGecaSemesterDocuments(documents, 4),
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


test("semester filtering recognizes Arabic and ordinal semester labels", () => {
  const documents = [
    { title: "CIVIL ENGINEERING SEMESTER 2 REGULAR", url: "https://geca.ac.in/sem2.pdf", sectionSemester: null },
    { title: "CIVIL ENGINEERING 2ND SEMESTER", url: "https://geca.ac.in/2nd-sem.pdf", sectionSemester: null },
    { title: "CIVIL ENGINEERING SEMESTER 4", url: "https://geca.ac.in/sem4.pdf", sectionSemester: null },
  ];
  assert.deepEqual(
    selectGecaSemesterDocuments(documents, 2),
    [documents[0], documents[1]],
  );
});

test("academic section prioritization retains unlabelled links for semester validation", () => {
  const documents: Array<{ title: string; academicSection: GecaAcademicSection | null }> = [
    { title: "First-year result PDF", academicSection: "FIRST_YEAR" },
    { title: "Subject result PDF", academicSection: null },
    { title: "Third-year result PDF", academicSection: "THIRD_YEAR" },
  ];
  const selection = selectGecaAcademicDocuments(documents, ["FIRST_YEAR"], true);
  assert.deepEqual(selection.documents, [documents[0], documents[1]]);
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

test("branch filtering admits generic subject result PDFs for in-PDF validation", () => {
  const documents = [
    { title: "AMESC1001_RESULT", url: "https://geca.ac.in/AMESC1001_RESULT.pdf" },
    { title: "MABSC1003_RESULT", url: "https://geca.ac.in/MABSC1003_RESULT.pdf" },
    { title: "List of PhD Students", url: "https://geca.ac.in/phd.pdf" },
  ];
  assert.deepEqual(
    selectGecaBranchDocuments(documents, ["mechanical"], ["MEESC", "MEPCC", "MEIKS"]),
    documents.slice(0, 2),
  );
});

test("consolidated NEP parser extracts the official GECA IV result row for BT24F01F001", () => {
  // Course-code/title cells in GECA's ESE APRIL-MAY 2026 Civil NEP IV PDF
  // may be emitted as one PDF.js text item with embedded line breaks.
  const enrollment = "BT24F01F001";
  const codes = [
    "AMPCC2003", "AMPCC2004", "CEEEM1020", "CEPCC2005",
    "CEPCC2006", "CEPCC2007", "CEPCC2008", "CEVSE2001",
    "ETOEC1020", "INAEC1002", "INMDM2002", "INVEC1001",
  ];
  const grades = ["A+", "A", "A+", "A", "A", "B", "A++", "A+", "C+", "A", "A+", "A+"];
  const header = codes.map((code, index) => ({
    text: code + "\\nSubject title " + (index + 1),
    x: 200 + index * 70,
    y: 500,
  }));
  const gradeItems = [
    { text: "4", x: 20, y: 480 },
    { text: enrollment, x: 70, y: 480 },
    ...grades.map((grade, index) => ({ text: grade, x: 200 + index * 70, y: 480 })),
  ];
  const parsed = extractMatchingGrades([
    { text: header.map(item => item.text).join(" "), items: header },
    { text: "4 " + enrollment + " " + grades.join(" "), items: gradeItems },
  ], enrollment);
  assert.equal(parsed.enrollmentFound, true);
  assert.deepEqual(parsed.grades, codes.map((courseCode, index) => ({
    courseCode,
    grade: grades[index],
  })));
});

test("individual subject parser imports only the target enrollment row with the expected branch", () => {
  const lines = [
    { text: "REGNO STUDNAME CCODE COURSENAME BRANCH Grade", items: [
      { text: "REGNO", x: 20, y: 500 }, { text: "STUDNAME", x: 100, y: 500 },
      { text: "CCODE", x: 400, y: 500 }, { text: "COURSENAME", x: 340, y: 500 },
      { text: "BRANCH", x: 520, y: 500 }, { text: "Grade", x: 700, y: 500 },
    ] },
    { text: "BT25F02F001 Student AMESC1001 Engineering Mechanics Mechanical Engineering A+", items: [
      { text: "BT25F02F001", x: 20, y: 480 }, { text: "Student", x: 100, y: 480 },
      { text: "AMESC1001", x: 400, y: 480 }, { text: "Engineering Mechanics", x: 340, y: 480 },
      { text: "Mechanical Engineering", x: 520, y: 480 }, { text: "A+", x: 700, y: 480 },
    ] },
    { text: "BT25F03F002 Student AMESC1001 Engineering Mechanics Electrical Engineering B", items: [
      { text: "BT25F03F002", x: 20, y: 460 }, { text: "Student", x: 100, y: 460 },
      { text: "AMESC1001", x: 260, y: 460 }, { text: "Engineering Mechanics", x: 340, y: 460 },
      { text: "Electrical Engineering", x: 520, y: 460 }, { text: "B", x: 700, y: 460 },
    ] },
  ];
  const parsed = extractSubjectResultGrades(lines, "BT25F02F001", ["mechanical"]);
  assert.equal(parsed.enrollmentFound, true);
  assert.deepEqual(parsed.grades, [{ courseCode: "AMESC1001", grade: "A+" }]);
});

test("individual subject parser handles GECA tables with optional SEM and shifted row columns", () => {
  const enrollment = "BT25F01F004";
  const civil = ["civil engineering"];
  const layouts = [
    {
      // CEPCC-style: SEM is present; row branch starts left of BRANCH header.
      header: [
        { text: "REGNO", x: 130, y: 749 }, { text: "STUDNAME", x: 189, y: 749 },
        { text: "SEM", x: 387, y: 749 }, { text: "COURSENAME", x: 460, y: 749 },
        { text: "CCODE", x: 574, y: 749 }, { text: "BRANCH", x: 657, y: 749 },
        { text: "Grade", x: 744, y: 749 },
      ],
      row: [
        { text: enrollment, x: 116, y: 652 }, { text: "Student Name", x: 189, y: 652 },
        { text: "2", x: 394, y: 652 }, { text: "Engineering Geology", x: 438, y: 652 },
        { text: "CEPCC1001", x: 564, y: 652 }, { text: "Civil Engineering", x: 632, y: 652 },
        { text: "A", x: 754, y: 652 },
      ],
      expected: [{ courseCode: "CEPCC1001", grade: "A" }],
    },
    {
      // CHBSC-style: no SEM column; title begins at the COURSENAME header.
      header: [
        { text: "REGNO", x: 327, y: 814 }, { text: "STUDNAME", x: 372, y: 814 },
        { text: "COURSENAME", x: 516, y: 814 }, { text: "CCODE", x: 695, y: 814 },
        { text: "BRANCH", x: 735, y: 814 }, { text: "Grade", x: 868, y: 814 },
      ],
      row: [
        { text: enrollment, x: 327, y: 771 }, { text: "Student Name", x: 372, y: 771 },
        { text: "Battery Science, Lubricant and Green Chemistry", x: 516, y: 771 },
        { text: "CHBSC1002", x: 695, y: 771 }, { text: "Civil Engineering", x: 735, y: 771 },
        { text: "A+", x: 873, y: 771 },
      ],
      expected: [{ courseCode: "CHBSC1002", grade: "A+" }],
    },
  ];

  for (const layout of layouts) {
    const parsed = extractSubjectResultGrades([
      { text: layout.header.map(item => item.text).join(" "), items: layout.header },
      { text: layout.row.map(item => item.text).join(" "), items: layout.row },
    ], enrollment, civil);
    assert.equal(parsed.enrollmentFound, true);
    assert.deepEqual(parsed.grades, layout.expected);
  }
});

test("individual subject parser supports split headers and a separate grade baseline", () => {
  const enrollment = "BT24F01F001";
  const lines = [
    { text: "REGNO STUDNAME COURSENAME", items: [
      { text: "REGNO", x: 20, y: 810 }, { text: "STUDNAME", x: 100, y: 810 },
      { text: "COURSENAME", x: 300, y: 810 },
    ] },
    { text: "CCODE BRANCH Grade", items: [
      { text: "CCODE", x: 450, y: 800 }, { text: "BRANCH", x: 540, y: 800 },
      { text: "Grade", x: 700, y: 800 },
    ] },
    { text: "BT24F01F001 Student Engineering Mathematics INMDM1002 Civil Engineering", items: [
      { text: enrollment, x: 20, y: 700 }, { text: "Student", x: 100, y: 700 },
      { text: "Engineering Mathematics", x: 300, y: 700 }, { text: "INMDM1002", x: 450, y: 700 },
      { text: "Civil Engineering", x: 540, y: 700 },
    ] },
    { text: "A+", items: [{ text: "A+", x: 700, y: 695 }] },
  ];
  const parsed = extractSubjectResultGrades(lines, enrollment, ["civil"]);
  assert.equal(parsed.enrollmentFound, true);
  assert.deepEqual(parsed.grades, [{ courseCode: "INMDM1002", grade: "A+" }]);
});

test("individual subject parser refuses a target enrollment when its branch column conflicts", () => {
  const lines = [
    { text: "REGNO CCODE BRANCH Grade", items: [
      { text: "REGNO", x: 20, y: 500 }, { text: "CCODE", x: 400, y: 500 },
      { text: "COURSENAME", x: 340, y: 500 }, { text: "BRANCH", x: 520, y: 500 }, { text: "Grade", x: 700, y: 500 },
    ] },
    { text: "BT25F02F001 AMESC1001 Electrical Engineering A+", items: [
      { text: "BT25F02F001", x: 20, y: 480 }, { text: "AMESC1001", x: 400, y: 480 },
      { text: "Electrical Engineering", x: 520, y: 480 }, { text: "A+", x: 700, y: 480 },
    ] },
  ];
  const parsed = extractSubjectResultGrades(lines, "BT25F02F001", ["mechanical"]);
  assert.equal(parsed.enrollmentFound, true);
  assert.deepEqual(parsed.grades, []);
});
