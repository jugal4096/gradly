import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const RESULT_MASTER_URL = "https://geca.ac.in/result-master.aspx";
const GECA_ORIGIN = "https://geca.ac.in";
const SESSION_CACHE_MS = 30 * 60 * 1000;
const MAX_RESULT_PDFS = 100;
// GECA result-session pages can also link general college PDFs. These are not
// examination result sheets and should never consume download/parse time.
const NON_RESULT_PDF_PATTERN = /\b(?:policy|directory|stipend)\b/i;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ENROLLMENT_PATTERN = /\b(?:BT|BE|MC|MT)\d{2}[A-Z0-9]{7,9}\b/i;
const COURSE_CODE_PATTERN = /^[A-Z]{2,}[A-Z0-9]{2,}$/i;

export type GecaResultSession = { id: string; title: string; url: string };
export type GecaMatchedGrade = { courseCode: string; grade: string; courseName?: string };
export type GecaAcademicSection = "FIRST_YEAR" | "SECOND_YEAR" | "THIRD_YEAR" | "FINAL_YEAR";
export type GecaMatchedDocument = {
  title: string;
  url: string;
  programme: string | null;
  scheme: string | null;
  semester: number | null;
  academicSection?: GecaAcademicSection | null;
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

// Retry transient GECA/network failures indefinitely. A fixed attempt ceiling can
// incorrectly fail valid result lookups while the college archive is unavailable.
// Capped exponential backoff prevents repeatedly hammering GECA.
const GECA_RETRY_INITIAL_DELAY_MS = 1_000;
const GECA_RETRY_MAX_DELAY_MS = 30_000;

function isRetryableFetchError(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string; cause?: { code?: string } };
  const code = candidate?.code || candidate?.cause?.code || "";
  return candidate?.name === "TimeoutError" || candidate?.name === "AbortError" ||
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].includes(code) ||
    candidate instanceof TypeError;
}

function retryDelay(attempt: number): number {
  const exponential = Math.min(
    GECA_RETRY_MAX_DELAY_MS,
    GECA_RETRY_INITIAL_DELAY_MS * (2 ** Math.min(attempt - 1, 10)),
  );
  return Math.round(exponential * (0.8 + Math.random() * 0.4));
}

async function fetchGecaResponse(url: string, accept: string, timeoutMs: number): Promise<Response> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) throw new Error("The GECA result link is not a trusted college URL.");

  let attempt = 0;
  let lastError: unknown;
  while (true) {
    attempt += 1;
    try {
      const response = await fetch(safeUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": "Gradly-Result-Sync/1.1",
          "Accept": accept,
          "Connection": "keep-alive",
        },
      });
      if (response.ok) return response;

      const statusError = new Error("GECA returned HTTP " + response.status + ".");
      // Retry rate limits and transient gateway/server failures. Other 4xx
      // responses (such as a missing PDF) are permanent for this URL.
      const retryableStatus = response.status === 408 || response.status === 425 ||
        response.status === 429 || response.status >= 500;
      if (!retryableStatus) {
        try { await response.body?.cancel(); } catch { /* response is unusable */ }
        throw statusError;
      }
      lastError = statusError;
      try { await response.body?.cancel(); } catch { /* retry with a fresh request */ }
    } catch (error) {
      lastError = error;
      const httpStatus = error instanceof Error
        ? Number(error.message.match(/GECA returned HTTP (\d{3})/)?.[1] || 0)
        : 0;
      if (httpStatus && httpStatus !== 408 && httpStatus !== 425 && httpStatus !== 429 && httpStatus < 500) {
        throw error;
      }
      if (!httpStatus && !isRetryableFetchError(error)) throw error;
    }

    const detail = lastError instanceof Error ? lastError.message : "unknown network error";
    console.warn("GECA request failed; retrying indefinitely:", safeUrl, "attempt", attempt, detail);
    await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)));
  }
}

