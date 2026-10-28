const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

export const API_BASE_URL = (
  configuredApiBaseUrl || (import.meta.env.DEV ? "http://localhost:5000" : "")
)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

export const isApiConfigured = API_BASE_URL.length > 0;

export const API_CONFIGURATION_ERROR =
  "The Gradly API URL is not configured for this deployment. Set VITE_API_BASE_URL in Vercel to your publicly reachable backend URL, then redeploy.";
