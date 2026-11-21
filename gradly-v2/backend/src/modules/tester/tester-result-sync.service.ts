import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const RESULT_MASTER_URL = "https://geca.ac.in/result-master.aspx";
const GECA_ORIGIN = "https://geca.ac.in";
const SESSION_CACHE_MS = 30 * 60 * 1000;
const MAX_RESULT_PDFS = 100;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ENROLLMENT_PATTERN = /\b(?:BT|BE|MC|MT)\d{2}[A-Z0-9]{7,9}\b/i;
const COURSE_CODE_PATTERN = /^[A-Z]{2,}[A-Z0-9]{2,}$/i;

export type GecaResultSession = { id: string; title: string; url: string };
export type GecaMatchedGrade = { courseCode: string; grade: string; courseName?: string };
export type GecaMatchedDocument = {
  title: string;
  url: string;
  programme: string | null;
  scheme: string | null;
  semester: number | null;
  grades: GecaMatchedGrade[];
};

let sessionCache: { expiresAt: number; sessions: GecaResultSession[] } | null = null;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function plainText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function safeGecaUrl(href: string): string | null {
  try {
    const url = new URL(href, GECA_ORIGIN);
    if (url.protocol !== "https:" || url.hostname !== "geca.ac.in" || !url.pathname.startsWith("/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchGecaText(url: string): Promise<string> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) throw new Error("The GECA result link is not a trusted college URL.");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(safeUrl, {
        signal: AbortSignal.timeout(20000),
        headers: { "User-Agent": "Gradly-Result-Sync/1.0", "Accept": "text/html,application/xhtml+xml" },
      });
      if (!response.ok) throw new Error("GECA result portal returned HTTP " + response.status + ".");
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "unknown network error";
  throw new Error("Unable to connect to the GECA result portal after 2 attempts. Check that this backend can reach https://geca.ac.in, then retry. (" + detail + ")");
}

export async function listGecaResultSessions(): Promise<GecaResultSession[]> {
  if (sessionCache && sessionCache.expiresAt > Date.now()) return sessionCache.sessions;
  let html: string;
  try {
    html = await fetchGecaText(RESULT_MASTER_URL);
  } catch (error) {
    // If GECA is temporarily unreachable, preserve the last known archive list
    // rather than making the result-fetch feature completely unavailable.
    if (sessionCache?.sessions.length) return sessionCache.sessions;
    throw error;
  }
  const sessions: GecaResultSession[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 2) continue;
    const anchor = cells[1][1].match(/<a\b[^>]*href=["']([^"']*result\.aspx\?resultID=\d+[^"']*)["'][^>]*>/i);
    if (!anchor) continue;
    const url = safeGecaUrl(anchor[1]);
    const id = anchor[1].match(/[?&]resultID=(\d+)/i)?.[1];
    const title = plainText(cells[0][1]);
    if (url && id && title) sessions.push({ id, title, url });
  }
  const unique = Array.from(new Map(sessions.map(item => [item.id, item])).values());
  if (!unique.length) throw new Error("No examination sessions were found on the GECA result archive.");
  sessionCache = { expiresAt: Date.now() + SESSION_CACHE_MS, sessions: unique };
  return unique;
}

type PositionedItem = { text: string; x: number; y: number };
type TextLine = { text: string; items: PositionedItem[] };

function groupPdfLines(items: PositionedItem[]): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const item of sorted) {
    let line = lines.find(candidate => Math.abs(candidate.items[0].y - item.y) <= 2.2);
    if (!line) {
      line = { text: "", items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map(item => item.text).join(" ").replace(/\s+/g, " ").trim();
  }
  return lines;
}


const GRADE_TOKEN_PATTERN = /^(?:A\+\+|A\+|B\+|C\+|AB|A|B|C|D|F|P|-)$/i;

function compactPdfText(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function enrollmentEndInLine(line: TextLine, enrollment: string): number {
  const joined = line.items.map(item => item.text).join(" ");
  const flexiblePattern = new RegExp(enrollment.toUpperCase().split("").join("[^A-Z0-9]*"), "i");
  const match = flexiblePattern.exec(joined);
  return match ? match.index + match[0].length : -1;
}

function lineContainsEnrollment(line: TextLine, enrollment: string): boolean {
  const joined = line.items.map(item => item.text).join(" ");
  // PDF text layers sometimes insert punctuation or unusual spacing between
  // enrollment characters. Compare a compact form as a second reliable path.
  return enrollmentEndInLine(line, enrollment) >= 0 ||
    compactPdfText(joined).includes(compactPdfText(enrollment));
}

function gradeTokensFromItem(item: PositionedItem): string[] {
  return item.text.toUpperCase().trim().split(/\s+/).flatMap(token => {
    const cleaned = token.replace(/^[^A-Z+-]+|[^A-Z+-]+$/g, "");
    return GRADE_TOKEN_PATTERN.test(cleaned) ? [cleaned] : [];
  });
}

type CourseColumn = { courseCode: string; x: number };

function findCourseColumns(lines: TextLine[], referenceY?: number): CourseColumn[] {
  // Parse headers from the bounded table window supplied by the enrollment-row
  // caller. Never accumulate course codes across unrelated header windows.
  // PDF text extraction can split a code across up to three adjacent items; normalize
  // fragments before treating a partial numeric suffix as a complete code.
  const rows: Array<{ y: number; columns: CourseColumn[] }> = [];
  for (const line of lines) {
    const columns: CourseColumn[] = [];
    for (let itemIndex = 0; itemIndex < line.items.length; itemIndex++) {
      const item = line.items[itemIndex];
      const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const single = clean(item.text);
      // GECA course codes end in four digits. Requiring the complete suffix
      // prevents a split fragment such as "CEOE10" from being accepted as a
      // separate course code.
      let token = /^[A-Z]{2,6}\d{4}$/.test(single) ? single : "";
      let consumed = 0;
      if (!token) {
        let combined = single;
        for (let span = 1; span <= 2 && itemIndex + span < line.items.length; span++) {
          const fragment = clean(line.items[itemIndex + span].text);
          if (!fragment) break;
          combined += fragment;
          if (combined.length > 12) break;
          if (/^[A-Z]{2,6}\d{4}$/.test(combined)) {
            token = combined;
            consumed = span;
            break;
          }
        }
      }
      if (token && !ENROLLMENT_PATTERN.test(token)) {
        columns.push({ courseCode: token, x: item.x });
        itemIndex += consumed;
      }
    }
    if (columns.length) rows.push({ y: line.items[0]?.y ?? 0, columns });
  }

  // Course-code headers are normally emitted on one horizontal row. Select the
  // strongest horizontal code row rather than mixing codes from neighboring
  // tables, exam metadata, or unrelated text lines.
  const ranked = rows
    .map(row => ({ ...row, columns: Array.from(new Map(row.columns.map(column => [column.courseCode, column])).values()) }))
    .sort((a, b) => {
      // When parsing a particular student, prefer the nearest preceding
      // course-header row. PDFs can contain several mini-tables per page,
      // and choosing the header with the most codes can borrow another table.
      if (referenceY !== undefined) {
        const distanceA = Math.abs(referenceY - a.y);
        const distanceB = Math.abs(referenceY - b.y);
        if (distanceA !== distanceB) return distanceA - distanceB;
      }
      return b.columns.length - a.columns.length || b.y - a.y;
    });
  const best = ranked[0];
  // Single-course result tables are valid in GECA re-examination PDFs.
  // Still fail closed if no valid course-code header was identified.
  if (!best || best.columns.length < 1) return [];
  return best.columns.sort((a, b) => a.x - b.x);
}

function gradesInEnrollmentRow(line: TextLine, enrollment: string, columns: CourseColumn[], nearbyGradeLines: TextLine[] = [line]): GecaMatchedGrade[] {
  if (!lineContainsEnrollment(line, enrollment) || !columns.length) return [];
  const mapped = new Map<string, string>();
  const enrollmentY = line.items[0]?.y ?? 0;
  // Grades can be emitted on a separate text baseline from the enrollment row.
  // Use only lines in the caller's tight vertical neighborhood and prioritize
  // grade cells closest to the enrollment baseline.
  const gradeCells = nearbyGradeLines.flatMap(candidate => candidate.items.flatMap(item => {
    const tokens = item.text.toUpperCase().trim().split(/[\s|,;]+/).map(token => token.replace(/^[^A-Z+-]+|[^A-Z+-]+$/g, ""));
    return tokens.filter(token => GRADE_TOKEN_PATTERN.test(token)).map(grade => ({
      grade, x: item.x, y: candidate.items[0]?.y ?? enrollmentY,
    }));
  }));
  const sortedColumns = [...columns].sort((a, b) => a.x - b.x);
  const distinctGradeColumns = new Set(gradeCells.map(item => Math.round(item.x)));

  // First choice: map grade tokens on nearby baselines to the closest course
  // header. Keep the closest token for each course to avoid neighboring rows
  // overwriting a grade for the target student.
  if (gradeCells.length && (distinctGradeColumns.size > 1 || sortedColumns.length === 1)) {
    const nearestCellByCourse = new Map<string, { grade: string; verticalDistance: number }>();
    for (const cell of gradeCells) {
      let nearest: CourseColumn | null = null;
      let distance = Number.POSITIVE_INFINITY;
      for (const column of sortedColumns) {
        const nextDistance = Math.abs(column.x - cell.x);
        if (nextDistance < distance) { nearest = column; distance = nextDistance; }
      }
      const verticalDistance = Math.abs(cell.y - enrollmentY);
      if (nearest && distance < 80 && !["AB", "P"].includes(cell.grade)) {
        const existing = nearestCellByCourse.get(nearest.courseCode);
        if (!existing || verticalDistance < existing.verticalDistance) nearestCellByCourse.set(nearest.courseCode, { grade: cell.grade === "-" ? "" : cell.grade, verticalDistance });
      }
    }
    for (const [courseCode, cell] of nearestCellByCourse) mapped.set(courseCode, cell.grade);
  }

  // If PDF.js places every grade on one nearby baseline, use the complete
  // left-to-right grade sequence to fill any course missed by x-distance
  // matching. A complete row must contain exactly one token per course.
  if (mapped.size < sortedColumns.length) {
    const gradeRows = new Map<number, typeof gradeCells>();
    for (const cell of gradeCells) {
      const baseline = Math.round(cell.y);
      const row = gradeRows.get(baseline) || [];
      row.push(cell);
      gradeRows.set(baseline, row);
    }
    const completeGradeRow = [...gradeRows.entries()]
      .filter(([, cells]) => cells.length === sortedColumns.length)
      .sort((a, b) => Math.abs(a[0] - enrollmentY) - Math.abs(b[0] - enrollmentY))[0];
    if (completeGradeRow) {
      const orderedGrades = [...completeGradeRow[1]].sort((a, b) => a.x - b.x);
      sortedColumns.forEach((column, index) => {
        const grade = orderedGrades[index]?.grade;
        if (grade && !["AB", "P"].includes(grade) && !mapped.has(column.courseCode)) {
          mapped.set(column.courseCode, grade === "-" ? "" : grade);
        }
      });
    }
  }

  // Fallback for GECA PDFs where the whole result row is emitted as one
  // text item, or individual grade cells are not close enough to their header
  // x-coordinate. Accept only a complete positional sequence and only fill
  // columns that the proximity pass could not map.
  if (mapped.size < sortedColumns.length) {
    const orderedText = line.items.map(item => item.text).join(" ");
    const compactEnrollment = compactPdfText(enrollment);
    const compactLine = compactPdfText(orderedText);
    const enrollmentAt = compactLine.indexOf(compactEnrollment);
    let positionalGrades: string[] = [];
    if (enrollmentAt >= 0) {
      const compactTail = compactLine.slice(enrollmentAt + compactEnrollment.length);
      positionalGrades = compactTail.match(/A\+\+|A\+|B\+|C\+|AB|[ABCDFP]|-/g) || [];
    }
    if (positionalGrades.length !== sortedColumns.length) {
      const enrollmentItemIndex = line.items.findIndex(item => compactPdfText(item.text).includes(compactEnrollment));
      const tailItems = enrollmentItemIndex >= 0 ? line.items.slice(enrollmentItemIndex) : line.items;
      const sequence = tailItems.flatMap(item => item.text.toUpperCase().split(/[\s|,;]+/).map(token => token.replace(/^[^A-Z+-]+|[^A-Z+-]+$/g, "")).filter(token => GRADE_TOKEN_PATTERN.test(token)));
      const afterEnrollment = enrollmentItemIndex >= 0 ? sequence.slice(1) : sequence;
      if (afterEnrollment.length === sortedColumns.length) positionalGrades = afterEnrollment;
    }
    if (positionalGrades.length === sortedColumns.length) {
      sortedColumns.forEach((column, index) => {
        const grade = positionalGrades[index];
        if (grade && !["AB", "P"].includes(grade) && !mapped.has(column.courseCode)) {
          mapped.set(column.courseCode, grade === "-" ? "" : grade);
        }
      });
    }
  }
  // Include every discovered course column in the result. If a grade cell could
  // not be read confidently, mark it explicitly so the UI blocks the import
  // instead of silently treating a partial set as a complete official result.
  for (const column of sortedColumns) {
    if (!mapped.has(column.courseCode)) mapped.set(column.courseCode, "UNREAD");
  }
  return Array.from(mapped, ([courseCode, grade]) => ({ courseCode, grade }));
}

/** Parse the selected course from GECA's single-subject re-examination tables. */
function extractReExamSubject(lines: TextLine[], enrollment: string, targetCourseCode: string): GecaMatchedGrade[] {
  const target = compactPdfText(targetCourseCode);
  if (!target) return [];

  // The official GECA CBCS-NEW V-semester PDF labels Renewable Energy
  // Engineering as MEOE0031, while the registered curriculum uses ME4031.
  // Treat both identifiers as the same subject during re-exam header lookup.
  const targetAliases = new Set([target]);
  if (target === "ME4031") targetAliases.add("MEOE0031");
  if (target === "MEOE0031") targetAliases.add("ME4031");
  // GECA labels the CBCS-NEW Disaster Management OE as CEOE1010,
  // while Gradly's selected curriculum uses CE3008.
  if (target === "CE3008") targetAliases.add("CEOE1010");
  if (target === "CEOE1010") targetAliases.add("CE3008");

  const studentRows = lines.filter(line => lineContainsEnrollment(line, enrollment));
  for (const studentLine of studentRows) {
    const studentY = studentLine.items[0]?.y ?? 0;

    // GECA exports are inconsistent: a course code may be one PDF text item,
    // embedded in a "Course Code: ..." item, or split across adjacent items.
    // Resolve the target header using compact text across up to three items.
    const headers: Array<{ x: number; distance: number }> = [];
    for (const headerLine of lines) {
      const headerY = headerLine.items[0]?.y ?? 0;
      const verticalDistance = Math.abs(headerY - studentY);
      if (headerLine === studentLine || verticalDistance > 320) continue;
      for (let index = 0; index < headerLine.items.length; index++) {
        let combined = "";
        for (let end = index; end < Math.min(headerLine.items.length, index + 3); end++) {
          combined += compactPdfText(headerLine.items[end].text);
          if ([...targetAliases].some(alias => combined.includes(alias))) {
            headers.push({ x: headerLine.items[index].x, distance: verticalDistance });
            break;
          }
          if (combined.length > target.length + 32) break;
        }
      }
    }
    headers.sort((a, b) => a.distance - b.distance);
    const header = headers[0];
    if (!header) continue;

    // Grade cells may be placed on a neighbouring baseline rather than the
    // enrollment baseline. Score candidates by both horizontal and vertical
    // proximity so a nearby student's grade is not selected accidentally.
    const grades = lines
      .filter(line => Math.abs((line.items[0]?.y ?? studentY) - studentY) <= 18)
      .flatMap(line => line.items.flatMap(item => gradeTokensFromItem(item).map(grade => ({
        grade,
        x: item.x,
        y: line.items[0]?.y ?? studentY,
      }))))
      .filter(cell => !["AB", "P"].includes(cell.grade))
      .map(cell => ({
        ...cell,
        horizontalDistance: Math.abs(cell.x - header.x),
        verticalDistance: Math.abs(cell.y - studentY),
      }))
      .filter(cell => cell.horizontalDistance < 110)
      .sort((a, b) =>
        (a.horizontalDistance + a.verticalDistance * 2) -
        (b.horizontalDistance + b.verticalDistance * 2)
      );

    const grade = grades[0];
    if (grade) return [{ courseCode: target, grade: grade.grade === "-" ? "" : grade.grade }];

    // Some GECA PDFs flatten the entire one-course student row into a single
    // text item. In that layout the grade follows the enrollment in reading
    // order, so accept it only when exactly one grade token follows it.
    const enrollmentItemIndex = studentLine.items.findIndex(item =>
      compactPdfText(item.text).includes(compactPdfText(enrollment))
    );
    if (enrollmentItemIndex >= 0) {
      const tail = studentLine.items.slice(enrollmentItemIndex).flatMap(item =>
        item.text.toUpperCase().split(/[\s|,;]+/)
          .map(token => token.replace(/^[^A-Z+-]+|[^A-Z+-]+$/g, ""))
          .filter(token => GRADE_TOKEN_PATTERN.test(token) && !["AB", "P"].includes(token))
      );
      const afterEnrollment = tail;
      if (afterEnrollment.length === 1) {
        return [{ courseCode: target, grade: afterEnrollment[0] === "-" ? "" : afterEnrollment[0] }];
      }
    }
  }
  return [];
}

function findCourseName(lines: TextLine[], courseCode: string): string | undefined {
  const compactCode = compactPdfText(courseCode);
  const candidates: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!compactPdfText(lines[index].text).includes(compactCode)) continue;
    for (const candidateLine of [lines[index], lines[index + 1], lines[index - 1]]) {
      if (!candidateLine) continue;
      const candidate = candidateLine.text
        .replace(new RegExp(courseCode.split("").join("\\s*"), "i"), " ")
        .replace(/\b(?:COURSE|CODE|GRADE|CREDIT|RESULT|SUBJECT|SEMESTER|TOTAL|PASS|FAIL)\b/gi, " ")
        .replace(/\b(?:A\+\+|A\+|B\+|C\+|A|B|C|D|F|AB|P)\b/gi, " ")
        .replace(/\s+/g, " ").trim();
      if (candidate.length >= 5 && /[A-Z]{3}/i.test(candidate) && !/^[A-Z0-9\s-]{1,12}$/.test(candidate)) candidates.push(candidate);
    }
  }
  const best = candidates.sort((a, b) => b.length - a.length)[0];
  return best && best.length <= 120 ? best : undefined;
}

