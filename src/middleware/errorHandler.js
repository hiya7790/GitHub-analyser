/**
 * Centralised error handler.
 * Converts known error types to structured JSON responses.
 */

function errorHandler(err, req, res, _next) {
  // Already sent – nothing we can do
  if (res.headersSent) return;

  const isDev = process.env.NODE_ENV === "development";

  // GitHub API errors
  if (err.githubError) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      ...(isDev && { stack: err.stack }),
    });
  }

  // MySQL errors
  if (err.code && err.sqlMessage) {
    console.error("DB error:", err.sqlMessage);
    return res.status(500).json({
      success: false,
      message: "Database error",
      ...(isDev && { detail: err.sqlMessage }),
    });
  }

  // Axios / network errors
  if (err.isAxiosError) {
    const status = err.response?.status || 503;
    return res.status(status).json({
      success: false,
      message: err.response?.data?.message || "Network request failed",
    });
  }

  // 404 for unknown routes (raised manually)
  if (err.status === 404) {
    return res.status(404).json({ success: false, message: err.message });
  }

  // Generic fallback
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * 404 catch-all for unmapped routes
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

module.exports = { errorHandler, notFound };
