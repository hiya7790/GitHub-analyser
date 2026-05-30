/**
 * keep-alive.js
 *
 * Render's free tier spins down web services after ~15 minutes of inactivity.
 * This module pings the /health endpoint every 14 minutes to keep it awake.
 *
 * Only active when KEEP_ALIVE=true is set in the environment.
 * Set RENDER_EXTERNAL_URL automatically by Render (no manual config needed).
 */

const https = require("https");
const http  = require("http");

const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

function ping(url) {
  const lib = url.startsWith("https") ? https : http;
  const req = lib.get(url, (res) => {
    console.log(`[keep-alive] pinged ${url} → ${res.statusCode}`);
  });
  req.on("error", (err) => {
    console.warn("[keep-alive] ping failed:", err.message);
  });
  req.end();
}

function startKeepAlive() {
  const baseUrl = process.env.RENDER_EXTERNAL_URL;
  if (!baseUrl) {
    console.log("[keep-alive] RENDER_EXTERNAL_URL not set – skipping");
    return;
  }

  const target = `${baseUrl}/health`;
  console.log(`[keep-alive] started – pinging ${target} every 14 min`);
  setInterval(() => ping(target), INTERVAL_MS);
}

module.exports = { startKeepAlive };