function extractMatchingGrades(lines: TextLine[], enrollment: string): { grades: GecaMatchedGrade[]; enrollmentFound: boolean } {
  const matches = new Map<string, string>();
  let enrollmentFound = false;

  for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
    const line = lines[rowIndex];
    if (!lineContainsEnrollment(line, enrollment)) continue;
    enrollmentFound = true;

    // GECA PDFs can contain multiple independent result tables on the same page.
    // Resolve the course headers for THIS enrollment row only, rather than
    // combining headers from the first/second tables into one global list.
    const tableStart = Math.max(0, rowIndex - 80);
    const rowWindow = lines.slice(tableStart, rowIndex + 1);
    const enrollmentY = line.items[0]?.y ?? 0;
    const columns = findCourseColumns(rowWindow, enrollmentY);

    const nearbyGradeLines = lines.filter(candidate => Math.abs((candidate.items[0]?.y ?? 0) - enrollmentY) <= 14);
    for (const grade of gradesInEnrollmentRow(line, enrollment, columns, nearbyGradeLines)) {
      matches.set(grade.courseCode, grade.grade);
    }
  }

  return {
    grades: Array.from(matches, ([courseCode, grade]) => ({ courseCode, grade, courseName: findCourseName(lines, courseCode) })),
    enrollmentFound,
  };
}

