import { getDocument } from "pdfj/[\\s|,;]+/g-di/[\\s|,;]+/gt/legacy/build/pdf.mj/[\\s|,;]+/g"/[\\s|,;]+/g

con/[\\s|,;]+/gt RESULT_MASTER_URL = "http/[\\s|,;]+/g://geca.ac.in/re/[\\s|,;]+/gult-ma/[\\s|,;]+/gter.a/[\\s|,;]+/gpx"/[\\s|,;]+/g
con/[\\s|,;]+/gt GECA_ORIGIN = "http/[\\s|,;]+/g://geca.ac.in"/[\\s|,;]+/g
con/[\\s|,;]+/gt SESSION_CACHE_MS = 30 * 60 * 1000/[\\s|,;]+/g
con/[\\s|,;]+/gt MAX_RESULT_PDFS = 100/[\\s|,;]+/g
con/[\\s|,;]+/gt MAX_PDF_BYTES = 20 * 1024 * 1024/[\\s|,;]+/g
con/[\\s|,;]+/gt ENROLLMENT_PATTERN = //[\\s|,;]+/gb(?:BT/[\\s|,;]+/gBE/[\\s|,;]+/gMC/[\\s|,;]+/gMT)/[\\s|,;]+/gd{2}[A-Z0-9]{7/[\\s|,;]+/g9}/[\\s|,;]+/gb/i/[\\s|,;]+/g
con/[\\s|,;]+/gt COURSE_CODE_PATTERN = /^[A-Z]{2/[\\s|,;]+/g}[A-Z0-9]{2/[\\s|,;]+/g}$/i/[\\s|,;]+/g

export type GecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion = { id: /[\\s|,;]+/gtring/[\\s|,;]+/g title: /[\\s|,;]+/gtring/[\\s|,;]+/g url: /[\\s|,;]+/gtring }/[\\s|,;]+/g
export type GecaMatchedGrade = { cour/[\\s|,;]+/geCode: /[\\s|,;]+/gtring/[\\s|,;]+/g grade: /[\\s|,;]+/gtring }/[\\s|,;]+/g
export type GecaMatchedDocument = {
  title: /[\\s|,;]+/gtring/[\\s|,;]+/g
  url: /[\\s|,;]+/gtring/[\\s|,;]+/g
  programme: /[\\s|,;]+/gtring /[\\s|,;]+/g null/[\\s|,;]+/g
  /[\\s|,;]+/gcheme: /[\\s|,;]+/gtring /[\\s|,;]+/g null/[\\s|,;]+/g
  /[\\s|,;]+/geme/[\\s|,;]+/gter: number /[\\s|,;]+/g null/[\\s|,;]+/g
  grade/[\\s|,;]+/g: GecaMatchedGrade[]/[\\s|,;]+/g
}/[\\s|,;]+/g

let /[\\s|,;]+/ge/[\\s|,;]+/gionCache: { expire/[\\s|,;]+/gAt: number/[\\s|,;]+/g /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g: GecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion[] } /[\\s|,;]+/g null = null/[\\s|,;]+/g

