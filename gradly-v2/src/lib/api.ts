const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

export const API_BASE_URL = (
  configuredApiBaseUrl || (import.meta.env.DEV ? "http://localhost:5000" : "")
)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

export function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "The Gradly API URL is not configured for this deployment. Set VITE_API_BASE_URL to the publicly reachable backend origin, then redeploy."
    );
  }

  const normalizedPath = path.startsWith("/") ? path : \`/\${path}\`;
  const apiPath = normalizedPath.toLowerCase().startsWith("/api/")
    ? normalizedPath
    : \`/api\${normalizedPath}\`;

  return \`\${API_BASE_URL}\${apiPath}\`;
}