async function fetchGecaText(url: string): Promise<string> {
  const response = await fetchGecaResponse(url, "text/html,application/xhtml+xml", 12000);
  return response.text();
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
  // Match the complete enrollment token only. A substring match can mistake
  // another student's longer identifier (or unrelated table text) for this one.
  const flexibleToken = enrollment.toUpperCase().split("").join("[^A-Z0-9]*");
  const match = new RegExp("(^|[^A-Z0-9])(" + flexibleToken + ")(?=$|[^A-Z0-9])", "i").exec(joined);
  if (match) return match.index + match[0].length;
  // Some PDF exports put the entire enrollment into one isolated text item.
  return line.items.some(item => compactPdfText(item.text) === compactPdfText(enrollment))
    ? joined.toUpperCase().indexOf(enrollment.toUpperCase()) + enrollment.length
    : -1;
}

function lineContainsEnrollment(line: TextLine, enrollment: string): boolean {
  return enrollmentEndInLine(line, enrollment) >= 0;
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
      if (nearest && distance < 80) {
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
        if (grade && !mapped.has(column.courseCode)) {
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
        if (grade && !mapped.has(column.courseCode)) {
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

  // The official GECA CBCS-NEW V-semester subject code is MEOE0031.
  // Keep ME4031 as a legacy alias so older saved result references still match.
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
    // Do not infer titles by collecting nearby PDF text. GECA result PDFs place
    // course codes, titles and grade cells in separate columns; a broad nearby
    // text search can concatenate several unrelated subjects into one title.
    // The client resolves names from the selected curriculum / confirmed
    // catalogue, and asks the user to enter a title when neither is available.
    grades: Array.from(matches, ([courseCode, grade]) => ({ courseCode, grade })),
    enrollmentFound,
  };
}

function romanSemester(text: string): number | null {
  const match = text.match(/\b(I{1,3}|IV|V|VI|VII|VIII|IX|X|XI|XII)\s*SEM(?:ESTER)?\b/i);
  if (!match) return null;
  const values: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10, XI:11, XII:12 };
  return values[match[1].toUpperCase()] ?? null;
}

async function readResultPdf(url: string, title: string, enrollment: string, reExamTargetCourseCode?: string, academicSection?: GecaAcademicSection | null): Promise<{
  document: GecaMatchedDocument | null;
  enrollmentFound: boolean;
  error?: string;
}> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) return { document: null, enrollmentFound: false, error: "untrusted-url" };
  const response = await fetchGecaResponse(safeUrl, "application/pdf,application/octet-stream,*/*", 18000);

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
    // Parse each page independently. PDF coordinates restart on every page;
    // combining pages lets a header at the same Y-coordinate on a previous
    // page get attached to this student's row and import unrelated subjects.
    const pageParsed = reExamTargetCourseCode
      ? { grades: extractReExamSubject(lines, enrollment, reExamTargetCourseCode), enrollmentFound: lines.some(line => lineContainsEnrollment(line, enrollment)) }
      : extractMatchingGrades(lines, enrollment);
    if (pageParsed.enrollmentFound) parsed.enrollmentFound = true;
    if (pageParsed.grades.length) {
      parsed = { grades: pageParsed.grades, enrollmentFound: true };
      break;
    }
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
    academicSection: academicSection || null,
    // Course names are resolved only from the page that supplied this
    // student's matched grade row; never borrow a similarly positioned title
    // from another page or another student's result table.
    grades: parsed.grades.map(row => ({ ...row, courseName: row.courseName || undefined })),
  } : null;
  return { document, enrollmentFound: parsed.enrollmentFound };
}

const BRANCH_NAMES: Record<string, string[]> = {
  "01": ["civil"], "02": ["mechanical"], "03": ["electrical"],
  "04": ["electronics", "entc"], "05": ["computer", "cse"],
  "06": ["information technology", "information tech"],
};
const BRANCH_SUBJECT_PREFIXES: Record<string, string[]> = {
  "01": ["CEESC", "CEPCC", "CEOE"],
  "02": ["MEESC", "MEPCC", "MEIKS"],
  "03": ["EEESC", "EEPCC", "EEIKS"],
  "04": ["ETESC", "ETPCC"],
  "05": ["CSESC", "CSPCC"],
  "06": ["ITPCC", "ITESC", "ITPE"],
};

const ACADEMIC_SECTION_LABELS: Record<string, GecaAcademicSection> = {
  FIRST: "FIRST_YEAR", "1ST": "FIRST_YEAR",
  SECOND: "SECOND_YEAR", "2ND": "SECOND_YEAR",
  THIRD: "THIRD_YEAR", "3RD": "THIRD_YEAR",
  FOURTH: "FINAL_YEAR", "4TH": "FINAL_YEAR", FINAL: "FINAL_YEAR",
};