function decodeHtml(value: /[\\s|,;]+/gtring): /[\\s|,;]+/gtring {
  return value
    .replace(/&nb/[\\s|,;]+/gp/[\\s|,;]+/g/gi/[\\s|,;]+/g " ")
    .replace(/&amp/[\\s|,;]+/g/gi/[\\s|,;]+/g "&")
    .replace(/&quot/[\\s|,;]+/g/gi/[\\s|,;]+/g '"')
    .replace(/&#39/[\\s|,;]+/g&apo/[\\s|,;]+/g/gi/[\\s|,;]+/g "'")
    .replace(/&lt/[\\s|,;]+/g/gi/[\\s|,;]+/g "<")
    .replace(/&gt/[\\s|,;]+/g/gi/[\\s|,;]+/g ">")
    .replace(/&#(/[\\s|,;]+/gd+)/[\\s|,;]+/g/g/[\\s|,;]+/g (_match/[\\s|,;]+/g code: /[\\s|,;]+/gtring) => String.fromCodePoint(Number(code)))/[\\s|,;]+/g
}

function plainText(value: /[\\s|,;]+/gtring): /[\\s|,;]+/gtring {
  return decodeHtml(value.replace(/<[^>]*>/g/[\\s|,;]+/g " ")).replace(//[\\s|,;]+/g+/g/[\\s|,;]+/g " ").trim()/[\\s|,;]+/g
}

function /[\\s|,;]+/gafeGecaUrl(href: /[\\s|,;]+/gtring): /[\\s|,;]+/gtring /[\\s|,;]+/g null {
  try {
    con/[\\s|,;]+/gt url = new URL(href/[\\s|,;]+/g GECA_ORIGIN)/[\\s|,;]+/g
    if (url.protocol !== "http/[\\s|,;]+/g:" /[\\s|,;]+/g url.ho/[\\s|,;]+/gtname !== "geca.ac.in" /[\\s|,;]+/g !url.pathname./[\\s|,;]+/gtart/[\\s|,;]+/gWith("/")) return null/[\\s|,;]+/g
    return url.toString()/[\\s|,;]+/g
  } catch {
    return null/[\\s|,;]+/g
  }
}

a/[\\s|,;]+/gync function fetchGecaText(url: /[\\s|,;]+/gtring): Promi/[\\s|,;]+/ge</[\\s|,;]+/gtring> {
  con/[\\s|,;]+/gt /[\\s|,;]+/gafeUrl = /[\\s|,;]+/gafeGecaUrl(url)/[\\s|,;]+/g
  if (!/[\\s|,;]+/gafeUrl) throw new Error("The GECA re/[\\s|,;]+/gult link i/[\\s|,;]+/g not a tru/[\\s|,;]+/gted college URL.")/[\\s|,;]+/g

  let la/[\\s|,;]+/gtError: unknown/[\\s|,;]+/g
  for (let attempt = 1/[\\s|,;]+/g attempt <= 2/[\\s|,;]+/g attempt += 1) {
    try {
      con/[\\s|,;]+/gt re/[\\s|,;]+/gpon/[\\s|,;]+/ge = await fetch(/[\\s|,;]+/gafeUrl/[\\s|,;]+/g {
        /[\\s|,;]+/gignal: AbortSignal.timeout(20000)/[\\s|,;]+/g
        header/[\\s|,;]+/g: { "U/[\\s|,;]+/ger-Agent": "Gradly-Re/[\\s|,;]+/gult-Sync/1.0"/[\\s|,;]+/g "Accept": "text/html/[\\s|,;]+/gapplication/xhtml+xml" }/[\\s|,;]+/g
      })/[\\s|,;]+/g
      if (!re/[\\s|,;]+/gpon/[\\s|,;]+/ge.ok) throw new Error("GECA re/[\\s|,;]+/gult portal returned HTTP " + re/[\\s|,;]+/gpon/[\\s|,;]+/ge./[\\s|,;]+/gtatu/[\\s|,;]+/g + ".")/[\\s|,;]+/g
      return await re/[\\s|,;]+/gpon/[\\s|,;]+/ge.text()/[\\s|,;]+/g
    } catch (error) {
      la/[\\s|,;]+/gtError = error/[\\s|,;]+/g
      if (attempt < 2) await new Promi/[\\s|,;]+/ge(re/[\\s|,;]+/golve => /[\\s|,;]+/getTimeout(re/[\\s|,;]+/golve/[\\s|,;]+/g 1200))/[\\s|,;]+/g
    }
  }

  con/[\\s|,;]+/gt detail = la/[\\s|,;]+/gtError in/[\\s|,;]+/gtanceof Error ? la/[\\s|,;]+/gtError.me/[\\s|,;]+/gage : "unknown network error"/[\\s|,;]+/g
  throw new Error("Unable to connect to the GECA re/[\\s|,;]+/gult portal after 2 attempt/[\\s|,;]+/g. Check that thi/[\\s|,;]+/g backend can reach http/[\\s|,;]+/g://geca.ac.in/[\\s|,;]+/g then retry. (" + detail + ")")/[\\s|,;]+/g
}

export a/[\\s|,;]+/gync function li/[\\s|,;]+/gtGecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion/[\\s|,;]+/g(): Promi/[\\s|,;]+/ge<GecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion[]> {
  if (/[\\s|,;]+/ge/[\\s|,;]+/gionCache && /[\\s|,;]+/ge/[\\s|,;]+/gionCache.expire/[\\s|,;]+/gAt > Date.now()) return /[\\s|,;]+/ge/[\\s|,;]+/gionCache./[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g
  let html: /[\\s|,;]+/gtring/[\\s|,;]+/g
  try {
    html = await fetchGecaText(RESULT_MASTER_URL)/[\\s|,;]+/g
  } catch (error) {
    // If GECA i/[\\s|,;]+/g temporarily unreachable/[\\s|,;]+/g pre/[\\s|,;]+/gerve the la/[\\s|,;]+/gt known archive li/[\\s|,;]+/gt
    // rather than making the re/[\\s|,;]+/gult-fetch feature completely unavailable.
    if (/[\\s|,;]+/ge/[\\s|,;]+/gionCache?./[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g.length) return /[\\s|,;]+/ge/[\\s|,;]+/gionCache./[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g
    throw error/[\\s|,;]+/g
  }
  con/[\\s|,;]+/gt /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g: GecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion[] = []/[\\s|,;]+/g
  for (con/[\\s|,;]+/gt row of html.matchAll(/<tr/[\\s|,;]+/gb[^>]*>([/[\\s|,;]+/gS]*?)</[\\s|,;]+/g/tr>/gi)) {
    con/[\\s|,;]+/gt cell/[\\s|,;]+/g = [...row[1].matchAll(/<td/[\\s|,;]+/gb[^>]*>([/[\\s|,;]+/gS]*?)</[\\s|,;]+/g/td>/gi)]/[\\s|,;]+/g
    if (cell/[\\s|,;]+/g.length < 2) continue/[\\s|,;]+/g
    con/[\\s|,;]+/gt anchor = cell/[\\s|,;]+/g[1][1].match(/<a/[\\s|,;]+/gb[^>]*href=["']([^"']*re/[\\s|,;]+/gult/[\\s|,;]+/g.a/[\\s|,;]+/gpx/[\\s|,;]+/g?re/[\\s|,;]+/gultID=/[\\s|,;]+/gd+[^"']*)["'][^>]*>/i)/[\\s|,;]+/g
    if (!anchor) continue/[\\s|,;]+/g
    con/[\\s|,;]+/gt url = /[\\s|,;]+/gafeGecaUrl(anchor[1])/[\\s|,;]+/g
    con/[\\s|,;]+/gt id = anchor[1].match(/[?&]re/[\\s|,;]+/gultID=(/[\\s|,;]+/gd+)/i)?.[1]/[\\s|,;]+/g
    con/[\\s|,;]+/gt title = plainText(cell/[\\s|,;]+/g[0][1])/[\\s|,;]+/g
    if (url && id && title) /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g.pu/[\\s|,;]+/gh({ id/[\\s|,;]+/g title/[\\s|,;]+/g url })/[\\s|,;]+/g
  }
  con/[\\s|,;]+/gt unique = Array.from(new Map(/[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g.map(item => [item.id/[\\s|,;]+/g item])).value/[\\s|,;]+/g())/[\\s|,;]+/g
  if (!unique.length) throw new Error("No examination /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g were found on the GECA re/[\\s|,;]+/gult archive.")/[\\s|,;]+/g
  /[\\s|,;]+/ge/[\\s|,;]+/gionCache = { expire/[\\s|,;]+/gAt: Date.now() + SESSION_CACHE_MS/[\\s|,;]+/g /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g: unique }/[\\s|,;]+/g
  return unique/[\\s|,;]+/g
}

type Po/[\\s|,;]+/gitionedItem = { text: /[\\s|,;]+/gtring/[\\s|,;]+/g x: number/[\\s|,;]+/g y: number }/[\\s|,;]+/g
type TextLine = { text: /[\\s|,;]+/gtring/[\\s|,;]+/g item/[\\s|,;]+/g: Po/[\\s|,;]+/gitionedItem[] }/[\\s|,;]+/g

function groupPdfLine/[\\s|,;]+/g(item/[\\s|,;]+/g: Po/[\\s|,;]+/gitionedItem[]): TextLine[] {
  con/[\\s|,;]+/gt /[\\s|,;]+/gorted = [...item/[\\s|,;]+/g]./[\\s|,;]+/gort((a/[\\s|,;]+/g b) => b.y - a.y /[\\s|,;]+/g a.x - b.x)/[\\s|,;]+/g
  con/[\\s|,;]+/gt line/[\\s|,;]+/g: TextLine[] = []/[\\s|,;]+/g
  for (con/[\\s|,;]+/gt item of /[\\s|,;]+/gorted) {
    let line = line/[\\s|,;]+/g.find(candidate => Math.ab/[\\s|,;]+/g(candidate.item/[\\s|,;]+/g[0].y - item.y) <= 2.2)/[\\s|,;]+/g
    if (!line) {
      line = { text: ""/[\\s|,;]+/g item/[\\s|,;]+/g: [] }/[\\s|,;]+/g
      line/[\\s|,;]+/g.pu/[\\s|,;]+/gh(line)/[\\s|,;]+/g
    }
    line.item/[\\s|,;]+/g.pu/[\\s|,;]+/gh(item)/[\\s|,;]+/g
  }
  for (con/[\\s|,;]+/gt line of line/[\\s|,;]+/g) {
    line.item/[\\s|,;]+/g./[\\s|,;]+/gort((a/[\\s|,;]+/g b) => a.x - b.x)/[\\s|,;]+/g
    line.text = line.item/[\\s|,;]+/g.map(item => item.text).join(" ").replace(//[\\s|,;]+/g+/g/[\\s|,;]+/g " ").trim()/[\\s|,;]+/g
  }
  return line/[\\s|,;]+/g
}


con/[\\s|,;]+/gt GRADE_TOKEN_PATTERN = /^(?:A/[\\s|,;]+/g+/[\\s|,;]+/g+/[\\s|,;]+/gA/[\\s|,;]+/g+/[\\s|,;]+/gB/[\\s|,;]+/g+/[\\s|,;]+/gC/[\\s|,;]+/g+/[\\s|,;]+/gAB/[\\s|,;]+/gA/[\\s|,;]+/gB/[\\s|,;]+/gC/[\\s|,;]+/gD/[\\s|,;]+/gF/[\\s|,;]+/gP/[\\s|,;]+/g-)$/i/[\\s|,;]+/g

function compactPdfText(value: /[\\s|,;]+/gtring): /[\\s|,;]+/gtring {
  return value.toUpperCa/[\\s|,;]+/ge().replace(/[^A-Z0-9]/g/[\\s|,;]+/g "")/[\\s|,;]+/g
}

function enrollmentEndInLine(line: TextLine/[\\s|,;]+/g enrollment: /[\\s|,;]+/gtring): number {
  con/[\\s|,;]+/gt joined = line.item/[\\s|,;]+/g.map(item => item.text).join(" ")/[\\s|,;]+/g
  con/[\\s|,;]+/gt flexiblePattern = new RegExp(enrollment.toUpperCa/[\\s|,;]+/ge()./[\\s|,;]+/gplit("").join("[^A-Z0-9]*")/[\\s|,;]+/g "i")/[\\s|,;]+/g
  con/[\\s|,;]+/gt match = flexiblePattern.exec(joined)/[\\s|,;]+/g
  return match ? match.index + match[0].length : -1/[\\s|,;]+/g
}

function lineContain/[\\s|,;]+/gEnrollment(line: TextLine/[\\s|,;]+/g enrollment: /[\\s|,;]+/gtring): boolean {
  con/[\\s|,;]+/gt joined = line.item/[\\s|,;]+/g.map(item => item.text).join(" ")/[\\s|,;]+/g
  // PDF text layer/[\\s|,;]+/g /[\\s|,;]+/gometime/[\\s|,;]+/g in/[\\s|,;]+/gert punctuation or unu/[\\s|,;]+/gual /[\\s|,;]+/gpacing between
  // enrollment character/[\\s|,;]+/g. Compare a compact form a/[\\s|,;]+/g a /[\\s|,;]+/gecond reliable path.
  return enrollmentEndInLine(line/[\\s|,;]+/g enrollment) >= 0 /[\\s|,;]+/g
    compactPdfText(joined).include/[\\s|,;]+/g(compactPdfText(enrollment))/[\\s|,;]+/g
}

function gradeToken/[\\s|,;]+/gFromItem(item: Po/[\\s|,;]+/gitionedItem): /[\\s|,;]+/gtring[] {
  return item.text.toUpperCa/[\\s|,;]+/ge().trim()./[\\s|,;]+/gplit(//[\\s|,;]+/g+/).flatMap(token => {
    con/[\\s|,;]+/gt cleaned = token.replace(/^[^A-Z+]+/[\\s|,;]+/g[^A-Z+]+$/g/[\\s|,;]+/g "")/[\\s|,;]+/g
    return GRADE_TOKEN_PATTERN.te/[\\s|,;]+/gt(cleaned) ? [cleaned] : []/[\\s|,;]+/g
  })/[\\s|,;]+/g
}

type Cour/[\\s|,;]+/geColumn = { cour/[\\s|,;]+/geCode: /[\\s|,;]+/gtring/[\\s|,;]+/g x: number }/[\\s|,;]+/g

function findCour/[\\s|,;]+/geColumn/[\\s|,;]+/g(line/[\\s|,;]+/g: TextLine[]): Cour/[\\s|,;]+/geColumn[] {
  // Par/[\\s|,;]+/ge header/[\\s|,;]+/g from the bounded table window /[\\s|,;]+/gupplied by the enrollment-row
  // caller. Never accumulate cour/[\\s|,;]+/ge code/[\\s|,;]+/g acro/[\\s|,;]+/g unrelated header window/[\\s|,;]+/g.
  // PDF text extraction can /[\\s|,;]+/gplit a code acro/[\\s|,;]+/g adjacent item/[\\s|,;]+/g /[\\s|,;]+/go normalize
  // and join at mo/[\\s|,;]+/gt two neighboring item/[\\s|,;]+/g.
  con/[\\s|,;]+/gt row/[\\s|,;]+/g: Array<{ y: number/[\\s|,;]+/g column/[\\s|,;]+/g: Cour/[\\s|,;]+/geColumn[] }> = []/[\\s|,;]+/g
  for (con/[\\s|,;]+/gt line of line/[\\s|,;]+/g) {
    con/[\\s|,;]+/gt column/[\\s|,;]+/g: Cour/[\\s|,;]+/geColumn[] = []/[\\s|,;]+/g
    for (let itemIndex = 0/[\\s|,;]+/g itemIndex < line.item/[\\s|,;]+/g.length/[\\s|,;]+/g itemIndex++) {
      con/[\\s|,;]+/gt item = line.item/[\\s|,;]+/g[itemIndex]/[\\s|,;]+/g
      con/[\\s|,;]+/gt clean = (value: /[\\s|,;]+/gtring) => value.toUpperCa/[\\s|,;]+/ge().replace(/[^A-Z0-9]/g/[\\s|,;]+/g "")/[\\s|,;]+/g
      con/[\\s|,;]+/gt /[\\s|,;]+/gingle = clean(item.text)/[\\s|,;]+/g
      con/[\\s|,;]+/gt next = line.item/[\\s|,;]+/g[itemIndex + 1]/[\\s|,;]+/g
      con/[\\s|,;]+/gt combined = next ? /[\\s|,;]+/gingle + clean(next.text) : ""/[\\s|,;]+/g
      con/[\\s|,;]+/gt token = COURSE_CODE_PATTERN.te/[\\s|,;]+/gt(/[\\s|,;]+/gingle) ? /[\\s|,;]+/gingle : combined/[\\s|,;]+/g
      if (COURSE_CODE_PATTERN.te/[\\s|,;]+/gt(token) && /[A-Z]/.te/[\\s|,;]+/gt(token) && //[\\s|,;]+/gd/.te/[\\s|,;]+/gt(token) && !ENROLLMENT_PATTERN.te/[\\s|,;]+/gt(token)) {
        column/[\\s|,;]+/g.pu/[\\s|,;]+/gh({ cour/[\\s|,;]+/geCode: token/[\\s|,;]+/g x: item.x })/[\\s|,;]+/g
        if (token === combined) itemIndex++/[\\s|,;]+/g
      }
    }
    if (column/[\\s|,;]+/g.length) row/[\\s|,;]+/g.pu/[\\s|,;]+/gh({ y: line.item/[\\s|,;]+/g[0]?.y ?? 0/[\\s|,;]+/g column/[\\s|,;]+/g })/[\\s|,;]+/g
  }

  // Cour/[\\s|,;]+/ge-code header/[\\s|,;]+/g are normally emitted on one horizontal row. Select the
  // /[\\s|,;]+/gtronge/[\\s|,;]+/gt horizontal code row rather than mixing code/[\\s|,;]+/g from neighboring
  // table/[\\s|,;]+/g exam metadata/[\\s|,;]+/g or unrelated text line/[\\s|,;]+/g.
  con/[\\s|,;]+/gt ranked = row/[\\s|,;]+/g
    .map(row => ({ ...row/[\\s|,;]+/g column/[\\s|,;]+/g: Array.from(new Map(row.column/[\\s|,;]+/g.map(column => [column.cour/[\\s|,;]+/geCode/[\\s|,;]+/g column])).value/[\\s|,;]+/g()) }))
    ./[\\s|,;]+/gort((a/[\\s|,;]+/g b) => b.column/[\\s|,;]+/g.length - a.column/[\\s|,;]+/g.length /[\\s|,;]+/g b.y - a.y)/[\\s|,;]+/g
  con/[\\s|,;]+/gt be/[\\s|,;]+/gt = ranked[0]/[\\s|,;]+/g
  // Single-cour/[\\s|,;]+/ge re/[\\s|,;]+/gult table/[\\s|,;]+/g are valid in GECA re-examination PDF/[\\s|,;]+/g.
  // Still fail clo/[\\s|,;]+/ged if no valid cour/[\\s|,;]+/ge-code header wa/[\\s|,;]+/g identified.
  if (!be/[\\s|,;]+/gt /[\\s|,;]+/g be/[\\s|,;]+/gt.column/[\\s|,;]+/g.length < 1) return []/[\\s|,;]+/g
  return be/[\\s|,;]+/gt.column/[\\s|,;]+/g./[\\s|,;]+/gort((a/[\\s|,;]+/g b) => a.x - b.x)/[\\s|,;]+/g
}

function grade/[\\s|,;]+/gInEnrollmentRow(line: TextLine/[\\s|,;]+/g enrollment: /[\\s|,;]+/gtring/[\\s|,;]+/g column/[\\s|,;]+/g: Cour/[\\s|,;]+/geColumn[]/[\\s|,;]+/g nearbyLine/[\\s|,;]+/g: TextLine[] = [line]): GecaMatchedGrade[] {
  if (!lineContain/[\\s|,;]+/gEnrollment(line/[\\s|,;]+/g enrollment) /[\\s|,;]+/g !column/[\\s|,;]+/g.length) return []/[\\s|,;]+/g
  con/[\\s|,;]+/gt mapped = new Map</[\\s|,;]+/gtring/[\\s|,;]+/g /[\\s|,;]+/gtring>()/[\\s|,;]+/g
  // GECA PDF/[\\s|,;]+/g can place grade token/[\\s|,;]+/g on adjacent ba/[\\s|,;]+/geline/[\\s|,;]+/g to the enrollment row.
  // Collect within a narrow vertical band and retain x coordinate/[\\s|,;]+/g for mapping.
  con/[\\s|,;]+/gt anchorY = line.item/[\\s|,;]+/g[0]?.y ?? 0/[\\s|,;]+/g
  con/[\\s|,;]+/gt gradeCell/[\\s|,;]+/g = nearbyLine/[\\s|,;]+/g.flatMap(candidate => candidate.item/[\\s|,;]+/g.flatMap(item => {
    con/[\\s|,;]+/gt token/[\\s|,;]+/g = item.text.toUpperCa/[\\s|,;]+/ge().trim()./[\\s|,;]+/gplit(/[/[\\s|,;]+/g]+/).map(token => token.replace(/^[^A-Z+-]+/[\\s|,;]+/g[^A-Z+-]+$/g/[\\s|,;]+/g ""))/[\\s|,;]+/g
    return token/[\\s|,;]+/g.filter(token => GRADE_TOKEN_PATTERN.te/[\\s|,;]+/gt(token)).map(grade => ({ grade/[\\s|,;]+/g x: item.x/[\\s|,;]+/g y: item.y }))/[\\s|,;]+/g
  })).filter(cell => Math.ab/[\\s|,;]+/g(cell.y - anchorY) <= 14)/[\\s|,;]+/g
  con/[\\s|,;]+/gt /[\\s|,;]+/gortedColumn/[\\s|,;]+/g = [...column/[\\s|,;]+/g]./[\\s|,;]+/gort((a/[\\s|,;]+/g b) => a.x - b.x)/[\\s|,;]+/g
  con/[\\s|,;]+/gt di/[\\s|,;]+/gtinctGradeColumn/[\\s|,;]+/g = new Set(gradeCell/[\\s|,;]+/g.map(item => Math.round(item.x)))/[\\s|,;]+/g

  // Fir/[\\s|,;]+/gt choice: map horizontally aligned grade cell/[\\s|,;]+/g to the clo/[\\s|,;]+/ge/[\\s|,;]+/gt cour/[\\s|,;]+/ge
  // header/[\\s|,;]+/g but only when the PDF provide/[\\s|,;]+/g genuinely di/[\\s|,;]+/gtinct x po/[\\s|,;]+/gition/[\\s|,;]+/g.
  if (gradeCell/[\\s|,;]+/g.length && di/[\\s|,;]+/gtinctGradeColumn/[\\s|,;]+/g./[\\s|,;]+/gize > 1) {
    for (con/[\\s|,;]+/gt cell of gradeCell/[\\s|,;]+/g) {
      let neare/[\\s|,;]+/gt: Cour/[\\s|,;]+/geColumn /[\\s|,;]+/g null = null/[\\s|,;]+/g
      let di/[\\s|,;]+/gtance = Number.POSITIVE_INFINITY/[\\s|,;]+/g
      for (con/[\\s|,;]+/gt column of /[\\s|,;]+/gortedColumn/[\\s|,;]+/g) {
        con/[\\s|,;]+/gt nextDi/[\\s|,;]+/gtance = Math.ab/[\\s|,;]+/g(column.x - cell.x)/[\\s|,;]+/g
        if (nextDi/[\\s|,;]+/gtance < di/[\\s|,;]+/gtance) { neare/[\\s|,;]+/gt = column/[\\s|,;]+/g di/[\\s|,;]+/gtance = nextDi/[\\s|,;]+/gtance/[\\s|,;]+/g }
      }
      if (neare/[\\s|,;]+/gt && di/[\\s|,;]+/gtance < 80 && !["-"/[\\s|,;]+/g "AB"/[\\s|,;]+/g "P"].include/[\\s|,;]+/g(cell.grade)) mapped./[\\s|,;]+/get(neare/[\\s|,;]+/gt.cour/[\\s|,;]+/geCode/[\\s|,;]+/g cell.grade)/[\\s|,;]+/g
    }
  }

  // Fallback for GECA PDF/[\\s|,;]+/g where the whole re/[\\s|,;]+/gult row (including all grade/[\\s|,;]+/g)
  // i/[\\s|,;]+/g emitted a/[\\s|,;]+/g one text item or where enrollment character/[\\s|,;]+/g are /[\\s|,;]+/gplit
  // acro/[\\s|,;]+/g item/[\\s|,;]+/g. Only accept a complete po/[\\s|,;]+/gitional /[\\s|,;]+/gequence: one grade cell
  // per di/[\\s|,;]+/gcovered cour/[\\s|,;]+/ge column. Thi/[\\s|,;]+/g avoid/[\\s|,;]+/g /[\\s|,;]+/ghifting grade/[\\s|,;]+/g onto wrong code/[\\s|,;]+/g.
  if (!mapped./[\\s|,;]+/gize) {
    con/[\\s|,;]+/gt orderedText = line.item/[\\s|,;]+/g.map(item => item.text).join(" ")/[\\s|,;]+/g
    con/[\\s|,;]+/gt compactEnrollment = compactPdfText(enrollment)/[\\s|,;]+/g
    con/[\\s|,;]+/gt compactLine = compactPdfText(orderedText)/[\\s|,;]+/g
    con/[\\s|,;]+/gt enrollmentAt = compactLine.indexOf(compactEnrollment)/[\\s|,;]+/g
    if (enrollmentAt >= 0) {
      con/[\\s|,;]+/gt compactTail = compactLine./[\\s|,;]+/glice(enrollmentAt + compactEnrollment.length)/[\\s|,;]+/g
      con/[\\s|,;]+/gt gradeSequence = compactTail.match(/A/[\\s|,;]+/g+/[\\s|,;]+/g+/[\\s|,;]+/gA/[\\s|,;]+/g+/[\\s|,;]+/gB/[\\s|,;]+/g+/[\\s|,;]+/gC/[\\s|,;]+/g+/[\\s|,;]+/gAB/[\\s|,;]+/g[ABCDFP]/[\\s|,;]+/g-/g) /[\\s|,;]+/g []/[\\s|,;]+/g
      if (gradeSequence.length === /[\\s|,;]+/gortedColumn/[\\s|,;]+/g.length) {
        /[\\s|,;]+/gortedColumn/[\\s|,;]+/g.forEach((column/[\\s|,;]+/g index) => {
          con/[\\s|,;]+/gt grade = gradeSequence[index]/[\\s|,;]+/g
          if (grade && !["-"/[\\s|,;]+/g "AB"/[\\s|,;]+/g "P"].include/[\\s|,;]+/g(grade)) mapped./[\\s|,;]+/get(column.cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade)/[\\s|,;]+/g
        })/[\\s|,;]+/g
      }
    }
    // A /[\\s|,;]+/gingle PDF text item may contain white/[\\s|,;]+/gpace-/[\\s|,;]+/geparated grade token/[\\s|,;]+/g
    // u/[\\s|,;]+/ge that /[\\s|,;]+/gequence only when it/[\\s|,;]+/g length exactly matche/[\\s|,;]+/g the header count.
    if (!mapped./[\\s|,;]+/gize) {
      con/[\\s|,;]+/gt enrollmentItemIndex = line.item/[\\s|,;]+/g.findIndex(item => compactPdfText(item.text).include/[\\s|,;]+/g(compactEnrollment))/[\\s|,;]+/g
      con/[\\s|,;]+/gt tailItem/[\\s|,;]+/g = enrollmentItemIndex >= 0 ? line.item/[\\s|,;]+/g./[\\s|,;]+/glice(enrollmentItemIndex) : line.item/[\\s|,;]+/g
      con/[\\s|,;]+/gt /[\\s|,;]+/gequence = tailItem/[\\s|,;]+/g.flatMap(item => item.text.toUpperCa/[\\s|,;]+/ge()./[\\s|,;]+/gplit(/[/[\\s|,;]+/g]+/).map(token => token.replace(/^[^A-Z+-]+/[\\s|,;]+/g[^A-Z+-]+$/g/[\\s|,;]+/g "")).filter(token => GRADE_TOKEN_PATTERN.te/[\\s|,;]+/gt(token)))/[\\s|,;]+/g
      con/[\\s|,;]+/gt afterEnrollment = enrollmentItemIndex >= 0 ? /[\\s|,;]+/gequence./[\\s|,;]+/glice(1) : /[\\s|,;]+/gequence/[\\s|,;]+/g
      if (afterEnrollment.length === /[\\s|,;]+/gortedColumn/[\\s|,;]+/g.length) /[\\s|,;]+/gortedColumn/[\\s|,;]+/g.forEach((column/[\\s|,;]+/g index) => {
        con/[\\s|,;]+/gt grade = afterEnrollment[index]/[\\s|,;]+/g
        if (grade && !["-"/[\\s|,;]+/g "AB"/[\\s|,;]+/g "P"].include/[\\s|,;]+/g(grade)) mapped./[\\s|,;]+/get(column.cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade)/[\\s|,;]+/g
      })/[\\s|,;]+/g
    }
  }
  return Array.from(mapped/[\\s|,;]+/g ([cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade]) => ({ cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade }))/[\\s|,;]+/g
}

function extractMatchingGrade/[\\s|,;]+/g(line/[\\s|,;]+/g: TextLine[]/[\\s|,;]+/g enrollment: /[\\s|,;]+/gtring): { grade/[\\s|,;]+/g: GecaMatchedGrade[]/[\\s|,;]+/g enrollmentFound: boolean } {
  con/[\\s|,;]+/gt matche/[\\s|,;]+/g = new Map</[\\s|,;]+/gtring/[\\s|,;]+/g /[\\s|,;]+/gtring>()/[\\s|,;]+/g
  let enrollmentFound = fal/[\\s|,;]+/ge/[\\s|,;]+/g

  for (let rowIndex = 0/[\\s|,;]+/g rowIndex < line/[\\s|,;]+/g.length/[\\s|,;]+/g rowIndex++) {
    con/[\\s|,;]+/gt line = line/[\\s|,;]+/g[rowIndex]/[\\s|,;]+/g
    if (!lineContain/[\\s|,;]+/gEnrollment(line/[\\s|,;]+/g enrollment)) continue/[\\s|,;]+/g
    enrollmentFound = true/[\\s|,;]+/g

    // GECA PDF/[\\s|,;]+/g can contain multiple independent re/[\\s|,;]+/gult table/[\\s|,;]+/g on the /[\\s|,;]+/game page.
    // Re/[\\s|,;]+/golve the cour/[\\s|,;]+/ge header/[\\s|,;]+/g for THIS enrollment row only/[\\s|,;]+/g rather than
    // combining header/[\\s|,;]+/g from the fir/[\\s|,;]+/gt//[\\s|,;]+/gecond table/[\\s|,;]+/g into one global li/[\\s|,;]+/gt.
    con/[\\s|,;]+/gt previou/[\\s|,;]+/gEnrollmentIndex = line/[\\s|,;]+/g./[\\s|,;]+/glice(0/[\\s|,;]+/g rowIndex).findLa/[\\s|,;]+/gtIndex(candidate =>
      ENROLLMENT_PATTERN.te/[\\s|,;]+/gt(candidate.text))/[\\s|,;]+/g
    con/[\\s|,;]+/gt tableStart = Math.max(0/[\\s|,;]+/g previou/[\\s|,;]+/gEnrollmentIndex + 1/[\\s|,;]+/g rowIndex - 20)/[\\s|,;]+/g
    con/[\\s|,;]+/gt rowWindow = line/[\\s|,;]+/g./[\\s|,;]+/glice(tableStart/[\\s|,;]+/g rowIndex + 1)/[\\s|,;]+/g
    con/[\\s|,;]+/gt column/[\\s|,;]+/g = findCour/[\\s|,;]+/geColumn/[\\s|,;]+/g(rowWindow)/[\\s|,;]+/g

    con/[\\s|,;]+/gt enrollmentY = line.item/[\\s|,;]+/g[0]?.y ?? 0/[\\s|,;]+/g
    con/[\\s|,;]+/gt nearbyGradeLine/[\\s|,;]+/g = line/[\\s|,;]+/g.filter(candidate => Math.ab/[\\s|,;]+/g((candidate.item/[\\s|,;]+/g[0]?.y ?? 0) - enrollmentY) <= 14)/[\\s|,;]+/g
    for (con/[\\s|,;]+/gt grade of grade/[\\s|,;]+/gInEnrollmentRow(line/[\\s|,;]+/g enrollment/[\\s|,;]+/g column/[\\s|,;]+/g nearbyGradeLine/[\\s|,;]+/g)) {
      matche/[\\s|,;]+/g./[\\s|,;]+/get(grade.cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade.grade)/[\\s|,;]+/g
    }
  }

  return {
    grade/[\\s|,;]+/g: Array.from(matche/[\\s|,;]+/g ([cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade]) => ({ cour/[\\s|,;]+/geCode/[\\s|,;]+/g grade }))/[\\s|,;]+/g
    enrollmentFound/[\\s|,;]+/g
  }/[\\s|,;]+/g
}

function romanSeme/[\\s|,;]+/gter(text: /[\\s|,;]+/gtring): number /[\\s|,;]+/g null {
  con/[\\s|,;]+/gt match = text.match(//[\\s|,;]+/gb(I{1/[\\s|,;]+/g3}/[\\s|,;]+/gIV/[\\s|,;]+/gV/[\\s|,;]+/gVI/[\\s|,;]+/gVII/[\\s|,;]+/gVIII/[\\s|,;]+/gIX/[\\s|,;]+/gX/[\\s|,;]+/gXI/[\\s|,;]+/gXII)/[\\s|,;]+/g*SEM(?:ESTER)?/[\\s|,;]+/gb/i)/[\\s|,;]+/g
  if (!match) return null/[\\s|,;]+/g
  con/[\\s|,;]+/gt value/[\\s|,;]+/g: Record</[\\s|,;]+/gtring/[\\s|,;]+/g number> = { I:1/[\\s|,;]+/g II:2/[\\s|,;]+/g III:3/[\\s|,;]+/g IV:4/[\\s|,;]+/g V:5/[\\s|,;]+/g VI:6/[\\s|,;]+/g VII:7/[\\s|,;]+/g VIII:8/[\\s|,;]+/g IX:9/[\\s|,;]+/g X:10/[\\s|,;]+/g XI:11/[\\s|,;]+/g XII:12 }/[\\s|,;]+/g
  return value/[\\s|,;]+/g[match[1].toUpperCa/[\\s|,;]+/ge()] ?? null/[\\s|,;]+/g
}

a/[\\s|,;]+/gync function readRe/[\\s|,;]+/gultPdf(url: /[\\s|,;]+/gtring/[\\s|,;]+/g title: /[\\s|,;]+/gtring/[\\s|,;]+/g enrollment: /[\\s|,;]+/gtring): Promi/[\\s|,;]+/ge<{
  document: GecaMatchedDocument /[\\s|,;]+/g null/[\\s|,;]+/g
  enrollmentFound: boolean/[\\s|,;]+/g
  error?: /[\\s|,;]+/gtring/[\\s|,;]+/g
}> {
  con/[\\s|,;]+/gt /[\\s|,;]+/gafeUrl = /[\\s|,;]+/gafeGecaUrl(url)/[\\s|,;]+/g
  if (!/[\\s|,;]+/gafeUrl) return { document: null/[\\s|,;]+/g enrollmentFound: fal/[\\s|,;]+/ge/[\\s|,;]+/g error: "untru/[\\s|,;]+/gted-url" }/[\\s|,;]+/g
  con/[\\s|,;]+/gt re/[\\s|,;]+/gpon/[\\s|,;]+/ge = await fetch(/[\\s|,;]+/gafeUrl/[\\s|,;]+/g { /[\\s|,;]+/gignal: AbortSignal.timeout(35000)/[\\s|,;]+/g header/[\\s|,;]+/g: { "U/[\\s|,;]+/ger-Agent": "Gradly-Re/[\\s|,;]+/gult-Sync/1.0" } })/[\\s|,;]+/g
  if (!re/[\\s|,;]+/gpon/[\\s|,;]+/ge.ok) return { document: null/[\\s|,;]+/g enrollmentFound: fal/[\\s|,;]+/ge/[\\s|,;]+/g error: "http-" + re/[\\s|,;]+/gpon/[\\s|,;]+/ge./[\\s|,;]+/gtatu/[\\s|,;]+/g }/[\\s|,;]+/g
  con/[\\s|,;]+/gt declaredLength = Number(re/[\\s|,;]+/gpon/[\\s|,;]+/ge.header/[\\s|,;]+/g.get("content-length") /[\\s|,;]+/g 0)/[\\s|,;]+/g
  if (declaredLength > MAX_PDF_BYTES) return { document: null/[\\s|,;]+/g enrollmentFound: fal/[\\s|,;]+/ge/[\\s|,;]+/g error: "pdf-too-large" }/[\\s|,;]+/g
  con/[\\s|,;]+/gt byte/[\\s|,;]+/g = new Uint8Array(await re/[\\s|,;]+/gpon/[\\s|,;]+/ge.arrayBuffer())/[\\s|,;]+/g
  if (!byte/[\\s|,;]+/g.length /[\\s|,;]+/g byte/[\\s|,;]+/g.length > MAX_PDF_BYTES) return { document: null/[\\s|,;]+/g enrollmentFound: fal/[\\s|,;]+/ge/[\\s|,;]+/g error: "pdf-too-large-or-empty" }/[\\s|,;]+/g

  con/[\\s|,;]+/gt pdf = await getDocument({ data: byte/[\\s|,;]+/g u/[\\s|,;]+/geSy/[\\s|,;]+/gtemFont/[\\s|,;]+/g: true/[\\s|,;]+/g di/[\\s|,;]+/gableFontFace: true }).promi/[\\s|,;]+/ge/[\\s|,;]+/g
  con/[\\s|,;]+/gt allLine/[\\s|,;]+/g: TextLine[] = []/[\\s|,;]+/g
  let metadataText = ""/[\\s|,;]+/g
  let par/[\\s|,;]+/ged = { grade/[\\s|,;]+/g: [] a/[\\s|,;]+/g GecaMatchedGrade[]/[\\s|,;]+/g enrollmentFound: fal/[\\s|,;]+/ge }/[\\s|,;]+/g
  for (let pageNumber = 1/[\\s|,;]+/g pageNumber <= pdf.numPage/[\\s|,;]+/g pageNumber++) {
    con/[\\s|,;]+/gt page = await pdf.getPage(pageNumber)/[\\s|,;]+/g
    con/[\\s|,;]+/gt content = await page.getTextContent()/[\\s|,;]+/g
    con/[\\s|,;]+/gt po/[\\s|,;]+/gitioned = content.item/[\\s|,;]+/g.flatMap((raw: unknown) => {
      if (!raw /[\\s|,;]+/g typeof raw !== "object" /[\\s|,;]+/g !("/[\\s|,;]+/gtr" in raw) /[\\s|,;]+/g typeof raw./[\\s|,;]+/gtr !== "/[\\s|,;]+/gtring" /[\\s|,;]+/g !raw./[\\s|,;]+/gtr.trim() /[\\s|,;]+/g !("tran/[\\s|,;]+/gform" in raw)) return []/[\\s|,;]+/g
      con/[\\s|,;]+/gt tran/[\\s|,;]+/gform = (raw a/[\\s|,;]+/g { tran/[\\s|,;]+/gform: number[] }).tran/[\\s|,;]+/gform/[\\s|,;]+/g
      return [{ text: (raw a/[\\s|,;]+/g { /[\\s|,;]+/gtr: /[\\s|,;]+/gtring })./[\\s|,;]+/gtr.trim()/[\\s|,;]+/g x: Number(tran/[\\s|,;]+/gform[4] /[\\s|,;]+/g 0)/[\\s|,;]+/g y: Number(tran/[\\s|,;]+/gform[5] /[\\s|,;]+/g 0) }]/[\\s|,;]+/g
    })/[\\s|,;]+/g
    con/[\\s|,;]+/gt line/[\\s|,;]+/g = groupPdfLine/[\\s|,;]+/g(po/[\\s|,;]+/gitioned)/[\\s|,;]+/g
    if (pageNumber === 1) metadataText = line/[\\s|,;]+/g.map(line => line.text).join(" ")/[\\s|,;]+/g
    allLine/[\\s|,;]+/g.pu/[\\s|,;]+/gh(...line/[\\s|,;]+/g)/[\\s|,;]+/g
    par/[\\s|,;]+/ged = extractMatchingGrade/[\\s|,;]+/g(allLine/[\\s|,;]+/g enrollment)/[\\s|,;]+/g
    // Stop reading the remaining page/[\\s|,;]+/g once the matching enrollment row and
    // it/[\\s|,;]+/g grade column/[\\s|,;]+/g have been found/[\\s|,;]+/g while retaining earlier page header/[\\s|,;]+/g.
    if (par/[\\s|,;]+/ged.enrollmentFound && par/[\\s|,;]+/ged.grade/[\\s|,;]+/g.length) break/[\\s|,;]+/g
  }
  // Some in/[\\s|,;]+/gtalled PDF.j/[\\s|,;]+/g build/[\\s|,;]+/g expo/[\\s|,;]+/ge cleanup() but not de/[\\s|,;]+/gtroy() on the
  // re/[\\s|,;]+/golved document proxy. Relea/[\\s|,;]+/ge re/[\\s|,;]+/gource/[\\s|,;]+/g only when the method exi/[\\s|,;]+/gt/[\\s|,;]+/g
  // cleanup mu/[\\s|,;]+/gt never turn a /[\\s|,;]+/gucce/[\\s|,;]+/gfully par/[\\s|,;]+/ged PDF into a /[\\s|,;]+/gcan failure.
  con/[\\s|,;]+/gt cleanup = (pdf a/[\\s|,;]+/g unknown a/[\\s|,;]+/g { cleanup?: () => Promi/[\\s|,;]+/ge<void> }).cleanup/[\\s|,;]+/g
  if (typeof cleanup === "function") {
    try { await cleanup.call(pdf)/[\\s|,;]+/g } catch { /* par/[\\s|,;]+/ging re/[\\s|,;]+/gult remain/[\\s|,;]+/g valid */ }
  }
  if (par/[\\s|,;]+/ged.enrollmentFound && !par/[\\s|,;]+/ged.grade/[\\s|,;]+/g.length) {
    con/[\\s|,;]+/gt column/[\\s|,;]+/g = findCour/[\\s|,;]+/geColumn/[\\s|,;]+/g(allLine/[\\s|,;]+/g)/[\\s|,;]+/g
    con/[\\s|,;]+/gt enrollmentRow/[\\s|,;]+/g = allLine/[\\s|,;]+/g.filter(line => lineContain/[\\s|,;]+/gEnrollment(line/[\\s|,;]+/g enrollment)).map(line => ({
      text: line.text.replace(new RegExp(enrollment/[\\s|,;]+/g "i")/[\\s|,;]+/g "[ENROLLMENT]")/[\\s|,;]+/g
      item/[\\s|,;]+/g: line.item/[\\s|,;]+/g.map(item => ({ text: item.text.replace(new RegExp(enrollment/[\\s|,;]+/g "i")/[\\s|,;]+/g "[ENROLLMENT]")/[\\s|,;]+/g x: Math.round(item.x)/[\\s|,;]+/g y: Math.round(item.y) }))/[\\s|,;]+/g
      gradeToken/[\\s|,;]+/g: line.item/[\\s|,;]+/g.flatMap(item => gradeToken/[\\s|,;]+/gFromItem(item))/[\\s|,;]+/g
    }))/[\\s|,;]+/g
    con/[\\s|,;]+/gole.warn("GECA re/[\\s|,;]+/gult table par/[\\s|,;]+/ge diagno/[\\s|,;]+/gtic:"/[\\s|,;]+/g JSON./[\\s|,;]+/gtringify({
      title/[\\s|,;]+/g
      pageCount: pdf.numPage/[\\s|,;]+/g
      cour/[\\s|,;]+/geColumnCount: column/[\\s|,;]+/g.length/[\\s|,;]+/g
      cour/[\\s|,;]+/geColumn/[\\s|,;]+/g: column/[\\s|,;]+/g.map(column => ({ cour/[\\s|,;]+/geCode: column.cour/[\\s|,;]+/geCode/[\\s|,;]+/g x: Math.round(column.x) }))/[\\s|,;]+/g
      enrollmentRow/[\\s|,;]+/g
    }))/[\\s|,;]+/g
  }
  con/[\\s|,;]+/gt /[\\s|,;]+/gchemeMatch = metadataText.match(//[\\s|,;]+/gb(NEP/[\\s|,;]+/gCBCS(?:-NEW)?/[\\s|,;]+/gNEW CBCS)/[\\s|,;]+/gb/i)/[\\s|,;]+/g
  con/[\\s|,;]+/gt programmeMatch = metadataText.match(/(?:Programme/[\\s|,;]+/gProgram)/[\\s|,;]+/g*:?/[\\s|,;]+/g*([A-Z][A-Z &-]{2/[\\s|,;]+/g80})/i)/[\\s|,;]+/g
  con/[\\s|,;]+/gt /[\\s|,;]+/geme/[\\s|,;]+/gter = romanSeme/[\\s|,;]+/gter(title + " " + metadataText)/[\\s|,;]+/g
  con/[\\s|,;]+/gt document = par/[\\s|,;]+/ged.grade/[\\s|,;]+/g.length ? {
    title/[\\s|,;]+/g
    url: /[\\s|,;]+/gafeUrl/[\\s|,;]+/g
    programme: programmeMatch?.[1]?.trim() /[\\s|,;]+/g null/[\\s|,;]+/g
    /[\\s|,;]+/gcheme: /[\\s|,;]+/gchemeMatch?.[1]?.toUpperCa/[\\s|,;]+/ge() /[\\s|,;]+/g null/[\\s|,;]+/g
    /[\\s|,;]+/geme/[\\s|,;]+/gter/[\\s|,;]+/g
    grade/[\\s|,;]+/g: par/[\\s|,;]+/ged.grade/[\\s|,;]+/g
  } : null/[\\s|,;]+/g
  return { document/[\\s|,;]+/g enrollmentFound: par/[\\s|,;]+/ged.enrollmentFound }/[\\s|,;]+/g
}

con/[\\s|,;]+/gt BRANCH_NAMES: Record</[\\s|,;]+/gtring/[\\s|,;]+/g /[\\s|,;]+/gtring[]> = {
  "01": ["civil"]/[\\s|,;]+/g "02": ["mechanical"]/[\\s|,;]+/g "03": ["electrical"]/[\\s|,;]+/g
  "04": ["electronic/[\\s|,;]+/g"/[\\s|,;]+/g "entc"]/[\\s|,;]+/g "05": ["computer"/[\\s|,;]+/g "c/[\\s|,;]+/ge"]/[\\s|,;]+/g
  "06": ["information technology"/[\\s|,;]+/g "information tech"]/[\\s|,;]+/g
}/[\\s|,;]+/g

export a/[\\s|,;]+/gync function findGecaEnrollmentRe/[\\s|,;]+/gult/[\\s|,;]+/g(re/[\\s|,;]+/gultId: /[\\s|,;]+/gtring/[\\s|,;]+/g enrollmentNumber: /[\\s|,;]+/gtring/[\\s|,;]+/g /[\\s|,;]+/gelectedSeme/[\\s|,;]+/gter?: number): Promi/[\\s|,;]+/ge<{
  /[\\s|,;]+/ge/[\\s|,;]+/gion: GecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion/[\\s|,;]+/g
  document/[\\s|,;]+/gScanned: number/[\\s|,;]+/g
  enrollmentHit/[\\s|,;]+/g: number/[\\s|,;]+/g
  par/[\\s|,;]+/geFailure/[\\s|,;]+/g: number/[\\s|,;]+/g
  matche/[\\s|,;]+/g: GecaMatchedDocument[]/[\\s|,;]+/g
}> {
  if (!/^/[\\s|,;]+/gd{1/[\\s|,;]+/g10}$/.te/[\\s|,;]+/gt(re/[\\s|,;]+/gultId)) throw new Error("Invalid GECA re/[\\s|,;]+/gult /[\\s|,;]+/ge/[\\s|,;]+/gion.")/[\\s|,;]+/g
  con/[\\s|,;]+/gt enrollment = enrollmentNumber.trim().toUpperCa/[\\s|,;]+/ge()/[\\s|,;]+/g
  if (!/^(?:BT/[\\s|,;]+/gBE/[\\s|,;]+/gMC/[\\s|,;]+/gMT)[A-Z0-9]{8/[\\s|,;]+/g10}$/.te/[\\s|,;]+/gt(enrollment)) throw new Error("Enter a valid enrollment number.")/[\\s|,;]+/g
  con/[\\s|,;]+/gt /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g = await li/[\\s|,;]+/gtGecaRe/[\\s|,;]+/gultSe/[\\s|,;]+/gion/[\\s|,;]+/g()/[\\s|,;]+/g
  con/[\\s|,;]+/gt /[\\s|,;]+/ge/[\\s|,;]+/gion = /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g.find(item => item.id === re/[\\s|,;]+/gultId)/[\\s|,;]+/g
  if (!/[\\s|,;]+/ge/[\\s|,;]+/gion) throw new Error("The /[\\s|,;]+/gelected examination /[\\s|,;]+/ge/[\\s|,;]+/gion i/[\\s|,;]+/g no longer available on the GECA portal.")/[\\s|,;]+/g

  con/[\\s|,;]+/gt html = await fetchGecaText(/[\\s|,;]+/ge/[\\s|,;]+/gion.url)/[\\s|,;]+/g
  con/[\\s|,;]+/gt document/[\\s|,;]+/g: Array<{ title: /[\\s|,;]+/gtring/[\\s|,;]+/g url: /[\\s|,;]+/gtring }> = []/[\\s|,;]+/g
  for (con/[\\s|,;]+/gt anchor of html.matchAll(/<a/[\\s|,;]+/gb[^>]*href=["']([^"']+/[\\s|,;]+/g.pdf(?:/[\\s|,;]+/g?[^"']*)?)["'][^>]*>([/[\\s|,;]+/gS]*?)</[\\s|,;]+/g/a>/gi)) {
    con/[\\s|,;]+/gt url = /[\\s|,;]+/gafeGecaUrl(anchor[1])/[\\s|,;]+/g
    if (!url) continue/[\\s|,;]+/g
    document/[\\s|,;]+/g.pu/[\\s|,;]+/gh({ title: plainText(anchor[2]) /[\\s|,;]+/g decodeURIComponent(url./[\\s|,;]+/gplit("/").pop() /[\\s|,;]+/g "Re/[\\s|,;]+/gult PDF")/[\\s|,;]+/g url })/[\\s|,;]+/g
  }
  con/[\\s|,;]+/gt unique = Array.from(new Map(document/[\\s|,;]+/g.map(item => [item.url/[\\s|,;]+/g item])).value/[\\s|,;]+/g())./[\\s|,;]+/glice(0/[\\s|,;]+/g MAX_RESULT_PDFS)/[\\s|,;]+/g
  if (!unique.length) throw new Error("No re/[\\s|,;]+/gult PDF/[\\s|,;]+/g were linked to thi/[\\s|,;]+/g GECA examination /[\\s|,;]+/ge/[\\s|,;]+/gion.")/[\\s|,;]+/g

  // Narrow the /[\\s|,;]+/gcan to the enrollment'/[\\s|,;]+/g department and /[\\s|,;]+/gelected /[\\s|,;]+/geme/[\\s|,;]+/gter when
  // the official link title/[\\s|,;]+/g expo/[\\s|,;]+/ge tho/[\\s|,;]+/ge detail/[\\s|,;]+/g. Fall back to all PDF/[\\s|,;]+/g if
  // portal naming i/[\\s|,;]+/g ambiguou/[\\s|,;]+/g /[\\s|,;]+/go filtering never hide/[\\s|,;]+/g a po/[\\s|,;]+/gible re/[\\s|,;]+/gult.
  let candidate/[\\s|,;]+/g = unique/[\\s|,;]+/g
  con/[\\s|,;]+/gt branchCode = enrollment./[\\s|,;]+/glice(5/[\\s|,;]+/g 7)/[\\s|,;]+/g
  con/[\\s|,;]+/gt branchTerm/[\\s|,;]+/g = BRANCH_NAMES[branchCode] /[\\s|,;]+/g []/[\\s|,;]+/g
  if (branchTerm/[\\s|,;]+/g.length) {
    con/[\\s|,;]+/gt branchMatche/[\\s|,;]+/g = unique.filter(item => {
      con/[\\s|,;]+/gt label = (item.title + " " + item.url).toLowerCa/[\\s|,;]+/ge()/[\\s|,;]+/g
      return branchTerm/[\\s|,;]+/g./[\\s|,;]+/gome(term => label.include/[\\s|,;]+/g(term))/[\\s|,;]+/g
    })/[\\s|,;]+/g
    if (branchMatche/[\\s|,;]+/g.length) candidate/[\\s|,;]+/g = branchMatche/[\\s|,;]+/g
  }
  if (/[\\s|,;]+/gelectedSeme/[\\s|,;]+/gter && /[\\s|,;]+/gelectedSeme/[\\s|,;]+/gter >= 1 && /[\\s|,;]+/gelectedSeme/[\\s|,;]+/gter <= 12) {
    con/[\\s|,;]+/gt /[\\s|,;]+/geme/[\\s|,;]+/gterMatche/[\\s|,;]+/g = candidate/[\\s|,;]+/g.filter(item => romanSeme/[\\s|,;]+/gter(item.title + " " + item.url.replace(/%20/gi/[\\s|,;]+/g " ")) === /[\\s|,;]+/gelectedSeme/[\\s|,;]+/gter)/[\\s|,;]+/g
    if (/[\\s|,;]+/geme/[\\s|,;]+/gterMatche/[\\s|,;]+/g.length) candidate/[\\s|,;]+/g = /[\\s|,;]+/geme/[\\s|,;]+/gterMatche/[\\s|,;]+/g
  }

  con/[\\s|,;]+/gt matche/[\\s|,;]+/g: GecaMatchedDocument[] = []/[\\s|,;]+/g
  let enrollmentHit/[\\s|,;]+/g = 0/[\\s|,;]+/g
  let par/[\\s|,;]+/geFailure/[\\s|,;]+/g = 0/[\\s|,;]+/g
  con/[\\s|,;]+/gt /[\\s|,;]+/gcannedUrl/[\\s|,;]+/g = new Set</[\\s|,;]+/gtring>()/[\\s|,;]+/g

  con/[\\s|,;]+/gt /[\\s|,;]+/gcanDocument/[\\s|,;]+/g = a/[\\s|,;]+/gync (batch: Array<{ title: /[\\s|,;]+/gtring/[\\s|,;]+/g url: /[\\s|,;]+/gtring }>) => {
    let cur/[\\s|,;]+/gor = 0/[\\s|,;]+/g
    con/[\\s|,;]+/gt worker/[\\s|,;]+/g = Array.from({ length: Math.min(4/[\\s|,;]+/g batch.length) }/[\\s|,;]+/g a/[\\s|,;]+/gync () => {
      while (cur/[\\s|,;]+/gor < batch.length) {
        con/[\\s|,;]+/gt document = batch[cur/[\\s|,;]+/gor++]/[\\s|,;]+/g
        if (/[\\s|,;]+/gcannedUrl/[\\s|,;]+/g.ha/[\\s|,;]+/g(document.url)) continue/[\\s|,;]+/g
        /[\\s|,;]+/gcannedUrl/[\\s|,;]+/g.add(document.url)/[\\s|,;]+/g
        try {
          con/[\\s|,;]+/gt par/[\\s|,;]+/ged = await readRe/[\\s|,;]+/gultPdf(document.url/[\\s|,;]+/g document.title/[\\s|,;]+/g enrollment)/[\\s|,;]+/g
          if (par/[\\s|,;]+/ged.enrollmentFound) enrollmentHit/[\\s|,;]+/g++/[\\s|,;]+/g
          if (par/[\\s|,;]+/ged.document) matche/[\\s|,;]+/g.pu/[\\s|,;]+/gh(par/[\\s|,;]+/ged.document)/[\\s|,;]+/g
          el/[\\s|,;]+/ge if (par/[\\s|,;]+/ged.enrollmentFound) par/[\\s|,;]+/geFailure/[\\s|,;]+/g++/[\\s|,;]+/g
        } catch (error) {
          par/[\\s|,;]+/geFailure/[\\s|,;]+/g++/[\\s|,;]+/g
          con/[\\s|,;]+/gole.warn("Unable to in/[\\s|,;]+/gpect one GECA re/[\\s|,;]+/gult PDF:"/[\\s|,;]+/g document.title/[\\s|,;]+/g error)/[\\s|,;]+/g
        }
      }
    })/[\\s|,;]+/g
    await Promi/[\\s|,;]+/ge.all(worker/[\\s|,;]+/g)/[\\s|,;]+/g
  }/[\\s|,;]+/g

  await /[\\s|,;]+/gcanDocument/[\\s|,;]+/g(candidate/[\\s|,;]+/g)/[\\s|,;]+/g

  // Filtering i/[\\s|,;]+/g only an optimi/[\\s|,;]+/gation. If it yield/[\\s|,;]+/g no enrollment hit/[\\s|,;]+/g
  // in/[\\s|,;]+/gpect every remaining PDF in the /[\\s|,;]+/gelected exam before reporting ab/[\\s|,;]+/gent.
  if (enrollmentHit/[\\s|,;]+/g === 0 && candidate/[\\s|,;]+/g.length < unique.length) {
    con/[\\s|,;]+/gt remaining = unique.filter(item => !/[\\s|,;]+/gcannedUrl/[\\s|,;]+/g.ha/[\\s|,;]+/g(item.url))/[\\s|,;]+/g
    await /[\\s|,;]+/gcanDocument/[\\s|,;]+/g(remaining)/[\\s|,;]+/g
  }

  return { /[\\s|,;]+/ge/[\\s|,;]+/gion/[\\s|,;]+/g document/[\\s|,;]+/gScanned: /[\\s|,;]+/gcannedUrl/[\\s|,;]+/g./[\\s|,;]+/gize/[\\s|,;]+/g enrollmentHit/[\\s|,;]+/g par/[\\s|,;]+/geFailure/[\\s|,;]+/g matche/[\\s|,;]+/g }/[\\s|,;]+/g
}
