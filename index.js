require("dotenv").config();

const app = require("./src/app");
const { testConnection, initializeDatabase } = require("./src/config/database");
const { startKeepAlive } = require("./src/utils/keepAlive");

const PORT = parseInt(process.env.PORT) || 3000;

async function start() {
  try {
    await testConnection();
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`\n GitHub Analyzer API running on http://localhost:${PORT}`);
      console.log(`API overview:        http://localhost:${PORT}/`);
      console.log(`Health check:        http://localhost:${PORT}/health`);
      console.log(`Analyze a profile:   POST http://localhost:${PORT}/api/analyze/:username`);
      console.log(`List all profiles:   GET  http://localhost:${PORT}/api/profiles`);
      console.log(`Stats dashboard:     GET  http://localhost:${PORT}/api/stats\n`);

      // Keep Render free tier alive (no-op locally)
      startKeepAlive();
    });
  } catch (err) {
    console.error("Startup failed:", err.message);
    process.exit(1);
  }
}

start();
