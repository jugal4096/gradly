import app from "./app";
import { env } from "./config/env";
import { testDatabaseConnection } from "./config/database";
import { purgeInactiveGuestSessions } from "./modules/guest/guest.repository";

async function startServer() {
  try {
    const database = await testDatabaseConnection();

    console.log("✅ PostgreSQL connected");
    console.log("🕒 Database time:", database.now);

    // Run once at startup, then every six hours. The database predicate uses last_seen_at\n    // so active guests are never removed; only sessions idle for more than 30 days expire.\n    const runGuestCleanup = () => {\n      void purgeInactiveGuestSessions()\n        .then((deleted) => { if (deleted > 0) console.log(`🧹 Removed ${deleted} guest session(s) inactive for over 30 days`); })\n        .catch((error) => console.error("Guest session cleanup failed:", error));\n    };\n    runGuestCleanup();\n    const guestCleanupTimer = setInterval(runGuestCleanup, 6 * 60 * 60 * 1000);\n    guestCleanupTimer.unref();\n\n    app.listen(env.port, () => {
      console.log(`🚀 Gradly backend running on port ${env.port}`);
      console.log(`🌐 http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start Gradly backend:", error);
    process.exit(1);
  }
}

startServer();