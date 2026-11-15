import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const RESULT_MASTER_URL = "https://geca.ac.in/result-master.aspx";
const GECA_ORIGIN = "https://geca.ac.in";
const SESSION_CACHE_MS = 5 * 60 * 1000;
const MAX_RESULT_PDFS = 100;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ENROLLMENT_PATTERN = /\b(?:BT|BE|MC|MT)\d{2}[A-Z0-9]{7,9}\b/i;
const COURSE_CODE_PATTERN = /^[A-Z]{2,}[A-Z0-9]{2,}$/i;
const GRADE_PATTERN = /^(?:A\+\+|A\+|A|B\+|B|C\+|C|D|F|P|AB|-)$/i;

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

function gradesAfterEnrollment(line: TextLine, enrollment: string): string[] {
  const full = line.text.toUpperCase();
  const at = full.indexOf(enrollment.toUpperCase());
  if (at < 0) return [];
  const tail = full.slice(at + enrollment.length);
  const values = tail.match(/A\+\+|A\+|B\+|C\+|[ABCDFP]|AB|-/g) || [];
  return values.filter(value => GRADE_PATTERN.test(value));
}

function extractMatchingGrades(lines: TextLine[], enrollment: string): GecaMatchedGrade[] {
  const matches = new Map<string, string>();
  let collectingCodes = false;
  let currentCodes: string[] = [];
  let pendingCodes: string[] = [];

  for (const line of lines) {
    if (/Exam\s*Seat\s*No/i.test(line.text)) {
      collectingCodes = true;
      currentCodes = [];
      pendingCodes = [];
      continue;
    }
    if (collectingCodes) {
      const found = line.items
        .map(item => item.text.toUpperCase().trim())
        .filter(token => COURSE_CODE_PATTERN.test(token) && !ENROLLMENT_PATTERN.test(token));
      pendingCodes.push(...found);
      if (/\bGrade\b/i.test(line.text) || pendingCodes.length >= 20) {
        currentCodes = Array.from(new Set(pendingCodes));
        collectingCodes = false;
      }
      continue;
    }

    if (!line.text.toUpperCase().includes(enrollment.toUpperCase()) || !currentCodes.length) continue;
    const grades = gradesAfterEnrollment(line, enrollment);
    currentCodes.forEach((courseCode, index) => {
      const grade = grades[index];
      if (grade && grade !== "-" && grade !== "AB" && grade !== "P") matches.set(courseCode, grade);
    });
  }
  return Array.from(matches, ([courseCode, grade]) => ({ courseCode, grade }));
}

function romanSemester(text: string): number | null {
  const match = text.match(/\b(I{1,3}|IV|V|VI|VII|VIII|IX|X|XI|XII)\s*SEM(?:ESTER)?\b/i);
  if (!match) return null;
  const values: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10, XI:11, XII:12 };
  return values[match[1].toUpperCase()] ?? null;
}

async function readResultPdf(url: string, title: string, enrollment: string): Promise<GecaMatchedDocument | null> {
  const safeUrl = safeGecaUrl(url);
  if (!safeUrl) return null;
  const response = await fetch(safeUrl, { signal: AbortSignal.timeout(35000), headers: { "User-Agent": "Gradly-Result-Sync/1.0" } });
  if (!response.ok) return null;
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_PDF_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) return null;

  const pdf = await getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true }).promise;
  const allLines: TextLine[] = [];
  let metadataText = "";
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
  }
  await pdf.destroy();

  const grades = extractMatchingGrades(allLines, enrollment);
  if (!grades.length) return null;
  const schemeMatch = metadataText.match(/\b(NEP|CBCS(?:-NEW)?|NEW CBCS)\b/i);
  const programmeMatch = metadataText.match(/(?:Programme|Program)\s*:?\s*([A-Z][A-Z &-]{2,80})/i);
  return {
    title,
    url: safeUrl,
    programme: programmeMatch?.[1]?.trim() || null,
    scheme: schemeMatch?.[1]?.toUpperCase() || null,
    semester: romanSemester(title + " " + metadataText),
    grades,
  };
}

export async function findGecaEnrollmentResults(resultId: string, enrollmentNumber: string): Promise<{
  session: GecaResultSession;
  documentsScanned: number;
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

  const matches: GecaMatchedDocument[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, unique.length) }, async () => {
    while (cursor < unique.length) {
      const index = cursor++;
      const document = unique[index];
      try {
        const match = await readResultPdf(document.url, document.title, enrollment);
        if (match) matches.push(match);
      } catch (error) {
        console.warn("Unable to inspect one GECA result PDF:", document.title, error);
      }
    }
  });
  await Promise.all(workers);
  return { session, documentsScanned: unique.length, matches };
}
