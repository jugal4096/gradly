const RESULT_MASTER_URL = "https://geca.ac.in/result-master.aspx";
const GECA_ORIGIN = "https://geca.ac.in";
const SESSION_CACHE_MS = 30 * 60 * 1000;
const MAX_RESULT_PDFS = 100;
// GECA result-session pages can also link general college PDFs. These are not
// examination result sheets and should never consume download/parse time.
const NON_RESULT_PDF_PATTERN = /\b(?:policy|directory|stipend)\b/i;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
// Render's 512 MiB instance was OOM-killed during parallel PDF.js parsing.
// Keep one active PDF parser per process; downloads remain deduplicated and cached.
const ENROLLMENT_PATTERN = /\b(?:BT|BE|MC|MT)\d{2}[A-Z0-9]{7,9}\b/i;

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

// Official GECA result archive currently lists ESE APRIL-MAY 2026 as resultID 3018.
// This fallback keeps the picker usable if result-master.aspx alone is unavailable;
// the result detail page and PDFs are still fetched live before grades are imported.
const KNOWN_GECA_RESULT_SESSIONS: GecaResultSession[] = [
  { id: "3018", title: "ESE APRIL-MAY 2026", url: "https://geca.ac.in/result.aspx?resultID=3018" },
];

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

// Keep GECA outages from hanging a student's result-import request forever.
// Four short attempts ride out transient resets without tying up an API request for minutes.
const GECA_RETRY_MAX_ATTEMPTS = 4;
const GECA_RETRY_DELAYS_MS = [750, 1_500, 3_000];

function fetchErrorDetails(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      const candidate = current as Error & { code?: string; cause?: unknown };
      const code = candidate.code ? " [" + candidate.code + "]" : "";
      const message = candidate.message || candidate.name;
      if (message && !parts.includes(message + code)) parts.push(message + code);
      current = candidate.cause;
    } else {
      const message = String(current);
      if (message && !parts.includes(message)) parts.push(message);
      break;
    }
  }
  return parts.join(" <- ") || "unknown network error";
}

function isRetryableFetchError(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string; cause?: { code?: string } };
  const code = candidate?.code || candidate?.cause?.code || "";
  return candidate?.name === "TimeoutError" || candidate?.name === "AbortError" ||
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EHOSTUNREACH",
      "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT"].includes(code) ||
    candidate instanceof TypeError;
}

async function fetchGecaResponse<T>(url: string, accept: string, timeoutMs: number, consume: (response: Response) => Promise<T>): Promise<T> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) throw new Error("The GECA result link is not a trusted college URL.");

  let lastError: unknown;
  for (let attempt = 1; attempt <= GECA_RETRY_MAX_ATTEMPTS; attempt++) {
    let response: Response | null = null;
    try {
      response = await fetch(safeUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
        headers: {
          // GECA's legacy ASP.NET host can reject non-browser user agents.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": accept,
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Referer": GECA_ORIGIN + "/",
        },
      });
      if (response.ok) {
        // Consume the body before leaving this retry scope. AbortSignal.timeout()
        // remains active while the body streams; returning Response here used to
        // let arrayBuffer()/text() time out outside the retry handler.
        return await consume(response);
      }

      const statusError = new Error("GECA returned HTTP " + response.status + ".");
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
      try { await response?.body?.cancel(); } catch { /* body may already be consumed */ }
      const httpStatus = error instanceof Error
        ? Number(error.message.match(/GECA returned HTTP (\d{3})/)?.[1] || 0)
        : 0;
      if (httpStatus && httpStatus !== 408 && httpStatus !== 425 && httpStatus !== 429 && httpStatus < 500) {
        throw error;
      }
      if (!httpStatus && !isRetryableFetchError(error)) throw error;
    }

    if (attempt < GECA_RETRY_MAX_ATTEMPTS) {
      const delay = GECA_RETRY_DELAYS_MS[attempt - 1] ?? 3_000;
      console.warn("GECA request failed; retrying:", safeUrl, "attempt", attempt, "of", GECA_RETRY_MAX_ATTEMPTS, fetchErrorDetails(lastError));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const detail = fetchErrorDetails(lastError);
  console.error("GECA request exhausted retries:", safeUrl, detail);
  throw new Error(
    "GECA's result server is temporarily unreachable after " + GECA_RETRY_MAX_ATTEMPTS +
    " attempts. " + detail + ". Please retry in a few minutes; manual SGPA entry remains available.",
  );
}

async function fetchGecaText(url: string): Promise<string> {
  return fetchGecaResponse(
    url,
    "text/html,application/xhtml+xml",
    12000,
    response => response.text(),
  );
}

const RESULT_PDF_CACHE_TTL_MS = 10 * 60 * 1000;
const RESULT_PDF_CACHE_MAX_BYTES = 24 * 1024 * 1024;
const resultPdfCache = new Map<string, { bytes: Uint8Array; expiresAt: number }>();
const resultPdfDownloads = new Map<string, Promise<Uint8Array>>();