function romanSemester(text: string): number | null {
  const match = text.match(/\b(I{1,3}|IV|V|VI|VII|VIII|IX|X|XI|XII)\s*SEM(?:ESTER)?\b/i);
  if (!match) return null;
  const values: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10, XI:11, XII:12 };
  return values[match[1].toUpperCase()] ?? null;
}

async function readResultPdf(url: string, title: string, enrollment: string, reExamTargetCourseCode?: string): Promise<{
  document: GecaMatchedDocument | null;
  enrollmentFound: boolean;
  error?: string;
}> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) return { document: null, enrollmentFound: false, error: "untrusted-url" };
  const response = await fetch(safeUrl, { signal: AbortSignal.timeout(35000), headers: { "User-Agent": "Gradly-Result-Sync/1.0" } });
  if (!response.ok) return { document: null, enrollmentFound: false, error: "http-" + response.status };
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_PDF_BYTES) return { document: null, enrollmentFound: false, error: "pdf-too-large" };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) return { document: null, enrollmentFound: false, error: "pdf-too-large-or-empty" };

  const pdf = await getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true }).promise;
  const allLines: TextLine[] = [];
  let metadataText = "";
  let parsed = { grades: [] as GecaMatchedGrade[], enrollmentFound: false };
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const positioned = content.items.flatMap((raw: unknown) => {
      if (!raw || typeof raw !== "object" || !("str" in raw) || typeof raw.str !== "string" || !raw.str.trim() || !("transform" in raw)) return [];
      const transform = (raw as { transform: number[] }).transform;
      return [{ text: (raw as { str: string }).str.trim(), x: Number(transform[4] || 0), y: Number(transform[5] || 0) }];
    });
    const lines = groupPdfLines(positioned);
    if (pageNumber === 1) metadataText = lines.map(line => line.text).join(" ");
    allLines.push(...lines);
    parsed = reExamTargetCourseCode ? { grades: extractReExamSubject(allLines, enrollment, reExamTargetCourseCode), enrollmentFound: allLines.some(line => lineContainsEnrollment(line, enrollment)) } : extractMatchingGrades(allLines, enrollment);
    // Stop reading the remaining pages once the matching enrollment row and
    // its grade columns have been found, while retaining earlier page headers.
    if (parsed.enrollmentFound && parsed.grades.length) break;
  }
  // Some installed PDF.js builds expose cleanup() but not destroy() on the
  // resolved document proxy. Release resources only when the method exists;
  // cleanup must never turn a successfully parsed PDF into a scan failure.
  const cleanup = (pdf as unknown as { cleanup?: () => Promise<void> }).cleanup;
  if (typeof cleanup === "function") {
    try { await cleanup.call(pdf); } catch { /* parsing result remains valid */ }
  }
  if (parsed.enrollmentFound && !parsed.grades.length) {
    const enrollmentIndices = allLines.map((line, index) => lineContainsEnrollment(line, enrollment) ? index : -1).filter(index => index >= 0);
    const enrollmentRows = enrollmentIndices.map(index => {
      const line = allLines[index];
      return {
        index,
        text: line.text.replace(new RegExp(enrollment, "i"), "[ENROLLMENT]"),
        items: line.items.map(item => ({ text: item.text.replace(new RegExp(enrollment, "i"), "[ENROLLMENT]"), x: Math.round(item.x), y: Math.round(item.y) })),
        gradeTokens: line.items.flatMap(item => gradeTokensFromItem(item)),
      };
    });
    const tableContext = enrollmentIndices.flatMap(index => {
      const start = Math.max(0, index - 28);
      const end = Math.min(allLines.length, index + 9);
      return allLines.slice(start, end).map((line, lineIndex) => ({
        index: start + lineIndex,
        text: line.text.replace(new RegExp(enrollment, "i"), "[ENROLLMENT]"),
        items: line.items.map(item => ({ text: item.text.replace(new RegExp(enrollment, "i"), "[ENROLLMENT]"), x: Math.round(item.x), y: Math.round(item.y) })),
        courseCodes: findCourseColumns([line]).map(column => ({ courseCode: column.courseCode, x: Math.round(column.x) })),
      }));
    });
    console.warn("GECA result table parse diagnostic:", JSON.stringify({
      title,
      pageCount: pdf.numPages,
      enrollmentRows,
      localTableContext: tableContext,
    }));
  }
  const schemeMatch = metadataText.match(/\b(NEP|CBCS(?:-NEW)?|NEW CBCS)\b/i);
  const programmeMatch = metadataText.match(/(?:Programme|Program)\s*:?\s*([A-Z][A-Z &-]{2,80})/i);
  const semester = romanSemester(title + " " + metadataText);
  const document = parsed.grades.length ? {
    title,
    url: safeUrl,
    programme: programmeMatch?.[1]?.trim() || null,
    scheme: schemeMatch?.[1]?.toUpperCase() || null,
    semester,
    grades: parsed.grades.map(row => ({ ...row, courseName: row.courseName || findCourseName(allLines, row.courseCode) })),
  } : null;
  return { document, enrollmentFound: parsed.enrollmentFound };
}

