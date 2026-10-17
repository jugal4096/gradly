import app from "./app";
import { env } from "./config/env";
import { testDatabaseConnection } from "./config/database";

async function startServer() {
  try {
    const database = await testDatabaseConnection();

    console.log("✅ PostgreSQL connected");
    console.log("🕒 Database time:", database.now);

    app.listen(env.port, () => {
      console.log(`🚀 Gradly backend running on port ${env.port}`);
      console.log(`🌐 http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start Gradly backend:", error);
    process.exit(1);
  }
}

startServer();