import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { AuthProvider } from "./config/AuthContext";
import "./design-system/index.css";

// Restore independent Admin and Super Admin appearance preferences before first paint.
try {
  const root = document.documentElement;
  const adminPalette = localStorage.getItem("gradly_admin_palette");
  const adminTheme = localStorage.getItem("gradly_admin_theme");
  const saPalette = localStorage.getItem("gradly_sa_palette");
  const saTheme = localStorage.getItem("gradly_sa_theme");
  const adminFont = localStorage.getItem("gradly_admin_font");
  const adminFontSize = localStorage.getItem("gradly_admin_font_size");
  const adminReducedMotion = localStorage.getItem("gradly_admin_reduced_motion");
  if (adminPalette && ["green", "blue", "yellow"].includes(adminPalette)) root.dataset.adminPalette = adminPalette;
  if (adminTheme && ["light", "dark", "system"].includes(adminTheme)) {\n    root.dataset.adminTheme = adminTheme === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : adminTheme;\n  }
  if (adminFont) root.dataset.adminFont = adminFont;
  if (adminFontSize) root.dataset.adminFontSize = adminFontSize;
  if (adminReducedMotion) root.dataset.adminReducedMotion = adminReducedMotion;
  if (saPalette && ["purple", "green"].includes(saPalette)) root.dataset.saPalette = saPalette;
  if (saTheme && ["light", "dark"].includes(saTheme)) root.dataset.saTheme = saTheme;
} catch {
  // Appearance preferences remain optional when browser storage is unavailable.
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Gradly Ecosystem root element was not found."
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);