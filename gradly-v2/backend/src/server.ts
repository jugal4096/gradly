import app from "./app";
import { env } from "./config/env";
import { testDatabaseConnection } from "./config/database";
import { purgeInactiveGuestSessions } from "./modules/guest/guest.repository";

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Database availability must not prevent the HTTP process from binding to
 * Render's assigned port. Supavisor can temporarily reject new sessions when
 * its shared session pool is full; keep the API alive and retry with backoff.
 */
async function initializeDatabase() {
  let attempt = 0;

  while (true) {
    try {
      const database = await testDatabaseConnection();

      console.log("✅ PostgreSQL connected");
      console.log("🕒 Database time:", database.current_time);

      // Run once after the database becomes available, then every six hours.
      // The repository predicate preserves active guest sessions.
      const runGuestCleanup = () => {
        void purgeInactiveGuestSessions()
          .then((deleted) => {
            if (deleted > 0) {
              console.log(`🧹 Removed ${deleted} guest session(s) inactive for over 30 days`);
            }
          })
          .catch((error) => console.error("Guest session cleanup failed:", error));
      };

      runGuestCleanup();
      const guestCleanupTimer = setInterval(runGuestCleanup, 6 * 60 * 60 * 1000);
      guestCleanupTimer.unref();
      return;
    } catch (error) {
      attempt += 1;
      const delayMs = Math.min(1000 * 2 ** Math.min(attempt - 1, 5), 30000);

      console.error(
        `⚠️ Database is unavailable during startup (attempt ${attempt}). API remains online; retrying in ${Math.round(delayMs / 1000)}s.`,
        error
      );
      await sleep(delayMs);
    }
  }
}

function startServer() {
  app.listen(env.port, () => {
    console.log(`🚀 Gradly backend running on port ${env.port}`);
    console.log(`🌐 http://localhost:${env.port}`);
    void initializeDatabase();
  });
}

startServer();
