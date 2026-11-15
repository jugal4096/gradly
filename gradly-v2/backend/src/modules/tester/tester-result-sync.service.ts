import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const RESULT_MASTER_URL = "https://geca.ac.in/result-master.aspx";
const GECA_ORIGIN = "https://geca.ac.in";
const SESSION_CACHE_MS = 30 * 60 * 1000;
const MAX_RESULT_PDFS = 100;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ENROLLMENT_PATTERN = /\b(?:BT|BE|MC|MT)\d{2}[A-Z0-9]{7,9}\b/i;
const COURSE_CODE_PATTERN = /^[A-Z]{2,}[A-Z0-9]{2,}$/i;

export type GecaResultSession = { id: string; title: string; url: string };
export type GecaMatchedGrade = { courseCode: string; grade: string };
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
  const response = await fetch(safeUrl, { signal: AbortSignal.timeout(25000), headers: { "User-Agent": "Gradly-Result-Sync/1.0" } });
  if (!response.ok) throw new Error("GECA result portal returned HTTP " + response.status + ".");
  return response.text();
}

export async function listGecaResultSessions(): Promise<GecaResultSession[]> {
  if (sessionCache && sessionCache.expiresAt > Date.now()) return sessionCache.sessions;
  const html = await fetchGecaText(RESULT_MASTER_URL);
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
    const cleaned = token.replace(/^[^A-Z+]+|[^A-Z+]+$/g, "");
    return GRADE_TOKEN_PATTERN.test(cleaned) ? [cleaned] : [];
  });
}

type CourseColumn = { courseCode: string; x: number };

function findCourseColumns(lines: TextLine[]): CourseColumn[] {
  const candidates: CourseColumn[] = [];
  // GECA layouts vary: course codes may appear on several lines after the
  // seat-number heading, so inspect a wider header window and tolerate split
  // PDF text items without treating enrollment numbers as course codes.
  const headerIndexes = lines.map((line, index) => /(?:Exam\s*Seat|Seat\s*No)/i.test(line.text) ? index : -1).filter(index => index >= 0);
  for (const headerIndex of headerIndexes) {
    for (let offset = 1; offset <= 30 && headerIndex + offset < lines.length; offset++) {
      const line = lines[headerIndex + offset];
      for (let itemIndex = 0; itemIndex < line.items.length; itemIndex++) {
        const item = line.items[itemIndex];
        const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const single = clean(item.text);
        const next = line.items[itemIndex + 1];
        const combined = next ? single + clean(next.text) : "";
        const token = COURSE_CODE_PATTERN.test(single) ? single : combined;
        if (COURSE_CODE_PATTERN.test(token) && /[A-Z]/.test(token) && /\d/.test(token) && !ENROLLMENT_PATTERN.test(token)) {
          candidates.push({ courseCode: token, x: item.x });
          if (token === combined) itemIndex++;
        }
      }
      if (/\bGrade\b/i.test(line.text) && candidates.length) break;
      if (candidates.length >= 30) break;
    }
  }
  const unique = new Map<string, CourseColumn>();
  for (const column of candidates) if (!unique.has(column.courseCode)) unique.set(column.courseCode, column);
  return Array.from(unique.values()).sort((a, b) => a.x - b.x);
}

