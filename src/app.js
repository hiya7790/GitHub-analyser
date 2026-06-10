const express = require("express");
const path    = require("path");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const rateLimit = require("express-rate-limit");

const profileRoutes          = require("./routes/profileRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();

// ── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc:     ["'self'", "data:"],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files (landing page) ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests – please try again later.",
  },
});
app.use("/api", limiter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "github-analyzer",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api", profileRoutes);

// ── API info (JSON) ──────────────────────────────────────────────────────────
app.get("/api/info", (_req, res) => {
  res.json({
    service: "GitHub Profile Analyzer API",
    version: "1.0.0",
    health: "/health",
    endpoints: {
      analyze:     "POST   /api/analyze/:username",
      listAll:     "GET    /api/profiles",
      single:      "GET    /api/profiles/:username",
      refresh:     "PUT    /api/profiles/:username/refresh",
      remove:      "DELETE /api/profiles/:username",
      repos:       "GET    /api/profiles/:username/repos",
      history:     "GET    /api/profiles/:username/history",
      compare:     "GET    /api/profiles/compare?users=a,b,c",
      stats:       "GET    /api/stats",
      rateLimit:   "GET    /api/github/rate-limit",
    },
  });
});

// ── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