async function downloadResultPdf(url: string): Promise<Uint8Array> {
  const cached = resultPdfCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh insertion order for simple least-recently-used eviction.
    resultPdfCache.delete(url);
    resultPdfCache.set(url, cached);
    return cached.bytes;
  }
  if (cached) resultPdfCache.delete(url);
  const inFlight = resultPdfDownloads.get(url);
  if (inFlight) return inFlight;

  const download = fetchGecaResponse(
    url,
    "application/pdf,application/octet-stream,*/*",
    30000,
    async response => {
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_PDF_BYTES) throw new Error("pdf-too-large");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new Error("pdf-too-large-or-empty");
      return bytes;
    },
  );
  resultPdfDownloads.set(url, download);
  try {
    const bytes = await download;
    // Keep a bounded cache: repeat students avoid downloading the same PDFs,
    // while a busy archive cannot grow this process's memory without limit.
    let cachedBytes = Array.from(resultPdfCache.values()).reduce((total, item) => total + item.bytes.byteLength, 0);
    for (const [key, item] of resultPdfCache) {
      if (item.expiresAt <= Date.now() || cachedBytes + bytes.byteLength > RESULT_PDF_CACHE_MAX_BYTES) {
        resultPdfCache.delete(key);
        cachedBytes -= item.bytes.byteLength;
      }
    }
    if (bytes.byteLength <= RESULT_PDF_CACHE_MAX_BYTES) {
      while (cachedBytes + bytes.byteLength > RESULT_PDF_CACHE_MAX_BYTES && resultPdfCache.size) {
        const oldestKey = resultPdfCache.keys().next().value;
        if (!oldestKey) break;
        const oldest = resultPdfCache.get(oldestKey);
        resultPdfCache.delete(oldestKey);
        if (oldest) cachedBytes -= oldest.bytes.byteLength;
      }
      resultPdfCache.set(url, { bytes, expiresAt: Date.now() + RESULT_PDF_CACHE_TTL_MS });
    }
    return bytes;
  } finally {
    resultPdfDownloads.delete(url);
  }
}