function academicSectionBeforeLink(markup: string): GecaAcademicSection | null {
  // Preserve GECA's academic-year grouping instead of flattening all PDF links.
  const visibleText = plainText(markup
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " "));
  const pattern = /\b(FIRST|1ST|SECOND|2ND|THIRD|3RD|FOURTH|4TH|FINAL)\s+YEAR\b/gi;
  let latest: GecaAcademicSection | null = null;
  for (const match of visibleText.matchAll(pattern)) {
    latest = ACADEMIC_SECTION_LABELS[match[1].toUpperCase()] || latest;
  }
  return latest;
}

function academicSectionsForEnrollment(enrollment: string, sessionTitle: string, selectedSemester?: number): GecaAcademicSection[] {
  const sections = new Set<GecaAcademicSection>();
  const admissionYearMatch = enrollment.match(/^(?:BT|BE)(\d{2})/);
  const examYearMatch = sessionTitle.match(/\b(20\d{2})\b/);
  if (admissionYearMatch && examYearMatch) {
    const admissionYear = 2000 + Number(admissionYearMatch[1]);
    const examYear = Number(examYearMatch[1]);
    // F = regular entry; S = direct second-year entry in GECA enrollment IDs.
    const directSecondYearOffset = enrollment[4]?.toUpperCase() === "S" ? 1 : 0;
    const academicYear = examYear - admissionYear + directSecondYearOffset;
    const section = (["", "FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FINAL_YEAR"] as const)[academicYear];
    if (section) sections.add(section);
  }
  // Backlog semester results can remain grouped under the academic year of
  // that semester, even when the student has since progressed to another year.
  if (Number.isInteger(selectedSemester) && selectedSemester! >= 1 && selectedSemester! <= 8) {
    const semesterYear = Math.ceil(selectedSemester! / 2);
    const section = (["", "FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FINAL_YEAR"] as const)[semesterYear];
    if (section) sections.add(section);
  }
  return [...sections];
}

