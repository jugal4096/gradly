import "dotenv/config";

const localDevelopmentOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const configuredCorsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOrigins = [...new Set([...localDevelopmentOrigins, ...configuredCorsOrigins])];

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigins,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is missing.");
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

if (
  !env.firebaseProjectId ||
  !env.firebaseClientEmail ||
  !env.firebasePrivateKey
) {
  throw new Error("Firebase Admin environment variables are missing.");
}