function gradesInEnrollmentRow(line: TextLine, enrollment: string, columns: CourseColumn[]): GecaMatchedGrade[] {
  if (!lineContainsEnrollment(line, enrollment) || !columns.length) return [];
  const mapped = new Map<string, string>();
  const gradeCells = line.items.flatMap(item => {
    const tokens = item.text.toUpperCase().trim().split(/[\\s|,;]+/).map(token => token.replace(/^[^A-Z+\\-]+|[^A-Z+\\-]+$/g, ""));
    return tokens.filter(token => GRADE_TOKEN_PATTERN.test(token)).map(grade => ({ grade, x: item.x }));
  });
  const sortedColumns = [...columns].sort((a, b) => a.x - b.x);
  const distinctGradeColumns = new Set(gradeCells.map(item => Math.round(item.x)));

  // First choice: map horizontally aligned grade cells to the closest course
  // header, but only when the PDF provides genuinely distinct x positions.
  if (gradeCells.length && distinctGradeColumns.size > 1) {
    for (const cell of gradeCells) {
      let nearest: CourseColumn | null = null;
      let distance = Number.POSITIVE_INFINITY;
      for (const column of sortedColumns) {
        const nextDistance = Math.abs(column.x - cell.x);
        if (nextDistance < distance) { nearest = column; distance = nextDistance; }
      }
      if (nearest && distance < 80 && !["-", "AB", "P"].includes(cell.grade)) mapped.set(nearest.courseCode, cell.grade);
    }
  }

  // Fallback for GECA PDFs where the whole result row (including all grades)
  // is emitted as one text item or where enrollment characters are split
  // across items. Only accept a complete positional sequence: one grade cell
  // per discovered course column. This avoids shifting grades onto wrong codes.
  if (!mapped.size) {
    const orderedText = line.items.map(item => item.text).join(" ");
    const compactEnrollment = compactPdfText(enrollment);
    const compactLine = compactPdfText(orderedText);
    const enrollmentAt = compactLine.indexOf(compactEnrollment);
    if (enrollmentAt >= 0) {
      const compactTail = compactLine.slice(enrollmentAt + compactEnrollment.length);
      const gradeSequence = compactTail.match(/A\\+\\+|A\\+|B\\+|C\\+|AB|[ABCDFP]|-/g) || [];
      if (gradeSequence.length === sortedColumns.length) {
        sortedColumns.forEach((column, index) => {
          const grade = gradeSequence[index];
          if (grade && !["-", "AB", "P"].includes(grade)) mapped.set(column.courseCode, grade);
        });
      }
    }
    // A single PDF text item may contain whitespace-separated grade tokens;
    // use that sequence only when its length exactly matches the header count.
    if (!mapped.size) {
      const enrollmentItemIndex = line.items.findIndex(item => compactPdfText(item.text).includes(compactEnrollment));
      const tailItems = enrollmentItemIndex >= 0 ? line.items.slice(enrollmentItemIndex) : line.items;
      const sequence = tailItems.flatMap(item => item.text.toUpperCase().split(/[\\s|,;]+/).map(token => token.replace(/^[^A-Z+\\-]+|[^A-Z+\\-]+$/g, "")).filter(token => GRADE_TOKEN_PATTERN.test(token)));
      const afterEnrollment = enrollmentItemIndex >= 0 ? sequence.slice(1) : sequence;
      if (afterEnrollment.length === sortedColumns.length) sortedColumns.forEach((column, index) => {
        const grade = afterEnrollment[index];
        if (grade && !["-", "AB", "P"].includes(grade)) mapped.set(column.courseCode, grade);
      });
    }
  }
  return Array.from(mapped, ([courseCode, grade]) => ({ courseCode, grade }));
}

function extractMatchingGrades(lines: TextLine[], enrollment: string): { grades: GecaMatchedGrade[]; enrollmentFound: boolean } {
  const columns = findCourseColumns(lines);
  const matches = new Map<string, string>();
  let enrollmentFound = false;

  for (const line of lines) {
    if (!lineContainsEnrollment(line, enrollment)) continue;
    enrollmentFound = true;
    for (const grade of gradesInEnrollmentRow(line, enrollment, columns)) {
      matches.set(grade.courseCode, grade.grade);
    }
  }

  return {
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

async function readResultPdf(url: string, title: string, enrollment: string): Promise<{
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
    parsed = extractMatchingGrades(allLines, enrollment);
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
  const schemeMatch = metadataText.match(/\b(NEP|CBCS(?:-NEW)?|NEW CBCS)\b/i);
  const programmeMatch = metadataText.match(/(?:Programme|Program)\s*:?\s*([A-Z][A-Z &-]{2,80})/i);
  const semester = romanSemester(title + " " + metadataText);
  const document = parsed.grades.length ? {
    title,
    url: safeUrl,
    programme: programmeMatch?.[1]?.trim() || null,
    scheme: schemeMatch?.[1]?.toUpperCase() || null,
    semester,
    grades: parsed.grades,
  } : null;
  return { document, enrollmentFound: parsed.enrollmentFound };
}

const BRANCH_NAMES: Record<string, string[]> = {
  "01": ["civil"], "02": ["mechanical"], "03": ["electrical"],
  "04": ["electronics", "entc"], "05": ["computer", "cse"],
  "06": ["information technology", "information tech"],
};

export async function findGecaEnrollmentResults(resultId: string, enrollmentNumber: string, selectedSemester?: number): Promise<{
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
          const parsed = await readResultPdf(document.url, document.title, enrollment);
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
