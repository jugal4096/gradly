const ALLOWED_ORIGINS = new Set([
  "https://gradly-peach.netlify.app",
  "https://gradly-peach.vercel.app",
  "http://localhost:5173",
]);
const GECA_HOST = "geca.ac.in";
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function corsHeaders(origin) {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
function isAllowedGecaUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== GECA_HOST || url.username || url.password) return false;
    const path = url.pathname.toLowerCase();
    if (path === "/result-master.aspx") return true;
    if (path === "/result.aspx") {
      const resultId = url.searchParams.get("resultID") || "";
      return resultId.length > 0 && [...resultId].every(char => char >= "0" && char <= "9");
    }
    return path.endsWith(".pdf");
  } catch { return false; }
}
function json(body, status, headers) {
  const result = new Headers(headers);
  result.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers: result });
}
async function fetchGeca(url) {
  let current = new URL(url);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!isAllowedGecaUrl(current.toString())) throw new Error("The GECA URL is outside the permitted result archive.");
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/pdf,application/octet-stream,text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Referer": "https://geca.ac.in/",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("GECA returned an unsupported redirect.");
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error("GECA redirect limit exceeded.");
}
function limitStream(body, maxBytes) {
  if (!body) return null;
  let total = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) { controller.error(new Error("GECA PDF exceeds the 20 MiB safety limit.")); return; }
      controller.enqueue(chunk);
    },
  }));
}
async function handleRequest(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403, headers });
    return new Response(null, { status: 204, headers });
  }
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return json({ success: true, service: "gradly-geca-gateway" }, 200, headers);
  }
  if (!ALLOWED_ORIGINS.has(origin)) return json({ success: false, message: "Origin is not allowed." }, 403, headers);
  if (request.method !== "GET" || url.pathname !== "/v1/geca") return json({ success: false, message: "Route not found." }, 404, headers);
  const target = url.searchParams.get("url") || "";
  if (!isAllowedGecaUrl(target)) return json({ success: false, message: "Only official GECA result pages and PDF files are allowed." }, 400, headers);
  try {
    const upstream = await fetchGeca(target);
    if (!upstream.ok) return json({ success: false, message: "GECA returned HTTP " + upstream.status + "." }, upstream.status, headers);
    const contentType = upstream.headers.get("Content-Type") || "application/octet-stream";
    const declaredLength = Number(upstream.headers.get("Content-Length") || 0);
    const isPdf = new URL(target).pathname.toLowerCase().endsWith(".pdf") || contentType.toLowerCase().includes("pdf");
    if (isPdf && declaredLength > MAX_PDF_BYTES) return json({ success: false, message: "The result PDF exceeds the 20 MiB safety limit." }, 413, headers);
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", isPdf ? "public, max-age=300" : "no-store");
    if (upstream.headers.has("Content-Length")) headers.set("Content-Length", upstream.headers.get("Content-Length"));
    if (upstream.headers.has("Last-Modified")) headers.set("Last-Modified", upstream.headers.get("Last-Modified"));
    return new Response(isPdf ? limitStream(upstream.body, MAX_PDF_BYTES) : upstream.body, { status: 200, headers });
  } catch (error) {
    return json({ success: false, message: error instanceof Error ? error.message : "Unable to fetch the GECA result document." }, 502, headers);
  }
}
addEventListener("fetch", event => event.respondWith(handleRequest(event.request)));
