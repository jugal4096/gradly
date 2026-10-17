import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 5000),

  databaseUrl: process.env.DATABASE_URL,

  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is missing.");
}

if (
  !env.firebaseProjectId ||
  !env.firebaseClientEmail ||
  !env.firebasePrivateKey
) {
  throw new Error("Firebase Admin environment variables are missing.");
}