const BRANCH_NAMES: Record<string, string[]> = {
  "01": ["civil"], "02": ["mechanical"], "03": ["electrical"],
  "04": ["electronics", "entc"], "05": ["computer", "cse"],
  "06": ["information technology", "information tech"],
};

export async function findGecaEnrollmentResults(resultId: string, enrollmentNumber: string, selectedSemester?: number, reExamTargetCourseCode?: string): Promise<{
  session: GecaResultSession;
  documentsScanned: number;
  enrollmentHits: number;
  parseFailures: number;
  matches: GecaMatchedDocument[];
}> {
  if (!/^\d{1,10}$/.test(resultId)) throw new Error("Invalid GECA result session.");
  const enrollment = enrollmentNumber.trim().toUpperCase();
  if (!/^(?:BT|BE|MC|MT)[A-Z0-9]{8,10}$/.test(enrollment)) throw new Error("Enter a valid enrollment number.");
  const sessions = await listGecaResultSessions();
  const session = sessions.find(item => item.id === resultId);
  if (!session) throw new Error("The selected examination session is no longer available on the GECA portal.");

  const html = await fetchGecaText(session.url);
  const documents: Array<{ title: string; url: string }> = [];
  for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safeGecaUrl(anchor[1]);
    if (!url) continue;
    documents.push({ title: plainText(anchor[2]) || decodeURIComponent(url.split("/").pop() || "Result PDF"), url });
  }
  const unique = Array.from(new Map(documents.map(item => [item.url, item])).values()).slice(0, MAX_RESULT_PDFS);
  if (!unique.length) throw new Error("No result PDFs were linked to this GECA examination session.");

  // Narrow the scan to the enrollment's department and selected semester when
  // the official link titles expose those details. Fall back to all PDFs if
  // portal naming is ambiguous, so filtering never hides a possible result.
  let candidates = unique;
  const branchCode = enrollment.slice(5, 7);
  const branchTerms = BRANCH_NAMES[branchCode] || [];
  if (branchTerms.length) {
    const branchMatches = unique.filter(item => {
      const label = (item.title + " " + item.url).toLowerCase();
      return branchTerms.some(term => label.includes(term));
    });
    if (branchMatches.length) candidates = branchMatches;
  }
  if (selectedSemester && selectedSemester >= 1 && selectedSemester <= 12) {
    const semesterMatches = candidates.filter(item => romanSemester(item.title + " " + item.url.replace(/%20/gi, " ")) === selectedSemester);
    if (semesterMatches.length) candidates = semesterMatches;
  }

  const matches: GecaMatchedDocument[] = [];
  let enrollmentHits = 0;
  let parseFailures = 0;
  const scannedUrls = new Set<string>();

  const scanDocuments = async (batch: Array<{ title: string; url: string }>) => {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, batch.length) }, async () => {
      while (cursor < batch.length) {
        const document = batch[cursor++];
        if (scannedUrls.has(document.url)) continue;
        scannedUrls.add(document.url);
        try {
          const parsed = await readResultPdf(document.url, document.title, enrollment, reExamTargetCourseCode);
          if (parsed.enrollmentFound) enrollmentHits++;
          if (parsed.document) matches.push(parsed.document);
          else if (parsed.enrollmentFound) parseFailures++;
        } catch (error) {
          parseFailures++;
          console.warn("Unable to inspect one GECA result PDF:", document.title, error);
        }
      }
    });
    await Promise.all(workers);
  };

  await scanDocuments(candidates);

  // Filtering is only an optimisation. If it yields no enrollment hit,
  // inspect every remaining PDF in the selected exam before reporting absent.
  if (enrollmentHits === 0 && candidates.length < unique.length) {
    const remaining = unique.filter(item => !scannedUrls.has(item.url));
    await scanDocuments(remaining);
  }

  return { session, documentsScanned: scannedUrls.size, enrollmentHits, parseFailures, matches };
}