export async function findGecaEnrollmentResults(resultId: string, enrollmentNumber: string, selectedSemester?: number, reExamTargetCourseCode?: string): Promise<{
  session: GecaResultSession;
  documentsScanned: number;
  expectedAcademicSections: GecaAcademicSection[];
  candidateDocuments: number;
  enrollmentHits: number;
  parseFailures: number;
  downloadFailures: number;
  scanIncomplete: boolean;
  failedDocuments: string[];
  matches: GecaMatchedDocument[];
}> {
  if (!/^\d{1,10}$/.test(resultId)) throw new Error("Invalid GECA result session.");
  const enrollment = enrollmentNumber.trim().toUpperCase();
  if (!/^(?:BT|BE|MC|MT)[A-Z0-9]{8,10}$/.test(enrollment)) throw new Error("Enter a valid enrollment number.");
  const sessions = await listGecaResultSessions();
  const session = sessions.find(item => item.id === resultId);
  if (!session) throw new Error("The selected examination session is no longer available on the GECA portal.");

  const html = await fetchGecaText(session.url);
  const documents: Array<{ title: string; url: string; academicSection: GecaAcademicSection | null }> = [];
  for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safeGecaUrl(anchor[1]);
    if (!url) continue;
    documents.push({
      title: plainText(anchor[2]) || decodeURIComponent(url.split("/").pop() || "Result PDF"),
      url,
      academicSection: academicSectionBeforeLink(html.slice(0, anchor.index)),
    });
  }
  const unique = Array.from(new Map(documents.map(item => [item.url, item])).values())
    .filter(item => !NON_RESULT_PDF_PATTERN.test(item.title + " " + item.url));
  if (!unique.length) throw new Error("No examination result PDFs were linked to this GECA session after excluding general college documents.");

  const expectedAcademicSections = academicSectionsForEnrollment(enrollment, session.title, selectedSemester);
  const pageHasAcademicSections = unique.some(item => item.academicSection !== null);
  let eligibleDocuments = unique;
  if (pageHasAcademicSections && expectedAcademicSections.length) {
    eligibleDocuments = unique.filter(item => item.academicSection !== null && expectedAcademicSections.includes(item.academicSection));
    if (!eligibleDocuments.length) {
      throw new Error(
        "GECA lists academic-year result sections, but none match this enrollment and selected semester. Expected: " +
        expectedAcademicSections.join(", ") + ". Check the admission type, examination session and selected semester.",
      );
    }
  }

  // Branch and semester filtering runs only inside eligible academic-year
  // sections. A miss must never trigger a scan of unrelated year sections.
  let candidates = eligibleDocuments;
  const branchCode = enrollment.slice(5, 7);
  const branchTerms = BRANCH_NAMES[branchCode] || [];
  if (branchTerms.length) {
    const subjectPrefixes = BRANCH_SUBJECT_PREFIXES[branchCode] || [];
    const branchMatches = eligibleDocuments.filter(item => {
      const label = (item.title + " " + item.url).toLowerCase();
      const compactTitle = item.title.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return branchTerms.some(term => label.includes(term)) ||
        subjectPrefixes.some(prefix => compactTitle.startsWith(prefix));
    });
    if (branchMatches.length) candidates = branchMatches;
  }
  if (selectedSemester && selectedSemester >= 1 && selectedSemester <= 12) {
    const semesterMatches = candidates.filter(item => {
      const semester = romanSemester(item.title + " " + item.url.replace(/%20/gi, " "));
      // Subject-specific PDFs often omit semester text from their link label.
      return semester === selectedSemester || semester === null;
    });
    if (semesterMatches.length) candidates = semesterMatches;
  }
  if (!candidates.length) {
    throw new Error("No GECA result PDFs match the student's academic-year section, branch and selected semester.");
  }

  const matches: GecaMatchedDocument[] = [];
  let enrollmentHits = 0;
  let parseFailures = 0;
  let downloadFailures = 0;
  const failedDocuments: string[] = [];
  const scannedUrls = new Set<string>();

  const scanDocuments = async (batch: Array<{ title: string; url: string; academicSection: GecaAcademicSection | null }>) => {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(2, batch.length) }, async () => {
      while (cursor < batch.length) {
        const document = batch[cursor++];
        if (scannedUrls.has(document.url)) continue;
        scannedUrls.add(document.url);
        try {
          const parsed = await readResultPdf(document.url, document.title, enrollment, reExamTargetCourseCode, document.academicSection);
          if (parsed.enrollmentFound) enrollmentHits++;
          if (parsed.document) matches.push(parsed.document);
          else if (parsed.enrollmentFound) parseFailures++;
          if (parsed.error) {
            downloadFailures++;
            failedDocuments.push(document.title);
            console.warn("Unable to inspect one GECA result PDF:", document.title, parsed.error);
          }
        } catch (error) {
          downloadFailures++;
          failedDocuments.push(document.title);
          console.warn("Unable to inspect one GECA result PDF:", document.title, error);
        }
      }
    });
    await Promise.all(workers);
  };

  await scanDocuments(candidates);

  // Filtering is only an optimisation. If it yields no enrollment hit,
  // inspect every remaining PDF in the selected exam before reporting absent.
  if (enrollmentHits === 0 && candidates.length < eligibleDocuments.length) {
    const remaining = eligibleDocuments.filter(item => !scannedUrls.has(item.url));
    await scanDocuments(remaining);
  }

  // Never present a partial scan as a definitive "no result" or allow a
  // partial official grade set to be applied. Both Student and Tester use this
  // shared service, so the same fail-closed rule applies to both modes.
  // A failure in an unrelated PDF must not discard an already verified
  // enrollment match. Keep the scan status visible so the client can distinguish
  // a complete archive scan from a partial one, but return any matched official
  // result documents. Only report a hard failure when no usable match exists.
  if (downloadFailures > 0 && matches.length === 0) {
    const examples = failedDocuments.slice(0, 3).join(", ");
    throw new Error(
      "GECA scan incomplete: " + downloadFailures + " result PDF(s) could not be inspected" +
      (examples ? " (" + examples + ")" : "") +
      ". No verified grades were found. Retry the scan when the GECA portal is stable.",
    );
  }

  return {
    session,
    documentsScanned: scannedUrls.size,
    expectedAcademicSections,
    candidateDocuments: eligibleDocuments.length,
    enrollmentHits,
    parseFailures,
    downloadFailures,
    scanIncomplete: downloadFailures > 0,
    failedDocuments,
    matches,
  };
}