export async function listGecaResultSessions(): Promise<GecaResultSession[]> {
  if (sessionCache && sessionCache.expiresAt > Date.now()) return sessionCache.sessions;
  let html: string;
  try {
    html = await fetchGecaText(RESULT_MASTER_URL);
  } catch (error) {
    // Preserve a cached/known session list if the archive index is unavailable.
    // The result detail page and PDF are still fetched live before grades are imported.
    if (sessionCache?.sessions.length) return sessionCache.sessions;
    if (KNOWN_GECA_RESULT_SESSIONS.length) {
      console.warn("GECA archive index unavailable; using the last-known official session list:", fetchErrorDetails(error));
      sessionCache = { expiresAt: Date.now() + 5 * 60 * 1000, sessions: KNOWN_GECA_RESULT_SESSIONS };
      return sessionCache.sessions;
    }
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
  if (!unique.length) {
    if (KNOWN_GECA_RESULT_SESSIONS.length) {
      console.warn("GECA archive markup contained no recognizable sessions; using the last-known official session list.");
      sessionCache = { expiresAt: Date.now() + 5 * 60 * 1000, sessions: KNOWN_GECA_RESULT_SESSIONS };
      return sessionCache.sessions;
    }
    throw new Error("No examination sessions were found on the GECA result archive.");
  }
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


const GRADE_TOKEN_PATTERN = /^(?:A\+\+|A\+|B\+|C\+|D[123]?|AB|A|B|C|F|P|-)$/i;

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
    const cleaned = token.replace(/^[^A-Z0-9+-]+|[^A-Z0-9+-]+$/g, "");
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
      // Consolidated NEP result PDFs can place the course code and its
      // multi-line subject title inside the SAME PDF.js text item, e.g.
      // "AMPCC2001\\nSolid Mechanics". An anchored whole-item match loses
      // every course column in that layout. Extract complete codes embedded
      // anywhere in the item before trying the adjacent-fragment fallback.
      const embeddedCodes = item.text.toUpperCase().match(/[A-Z]{2,6}\d{4}/g) || [];
      if (embeddedCodes.length) {
        for (const code of embeddedCodes) {
          if (!ENROLLMENT_PATTERN.test(code)) columns.push({ courseCode: code, x: item.x });
        }
        continue;
      }
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


/**
 * ESE NOV-DEC 2024 includes legacy CBCS PDFs laid out as repeated
 * subject-result rows (enrollment | course code/title | grade), not one
 * horizontal semester table. Parse only rows belonging to the exact student.
 */
export function extractESE2024VerticalGrades(
  lines: TextLine[],
  enrollment: string,
  subjectPrefixes: string[],
): { grades: GecaMatchedGrade[]; enrollmentFound: boolean } {
  const enrollmentLines = lines.filter(line => lineContainsEnrollment(line, enrollment));
  if (!enrollmentLines.length) return { grades: [], enrollmentFound: false };
  const grades = new Map<string, string>();
  const normalizedPrefixes = subjectPrefixes.map(prefix => prefix.toUpperCase());
  for (const enrollmentLine of enrollmentLines) {
    const rowY = enrollmentLine.items[0]?.y ?? 0;
    const rowLines = lines.filter(candidate =>
      Math.abs((candidate.items[0]?.y ?? rowY) - rowY) <= 8,
    );
    const items = rowLines.flatMap(candidate => candidate.items.map(item => ({
      ...item, y: candidate.items[0]?.y ?? rowY,
    }))).sort((a, b) => a.x - b.x || Math.abs(a.y - rowY) - Math.abs(b.y - rowY));
    const enrollmentItem = items.findIndex(item =>
      compactPdfText(item.text).includes(compactPdfText(enrollment)),
    );
    if (enrollmentItem < 0) continue;
    const afterEnrollment = items.slice(enrollmentItem + 1);
    for (let index = 0; index < afterEnrollment.length; index++) {
      const item = afterEnrollment[index];
      const codeMatch = item.text.toUpperCase().match(/[A-Z]{2,6}\\d{4}/);
      if (!codeMatch) continue;
      const courseCode = codeMatch[0];
      if (normalizedPrefixes.length && !normalizedPrefixes.some(prefix => courseCode.startsWith(prefix))) continue;
      const tail = item.text.slice((codeMatch.index ?? 0) + codeMatch[0].length);
      const sameItemGrades = gradeTokensFromItem({ ...item, text: tail });
      const followingGrades = afterEnrollment.slice(index + 1)
        .filter(next => next.x > item.x && Math.abs(next.y - rowY) <= 8)
        .flatMap(next => gradeTokensFromItem(next));
      const grade = [...sameItemGrades, ...followingGrades][0];
      if (grade) grades.set(courseCode, grade === "-" ? "" : grade);
    }
  }
  return {
    grades: Array.from(grades, ([courseCode, grade]) => ({ courseCode, grade })),
    enrollmentFound: true,
  };
}

export function extractMatchingGrades(lines: TextLine[], enrollment: string): { grades: GecaMatchedGrade[]; enrollmentFound: boolean } {
  const matches = new Map<string, string>();
  let enrollmentFound = false;

  for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
    const line = lines[rowIndex];
    if (!lineContainsEnrollment(line, enrollment)) continue;
    enrollmentFound = true;

    // GECA PDFs can contain multiple independent result tables on the same page.
    // Resolve the course headers for THIS enrollment row only, rather than
    // combining headers from the first/second tables into one global list.
    // Keep the search page-local, but cover the full preceding table region.
    // Some GECA NEP exports place a large multi-line subject header far above
    // the student's row; an 80-line window silently loses every course column.
    const tableStart = Math.max(0, rowIndex - 400);
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


/**
 * GECA's individual subject PDFs use a different table layout from the
 * consolidated semester sheets: REGNO | STUDNAME | CCODE | COURSENAME |
 * BRANCH | Grade. Read the branch and grade from their own columns so a
 * generic *_RESULT PDF is accepted only for the matching branch.
 */
export function extractSubjectResultGrades(
  lines: TextLine[],
  enrollment: string,
  branchTerms: string[],
): { grades: GecaMatchedGrade[]; enrollmentFound: boolean } {
  const normalized = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const labels = ["REGNO", "CCODE", "COURSENAME", "BRANCH", "GRADE"] as const;
  type Header = { y: number; labels: Map<string, number> };
  const headerRows: Header[] = [];

  // PDF.js may place the five column labels on slightly different baselines.
  // Build a local header cluster instead of requiring every label on one line.
  for (let index = 0; index < lines.length; index++) {
    const anchorY = lines[index].items[0]?.y ?? 0;
    const cluster = lines.filter(candidate =>
      Math.abs((candidate.items[0]?.y ?? anchorY) - anchorY) <= 16,
    );
    const positions = new Map<string, number>();
    for (const candidate of cluster) {
      for (const item of candidate.items) {
        const token = normalized(item.text);
        for (const label of labels) {
          if ((token === label || token.includes(label)) && !positions.has(label)) {
            positions.set(label, item.x);
          }
        }
      }
    }
    if (labels.every(label => positions.has(label))) {
      const key = labels.map(label => Math.round(positions.get(label)!)).join("|");
      if (!headerRows.some(header => labels.map(label => Math.round(header.labels.get(label)!)).join("|") === key)) {
        headerRows.push({ y: anchorY, labels: positions });
      }
    }
  }

  const enrollmentLines = lines
    .map(line => ({ line }))
    .filter(({ line }) => lineContainsEnrollment(line, enrollment));
  if (!enrollmentLines.length) return { grades: [], enrollmentFound: false };
  if (!headerRows.length) return { grades: [], enrollmentFound: true };

  const matches = new Map<string, string>();
  for (const { line } of enrollmentLines) {
    const rowY = line.items[0]?.y ?? 0;
    const header = [...headerRows].sort((a, b) =>
      Math.abs(rowY - a.y) - Math.abs(rowY - b.y),
    )[0];
    if (!header) continue;
    const regnoX = header.labels.get("REGNO")!;
    const codeX = header.labels.get("CCODE")!;
    const courseNameX = header.labels.get("COURSENAME")!;
    const branchX = header.labels.get("BRANCH")!;
    const gradeX = header.labels.get("GRADE")!;

    // Course/branch/grade values can be split over adjacent baselines. Keep
    // this window tightly anchored to the target enrollment row so we never
    // borrow another student's grade.
    const rowLines = lines.filter(candidate =>
      Math.abs((candidate.items[0]?.y ?? rowY) - rowY) <= 9,
    );
    const rowItems = rowLines.flatMap(candidate => candidate.items);
    const enrollmentItem = rowItems.find(item =>
      normalized(item.text).includes(normalized(enrollment)),
    );
    const startX = enrollmentItem?.x ?? regnoX;
    const localItems = rowItems.filter(item => item.x >= startX - 2 && item.x <= gradeX + 120);
    const branchText = localItems
      .filter(item => item.x >= Math.min(branchX, courseNameX) - 20 && item.x < gradeX + 2)
      .map(item => item.text)
      .join(" ")
      .toLowerCase();
    if (!branchTerms.some(term => branchText.includes(term.toLowerCase()))) continue;

    // Prefer a code near the CCODE column, but tolerate GECA's shifted and
    // split text items by checking the complete target-row text as fallback.
    const codeCandidates = localItems
      .filter(item => Math.abs(item.x - codeX) < 180)
      .map(item => normalized(item.text).match(/[A-Z]{2,6}\d{4}/)?.[0])
      .filter((value): value is string => Boolean(value));
    const courseCode = codeCandidates[0] ||
      localItems.map(item => normalized(item.text)).join("").match(/[A-Z]{2,6}\d{4}/)?.[0] || "";
    if (!courseCode) continue;

    const gradeCandidates = localItems
      .filter(item => item.x >= gradeX - 24)
      .flatMap(item => gradeTokensFromItem(item))
      .filter(token => token !== "AB" && token !== "P");
    // A grade is accepted only from the grade column; do not infer it from
    // names, branch labels, or unrelated tokens in the row.
    const grade = gradeCandidates[0];
    if (grade) matches.set(courseCode, grade === "-" ? "" : grade);
  }

  return {
    grades: Array.from(matches, ([courseCode, grade]) => ({ courseCode, grade })),
    enrollmentFound: true,
  };
}

/**
 * Some GECA consolidated NEP PDFs omit the semester in their text header.
 * In that case, infer the semester only from branch-specific core course-code
 * ranges that are fixed in the published GECA NEP curriculum. Mixed-semester
 * code sets deliberately return null (fail closed).
 */
export function inferGecaSemesterFromCourseCodes(branchCode: string, grades: GecaMatchedGrade[]): number | null {
  const semesters = new Set<number>();
  for (const grade of grades) {
    const code = grade.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (branchCode === "05" && /^CSPCC200[1-5]$/.test(code)) semesters.add(3);
    else if (branchCode === "05" && /^CSPCC20(?:0[6-9]|10)$/.test(code)) semesters.add(4);
    else if (branchCode === "05" && /^CSPCC300[1-4]$/.test(code)) semesters.add(5);
    else if (branchCode === "05" && /^CSPCC300[5-8]$/.test(code)) semesters.add(6);
    else if (branchCode === "06" && /^ITPCC200[1-7]$/.test(code)) semesters.add(3);
    else if (branchCode === "06" && /^ITPCC201[0-4]$/.test(code)) semesters.add(4);
    else if (branchCode === "06" && /^ITPCC301[0-3]$/.test(code)) semesters.add(6);
  }
  return semesters.size === 1 ? [...semesters][0] : null;
}

function romanSemester(text: string): number | null {
  const values: Record<string, number> = {
    I:1, FIRST:1, II:2, SECOND:2, III:3, THIRD:3, IV:4, FOURTH:4,
    V:5, FIFTH:5, VI:6, SIXTH:6, VII:7, SEVENTH:7, VIII:8, EIGHTH:8,
    IX:9, X:10, XI:11, XII:12,
  };
  const token = "(VIII|VII|VI|V|IV|III|II|I|[1-8]|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH)";
  const patterns = [
    new RegExp("\\b" + token + "(?:ST|ND|RD|TH)?\\s*(?:SEM(?:ESTER)?\\b|REG(?:ULAR)?\\b|BACK(?:LOG)?\\b|ATKT\\b|RE-?EXAM\\b)", "i"),
    new RegExp("\\bSEM(?:ESTER)?\\s*" + token + "(?:ST|ND|RD|TH)?\\b", "i"),
  ];
  const matches = patterns.map(pattern => pattern.exec(text)).filter(Boolean) as RegExpExecArray[];
  if (!matches.length) return null;
  matches.sort((a, b) => a.index - b.index);
  const match = matches[matches.length - 1];
  return values[match[1].toUpperCase()] ?? (Number(match[1]) || null);
}

// PDF.js documents retain worker/font caches until destroyed. Serialize parsing across
// requests (not just within one request) because the Render free instance has 512 MiB.
let pdfParserActive = false;
const pdfParserQueue: Array<() => void> = [];
async function withPdfParser<T>(operation: () => Promise<T>): Promise<T> {
  if (pdfParserActive) await new Promise<void>(resolve => pdfParserQueue.push(resolve));
  pdfParserActive = true;
  try {
    return await operation();
  } finally {
    const next = pdfParserQueue.shift();
    if (next) next();
    else pdfParserActive = false;
  }
}

async function readResultPdfUnlocked(url: string, title: string, enrollment: string, reExamTargetCourseCode?: string, academicSection?: GecaAcademicSection | null, sectionSemester?: number | null, sessionTitle = ""): Promise<{
  document: GecaMatchedDocument | null;
  enrollmentFound: boolean;
  error?: string;
}> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) return { document: null, enrollmentFound: false, error: "untrusted-url" };
  // GECA's result PDFs can be substantially slower than its HTML pages.
  // Download the complete body inside fetchGecaResponse so a timeout while
  // streaming bytes is retried just like a timeout while receiving headers.
  let bytes: Uint8Array;
  try {
    bytes = await downloadResultPdf(safeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("pdf-too-large")) return { document: null, enrollmentFound: false, error: message };
    throw error;
  }

  // GECA's embedded TrueType fonts can contain unsupported optional
  // instructions (for example "TT: undefined function: 21"). PDF.js still
  // extracts the text layer; suppress only its non-fatal warnings.
  // Load PDF.js only when a legacy server-side result scan is explicitly requested.
  // Keeping this heavyweight Node PDF runtime out of normal API startup reduces idle memory.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
    stopAtErrors: false,
  }).promise;
  const allLines: TextLine[] = [];
  let metadataText = "";
  let parsed = { grades: [] as GecaMatchedGrade[], enrollmentFound: false };
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    try {
    const content = await page.getTextContent();
    const rawItems = content.items.filter((raw: unknown): raw is { str: string; transform: number[] } =>
      Boolean(raw && typeof raw === "object" && "str" in raw && typeof (raw as { str?: unknown }).str === "string" &&
        (raw as { str: string }).str.trim() && "transform" in raw),
    );
    const rawPageText = rawItems.map(raw => raw.str).join(" ");
    if (pageNumber === 1) metadataText = rawPageText;
    // Most pages in a branch PDF belong to other students. Avoid expensive
    // coordinate grouping and table parsing unless this page contains the exact
    // enrollment token (whitespace/line breaks in PDF text are normalized away).
    if (!compactPdfText(rawPageText).includes(compactPdfText(enrollment))) continue;
    const positioned = rawItems.map(raw => ({
      text: raw.str.trim(), x: Number(raw.transform[4] || 0), y: Number(raw.transform[5] || 0),
    }));
    const lines = groupPdfLines(positioned);
    allLines.push(...lines);
    // Parse each page independently. PDF coordinates restart on every page;
    // combining pages lets a header at the same Y-coordinate on a previous
    // page get attached to this student's row and import unrelated subjects.
    const genericSubjectPdf = /_RESULT(?:\.PDF)?$/i.test(title.trim()) || url.toLowerCase().split("?")[0].endsWith("_result.pdf");
    const pageParsedBase = genericSubjectPdf && !reExamTargetCourseCode
      ? (() => {
          const programme = enrollment.slice(0, 2);
          const branchCode = enrollment.slice(5, 7);
          const branchTerms = branchTermsForEnrollment(programme, branchCode);
          const subjectPrefixes = subjectPrefixesForEnrollment(programme, branchCode);
          const subjectTable = extractSubjectResultGrades(lines, enrollment, branchTerms);
          if (subjectTable.grades.length) return subjectTable;

          // SOEK and other GECA exam sessions sometimes publish a *_RESULT.pdf
          // using the consolidated semester-sheet layout instead of the
          // REGNO/CCODE/COURSENAME/BRANCH/GRADE layout. Retry that parser only
          // after the subject-table parser fails, and retain only codes
          // belonging to this enrollment's programme and branch.
          const consolidated = extractMatchingGrades(lines, enrollment);
          const branchGrades = consolidated.grades.filter(grade => {
            const code = compactPdfText(grade.courseCode);
            return subjectPrefixes.some(prefix => code.startsWith(prefix.toUpperCase()));
          });
          return {
            grades: branchGrades,
            enrollmentFound: subjectTable.enrollmentFound || consolidated.enrollmentFound,
          };
        })()
      : reExamTargetCourseCode
        ? { grades: extractReExamSubject(lines, enrollment, reExamTargetCourseCode), enrollmentFound: lines.some(line => lineContainsEnrollment(line, enrollment)) }
        : extractMatchingGrades(lines, enrollment);
    const pageParsed = /ESE\\s+NOV[\\s-]*DEC[\\s-]*2024/i.test(sessionTitle) && !pageParsedBase.grades.length && !reExamTargetCourseCode
      ? (() => {
          const prefixes = subjectPrefixesForEnrollment(enrollment.slice(0, 2), enrollment.slice(5, 7));
          const legacyRows = extractESE2024VerticalGrades(lines, enrollment, prefixes);
          return { grades: legacyRows.grades, enrollmentFound: pageParsedBase.enrollmentFound || legacyRows.enrollmentFound };
        })()
      : pageParsedBase;
    if (pageParsed.enrollmentFound) parsed.enrollmentFound = true;
    if (pageParsed.grades.length) {
      parsed = { grades: pageParsed.grades, enrollmentFound: true };
      break;
    }
    } finally {
      try { page.cleanup(); } catch { /* release per-page text/font caches */ }
    }
  }
  // destroy() also terminates the PDF.js worker and releases document-level
  // caches; cleanup() alone leaves the worker alive between scanned PDFs.
  const destroy = (pdf as unknown as { destroy?: () => Promise<void> }).destroy;
  if (typeof destroy === "function") {
    try { await destroy.call(pdf); } catch { /* parsing result remains valid */ }
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
  // Subject-specific GECA links (for example CSESC1005_RESULT) omit the
  // semester from their filename. Inherit it from their enclosing page section.
  const semester = romanSemester(title + " " + metadataText) ?? sectionSemester ?? null;
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

async function readResultPdf(
  url: string,
  title: string,
  enrollment: string,
  reExamTargetCourseCode?: string,
  academicSection?: GecaAcademicSection | null,
  sectionSemester?: number | null,
  sessionTitle = "",
) {
  return withPdfParser(() =>
    readResultPdfUnlocked(url, title, enrollment, reExamTargetCourseCode, academicSection, sectionSemester, sessionTitle)
  );
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

// GECA postgraduate result archive labels and subject-code families.
const MTECH_BRANCH_NAMES: Record<string, string[]> = {
  "09": ["structural engineering"],
  "08": ["water resources engineering"],
  "16": ["geotechnical engineering"],
  "15": ["electrical machines and drives"],
  "12": ["electrical power systems"],
  "13": ["electronics and telecommunication", "entc"],
  "05": ["computer science", "cse"],
};
function branchTermsForEnrollment(programme: string, branchCode: string): string[] {
  if (programme === "MC") return ["master of computer applications", "computer applications", "mca"];
  if (programme === "MT") return MTECH_BRANCH_NAMES[branchCode] || [];
  return BRANCH_NAMES[branchCode] || [];
}
function subjectPrefixesForEnrollment(programme: string, branchCode: string): string[] {
  if (programme === "MC") return ["MC"];
  if (programme === "MT") return ["MT"];
  return BRANCH_SUBJECT_PREFIXES[branchCode] || [];
}

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

function academicSemesterBeforeLink(markup: string): number | null {
  const visibleText = plainText(markup
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " "));
  // GECA headings appear in both "First Year II SEM" and "First Year Semester 2" forms.
  const pattern = /\b(?:FIRST|1ST|SECOND|2ND|THIRD|3RD|FOURTH|4TH|FINAL)\s+YEAR\s+(VIII|VII|VI|V|IV|III|II|I|[1-8])\s*(?:ST|ND|RD|TH)?\s*(?:SEM|SEMESTER)\b/gi;
  const reversePattern = /\b(?:FIRST|1ST|SECOND|2ND|THIRD|3RD|FOURTH|4TH|FINAL)\s+YEAR\s+SEM(?:ESTER)?\s+(VIII|VII|VI|V|IV|III|II|I|[1-8])\b/gi;
  let semester: number | null = null;
  for (const match of visibleText.matchAll(pattern)) {
    semester = /^\d+$/.test(match[1]) ? Number(match[1]) : romanSemester(match[1]);
  }
  for (const match of visibleText.matchAll(reversePattern)) {
    semester = /^\d+$/.test(match[1]) ? Number(match[1]) : romanSemester(match[1]);
  }
  return semester;
}

export function academicSectionsForEnrollment(enrollment: string, sessionTitle: string, selectedSemester?: number): GecaAcademicSection[] {
  const sections = new Set<GecaAcademicSection>();
  const admissionYearMatch = enrollment.match(/^(?:BT|BE|MC|MT)(\d{2})/);
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

/**
 * GECA's year headings are useful for prioritising PDFs, but must never be a
 * hard exclusion: a portal markup change must not hide an exact enrollment
 * match in a first-year result PDF.
 */
export function selectGecaAcademicDocuments<T extends { academicSection: GecaAcademicSection | null }>(
  documents: T[],
  expectedSections: GecaAcademicSection[],
  pageHasAcademicSections: boolean,
): { documents: T[]; fallbackUsed: boolean } {
  if (!pageHasAcademicSections || !expectedSections.length) {
    return { documents, fallbackUsed: false };
  }
  // Keep unlabelled subject-level links in the candidate set. Their semester
  // is checked independently below; dropping them here can hide valid backlog
  // PDFs when GECA omits the academic-year label on individual links.
  const matching = documents.filter(document =>
    document.academicSection === null || expectedSections.includes(document.academicSection),
  );
  return matching.length
    ? { documents: matching, fallbackUsed: false }
    : { documents, fallbackUsed: true };
}

/**
 * Keep PDFs whose explicit semester matches the requested semester, plus
 * subject-level PDFs that carry no semester label. The page-section semester
 * is essential for GECA subject PDFs whose filenames contain only course codes.
 */
export function selectGecaSemesterDocuments<T extends { title: string; url: string; sectionSemester: number | null }>(
  documents: T[],
  selectedSemester?: number,
): T[] {
  if (!Number.isInteger(selectedSemester) || selectedSemester! < 1 || selectedSemester! > 12) {
    return documents;
  }
  return documents.filter(document => {
    const titleSemester = romanSemester(
      document.title + " " + document.url.replace(/%20/gi, " "),
    );
    // A semester printed in the PDF link title is stronger evidence than
    // the nearest preceding HTML heading, which can drift when GECA changes
    // its nested table markup. For consolidated NEP/CBCS REG/BACK branch PDFs
    // with no semester in the title, keep the PDF as a candidate even when the
    // page heading is stale; the PDF header or extracted course-code set must
    // independently validate the requested semester before grades are used.
    const semester = titleSemester ?? document.sectionSemester;
    const consolidatedUnlabelled = titleSemester === null &&
      /\b(?:NEP|CBCS)\b/i.test(document.title) &&
      /\b(?:REG(?:ULAR)?|BACK(?:LOG)?|ATKT|RE-?EXAM)\b/i.test(document.title);
    return semester === null || semester === selectedSemester || consolidatedUnlabelled;
  });
}

/** Keep only documents explicitly identified as belonging to the student's branch. */
export function selectGecaBranchDocuments<T extends { title: string; url: string }>(
  documents: T[],
  branchTerms: string[],
  subjectPrefixes: string[],
): T[] {
  if (!branchTerms.length && !subjectPrefixes.length) return [];
  return documents.filter(document => {
    const label = (document.title + " " + document.url).toLowerCase();
    const compactTitle = document.title.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const explicitlyNamedBranch = branchTerms.some(term => label.includes(term.toLowerCase())) ||
      subjectPrefixes.some(prefix => compactTitle.startsWith(prefix.toUpperCase()));
    // Individual subject PDFs do not include a branch in the link name.
    // They are admitted only as candidates; readResultPdf then requires an
    // exact enrollment row AND a matching BRANCH column before importing.
    const genericSubjectResult = /_RESULT(?:\.PDF)?$/i.test(document.title.trim()) ||
      document.url.toLowerCase().split("?")[0].endsWith("_result.pdf");
    const knownOtherBranchCode = Object.values(BRANCH_SUBJECT_PREFIXES).flat().some(prefix =>
      compactTitle.startsWith(prefix.toUpperCase()) &&
      !subjectPrefixes.some(selectedPrefix => compactTitle.startsWith(selectedPrefix.toUpperCase())),
    );
    return explicitlyNamedBranch || (genericSubjectResult && !knownOtherBranchCode);
  });
}

/** Only GECA resultID 3018 (ESE April–May 2026), Semester II, is manual-entry only. */
export function isRestrictedGecaResultFetch(session: Pick<GecaResultSession, "id">, selectedSemester?: number): boolean {
  return session.id === "3018" && selectedSemester === 2;
}


export async function discoverGecaEnrollmentCandidates(input: {
  resultId: string; programme: string; admissionYear: number; admissionMode: "F" | "S";
  branchCode: string; semester: number; limit?: number;
}): Promise<{ session: GecaResultSession; enrollments: string[]; documentsScanned: number; scanIncomplete: boolean; failedDocuments: string[] }> {
  const { resultId, programme, admissionYear, admissionMode, branchCode, semester } = input;
  const limit = Math.max(1, Math.min(60, Number(input.limit) || 60));
  if (!/^\d{1,10}$/.test(resultId)) throw new Error("Invalid GECA result session.");
  const postgraduate = programme === "MC" || programme === "MT";
  if (!/^(BE|BT|MC|MT)$/.test(programme) || !Number.isInteger(admissionYear) || admissionYear < 2000 || admissionYear > 2099 ||
      !/^[FS]$/.test(admissionMode) || (postgraduate && admissionMode !== "F") ||
      !branchTermsForEnrollment(programme, branchCode).length || !Number.isInteger(semester) || semester < 1 || semester > (postgraduate ? 4 : 8)) {
    throw new Error("Choose a supported programme, admission year, valid admission type, branch/specialization and semester.");
  }
  const sessions = await listGecaResultSessions();
  const session = sessions.find(item => item.id === resultId);
  if (!session) throw new Error("The selected examination session is no longer available on the GECA portal.");
  if (isRestrictedGecaResultFetch(session, semester)) {
    throw new Error("Enrollment discovery is unavailable for Semester II of ESE April–May 2026. Choose another semester.");
  }
  const html = await fetchGecaText(session.url);
  const docs: Array<{title:string;url:string;academicSection:GecaAcademicSection|null;sectionSemester:number|null}> = [];
  for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safeGecaUrl(anchor[1]);
    if (!url) continue;
    docs.push({ title: plainText(anchor[2]) || decodeURIComponent(url.split("/").pop() || "Result PDF"), url,
      academicSection: academicSectionBeforeLink(html.slice(0, anchor.index)), sectionSemester: academicSemesterBeforeLink(html.slice(0, anchor.index)) });
  }
  const unique = Array.from(new Map(docs.map(item=>[item.url,item])).values())
    .filter(item=>!NON_RESULT_PDF_PATTERN.test(item.title+" "+item.url));
  const branchTerms = branchTermsForEnrollment(programme, branchCode);
  const prefixes = subjectPrefixesForEnrollment(programme, branchCode);
  const branchDocs = selectGecaBranchDocuments(unique, branchTerms, prefixes);
  const semesterDocs = selectGecaSemesterDocuments(branchDocs, semester);
  const sessionYear = Number(session.title.match(/\b(20\d{2})\b/)?.[1] || 0);
  const academicYear = sessionYear - admissionYear + (admissionMode === "S" ? 1 : 0);
  const expectedSections = new Set<GecaAcademicSection>();
  const currentSection = (["", "FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FINAL_YEAR"] as const)[academicYear];
  const semesterSection = (["", "FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FINAL_YEAR"] as const)[Math.ceil(semester / 2)];
  if (currentSection) expectedSections.add(currentSection);
  if (semesterSection) expectedSections.add(semesterSection);
  const selectedDocs = expectedSections.size
    ? semesterDocs.filter(item=>item.academicSection===null || expectedSections.has(item.academicSection!))
    : semesterDocs;
  if (!selectedDocs.length) throw new Error("No official result PDFs match the selected branch and semester.");
  const pattern = new RegExp(programme+String(admissionYear).slice(-2)+admissionMode+branchCode+"F\\d{3}","g");
  const found = new Set<string>();
  const failedDocuments: string[] = [];
  let cursor = 0;
  const workers = Array.from({length:Math.min(1,selectedDocs.length)},async()=>{
    while(cursor<selectedDocs.length && found.size<limit) {
      const doc=selectedDocs[cursor++];
      try {
        const bytes=await downloadResultPdf(doc.url);
        const pdf=await getDocument({data:bytes.slice(),useSystemFonts:true,disableFontFace:true,verbosity:0,stopAtErrors:false}).promise;
        for(let pageNo=1;pageNo<=pdf.numPages && found.size<limit;pageNo++){
          const page=await pdf.getPage(pageNo);
          try {
          const content=await page.getTextContent();
          const positioned=content.items.flatMap((raw:unknown)=>{
            if(!raw||typeof raw!=="object"||!("str" in raw)||typeof raw.str!=="string"||!raw.str.trim()||!("transform" in raw)) return [];
            const transform=(raw as {transform:number[]}).transform;
            return [{text:(raw as {str:string}).str.trim(),x:Number(transform[4]||0),y:Number(transform[5]||0)}];
          });
          for(const line of groupPdfLines(positioned)){
            const compact=line.text.toUpperCase().replace(/[^A-Z0-9]/g,"");
            for(const match of compact.matchAll(pattern)){
              const enrollment=match[0];
              if(enrollment.length===11) found.add(enrollment);
              if(found.size>=limit) break;
            }
          }
          } finally { try { page.cleanup(); } catch { /* release per-page text/font caches */ } }
        }
        const cleanup=(pdf as unknown as {cleanup?:()=>Promise<void>}).cleanup;
        if(typeof cleanup==="function") try{await cleanup.call(pdf);}catch{/* ignore cleanup */}
      } catch(error) {
        failedDocuments.push(doc.title);
        console.warn("Unable to inspect GECA enrollment-list PDF:",doc.title,error);
      }
    }
  });
  await Promise.all(workers);
  return {session,enrollments:[...found].sort().slice(0,limit),documentsScanned:cursor,scanIncomplete:failedDocuments.length>0,failedDocuments};
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
  if (isRestrictedGecaResultFetch(session, selectedSemester)) {
    throw new Error("Online result fetching is unavailable only for Semester II of the ESE April–May 2026 examination session. Semester I and all other examination sessions remain available. Please enter Semester II grades manually.");
  }

  const html = await fetchGecaText(session.url);
  const documents: Array<{ title: string; url: string; academicSection: GecaAcademicSection | null; sectionSemester: number | null }> = [];
  for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safeGecaUrl(anchor[1]);
    if (!url) continue;
    documents.push({
      title: plainText(anchor[2]) || decodeURIComponent(url.split("/").pop() || "Result PDF"),
      url,
      academicSection: academicSectionBeforeLink(html.slice(0, anchor.index)),
      sectionSemester: academicSemesterBeforeLink(html.slice(0, anchor.index)),
    });
  }
  const unique = Array.from(new Map(documents.map(item => [item.url, item])).values())
    .filter(item => !NON_RESULT_PDF_PATTERN.test(item.title + " " + item.url));
  if (!unique.length) throw new Error("No examination result PDFs were linked to this GECA session after excluding general college documents.");

  const expectedAcademicSections = academicSectionsForEnrollment(enrollment, session.title, selectedSemester);
  const pageHasAcademicSections = unique.some(item => item.academicSection !== null);
  const sectionSelection = selectGecaAcademicDocuments(unique, expectedAcademicSections, pageHasAcademicSections);
  const eligibleDocuments = sectionSelection.documents.slice(0, MAX_RESULT_PDFS);
  let academicSectionFallbackUsed = sectionSelection.fallbackUsed;
  if (academicSectionFallbackUsed) {
    console.warn(
      "GECA academic-year headings did not match the enrollment; scanning official result PDFs without the section filter.",
      { expectedAcademicSections, selectedSemester, linkedResultPdfs: unique.length },
    );
  }

  // Apply the same branch + semester constraints to both the targeted scan
  // and any widening pass. Never widen to unrelated college/research PDFs.
  const branchCode = enrollment.slice(5, 7);
  const programmePrefix = enrollment.slice(0, 2);
  const branchTerms = branchTermsForEnrollment(programmePrefix, branchCode);
  const subjectPrefixes = subjectPrefixesForEnrollment(programmePrefix, branchCode);
  const filterBranchAndSemester = <T extends { title: string; url: string; sectionSemester: number | null }>(items: T[]): T[] => {
    const branchMatches = selectGecaBranchDocuments(items, branchTerms, subjectPrefixes);
    return selectGecaSemesterDocuments(branchMatches, selectedSemester);
  };
  const candidates = filterBranchAndSemester(eligibleDocuments);
  const fallbackCandidates = filterBranchAndSemester(unique);
  if (!candidates.length) {
    throw new Error(
      "No GECA result PDFs match the student's branch and selected semester. " +
      "The linked PDFs are explicitly labelled for different semesters.",
    );
  }

  const matches: GecaMatchedDocument[] = [];
  let enrollmentHits = 0;
  let parseFailures = 0;
  let downloadFailures = 0;
  const failedDocuments: string[] = [];
  const scannedUrls = new Set<string>();

  const scanDocuments = async (batch: Array<{ title: string; url: string; academicSection: GecaAcademicSection | null; sectionSemester: number | null }>) => {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(1, batch.length) }, async () => {
      while (cursor < batch.length) {
        const document = batch[cursor++];
        if (scannedUrls.has(document.url)) continue;
        scannedUrls.add(document.url);
        try {
          const parsed = await readResultPdf(document.url, document.title, enrollment, reExamTargetCourseCode, document.academicSection, document.sectionSemester, session.title);
          if (parsed.enrollmentFound) enrollmentHits++;
          if (parsed.document) {
            // The link/page label is only a discovery hint. The PDF's own
            // first-page header is authoritative for unlabelled archive links.
            // Never import a document whose extracted semester differs from
            // the semester the student selected.
            const inferredSemester = parsed.document.semester === null
              ? inferGecaSemesterFromCourseCodes(branchCode, parsed.document.grades) ?? document.sectionSemester
              : parsed.document.semester;
            const semesterMatches = selectedSemester == null
              ? parsed.document.semester == null
              : inferredSemester === selectedSemester;
            if (semesterMatches) {
              matches.push({ ...parsed.document, semester: inferredSemester });
            } else {
              parseFailures++;
              console.warn("GECA enrollment matched a PDF, but its semester could not be validated for the requested semester:", {
                title: document.title,
                requestedSemester: selectedSemester,
                detectedSemester: parsed.document.semester,
                inferredSemester,
                courseCodes: parsed.document.grades.map(row => row.courseCode),
              });
            }
          } else if (parsed.enrollmentFound) parseFailures++;
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

  // Academic-section labels may be wrong after portal markup changes, but
  // branch and semester identity are mandatory safety filters. Widen only
  // within the already validated branch + semester candidate set.
  // Keep a hard total scan budget so a large archive cannot hang the request.
  if (matches.length === 0 && downloadFailures === 0 && scannedUrls.size < MAX_RESULT_PDFS) {
    const remaining = fallbackCandidates
      .filter(item => !scannedUrls.has(item.url))
      .slice(0, MAX_RESULT_PDFS - scannedUrls.size);
    if (remaining.length) {
      academicSectionFallbackUsed = academicSectionFallbackUsed || remaining.some(item =>
        item.academicSection !== null && !expectedAcademicSections.includes(item.academicSection),
      );
      console.info("GECA targeted scan found no usable grades; widening to remaining official PDFs.", {
        selectedSemester,
        expectedAcademicSections,
        fallbackDocuments: remaining.length,
      });
      await scanDocuments(remaining);
    }
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
    academicSectionFallbackUsed,
    candidateDocuments: candidates.length,
    enrollmentHits,
    parseFailures,
    downloadFailures,
    scanIncomplete: downloadFailures > 0,
    failedDocuments,
    matches,
  };
}
