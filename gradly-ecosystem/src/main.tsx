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
  if (adminPalette && ["green", "blue", "yellow"].includes(adminPalette)) root.dataset.adminPalette = adminPalette;
  if (adminTheme && ["light", "dark"].includes(adminTheme)) root.dataset.adminTheme = adminTheme;
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