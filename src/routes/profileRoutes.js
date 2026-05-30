const { Router } = require("express");
const { param, query } = require("express-validator");
const {
  analyzeUser,
  getAllProfiles,
  getProfile,
  refreshProfile,
  deleteProfile,
  getProfileRepos,
  getProfileHistory,
  compareProfiles,
  getStats,
  getGithubRateLimit,
} = require("../controllers/profileController");
const validate = require("../middleware/validate");

const router = Router();

// ── validation rules ────────────────────────────────────────────────────────
const usernameParam = [
  param("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .isLength({ max: 39 }).withMessage("GitHub username max 39 characters")
    .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)
    .withMessage("Invalid GitHub username format"),
];

const paginationQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be 1–100"),
  query("order").optional().isIn(["ASC", "DESC", "asc", "desc"]).withMessage("order must be ASC or DESC"),
];

// ── endpoints ────────────────────────────────────────────────────────────────

/**
 * @route  POST /api/analyze/:username
 * @desc   Fetch a GitHub profile from the API and store insights
 * @query  force=true – bypass 1-hour cache
 */
router.post("/analyze/:username", usernameParam, validate, analyzeUser);

/**
 * @route  GET /api/profiles
 * @desc   List all analyzed profiles (paginated + sortable)
 */
router.get(
  "/profiles",
  [
    ...paginationQuery,
    query("sortBy")
      .optional()
      .isIn(["engagement_score", "followers", "total_stars", "public_repos", "last_refreshed_at", "username"])
      .withMessage("Invalid sortBy field"),
  ],
  validate,
  getAllProfiles
);

/**
 * @route  GET /api/profiles/compare
 * @desc   Side-by-side comparison of up to 5 analyzed profiles
 * @query  users=alice,bob,carol
 */
router.get("/profiles/compare", compareProfiles);

/**
 * @route  GET /api/profiles/:username
 * @desc   Fetch a stored profile with repos, language breakdown, and history
 */
router.get("/profiles/:username", usernameParam, validate, getProfile);

/**
 * @route  PUT /api/profiles/:username/refresh
 * @desc   Force re-analyze and refresh a stored profile
 */
router.put("/profiles/:username/refresh", usernameParam, validate, refreshProfile);

/**
 * @route  DELETE /api/profiles/:username
 * @desc   Delete a stored profile and all related data
 */
router.delete("/profiles/:username", usernameParam, validate, deleteProfile);

/**
 * @route  GET /api/profiles/:username/repos
 * @desc   List stored repositories for a profile
 * @query  limit, sortBy (stars|forks|watchers|open_issues|github_pushed_at), order
 */
router.get("/profiles/:username/repos", usernameParam, validate, getProfileRepos);

/**
 * @route  GET /api/profiles/:username/history
 * @desc   Engagement history snapshots for a profile
 */
router.get("/profiles/:username/history", usernameParam, validate, getProfileHistory);

/**
 * @route  GET /api/stats
 * @desc   Aggregate stats across all stored profiles
 */
router.get("/stats", getStats);

/**
 * @route  GET /api/github/rate-limit
 * @desc   Check remaining GitHub API quota
 */
router.get("/github/rate-limit", getGithubRateLimit);

module.exports = router;
