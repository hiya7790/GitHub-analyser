const { fetchUserProfile, fetchUserRepos, fetchRateLimit } = require("../services/githubService");
const { analyzeProfile } = require("../services/analyticsService");
const {
  upsertProfile,
  findProfileByUsername,
  findAllProfiles,
  deleteProfileByUsername,
  upsertRepositories,
  findReposByUsername,
  upsertLanguageStats,
  findLanguageStatsByUsername,
  insertAnalysisHistory,
  findAnalysisHistoryByUsername,
  getOverallStats,
} = require("../models/profileModel");

// ─── POST /api/analyze/:username ───────────────────────────────────────────
async function analyzeUser(req, res, next) {
  const { username } = req.params;
  const force = req.query.force === "true";

  try {
    // Skip re-analysis if fresh data exists (< 1 hr) and force=false
    if (!force) {
      const existing = await findProfileByUsername(username);
      if (existing) {
        const lastRefreshed = new Date(existing.last_refreshed_at);
        const ageMinutes = (Date.now() - lastRefreshed.getTime()) / 60000;
        if (ageMinutes < 60) {
          return res.status(200).json({
            success: true,
            message: `Profile is fresh (analyzed ${Math.floor(ageMinutes)} min ago). Use ?force=true to re-analyze.`,
            cached: true,
            data: existing,
          });
        }
      }
    }

    // 1. Fetch from GitHub
    const [githubUser, repos] = await Promise.all([
      fetchUserProfile(username),
      fetchUserRepos(username),
    ]);

    // 2. Compute insights
    const { profile, langStats, topRepos } = analyzeProfile(githubUser, repos);

    // 3. Persist
    const profileId = await upsertProfile(profile);
    await Promise.all([
      upsertRepositories(profileId, username, topRepos),
      upsertLanguageStats(profileId, username, langStats),
      insertAnalysisHistory(profileId, profile),
    ]);

    // 4. Fetch enriched profile back from DB
    const saved = await findProfileByUsername(username);

    return res.status(201).json({
      success: true,
      message: `GitHub profile @${username} analyzed and stored successfully.`,
      cached: false,
      data: saved,
      meta: {
        repos_fetched: repos.length,
        repos_stored: topRepos.length,
        languages_detected: langStats.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/profiles ─────────────────────────────────────────────────────
async function getAllProfiles(req, res, next) {
  try {
    const { page = 1, limit = 20, sortBy = "engagement_score", order = "DESC" } = req.query;
    const result = await findAllProfiles({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      sortBy,
      order,
    });

    return res.status(200).json({
      success: true,
      data: result.profiles,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        hasNext: result.page * result.limit < result.total,
        hasPrev: result.page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/profiles/:username ───────────────────────────────────────────
async function getProfile(req, res, next) {
  const { username } = req.params;
  try {
    const profile = await findProfileByUsername(username);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: `Profile @${username} not found. Use POST /api/analyze/${username} to analyze it first.`,
      });
    }

    const [repos, languageStats, history] = await Promise.all([
      findReposByUsername(username, {
        limit: parseInt(req.query.repoLimit) || 10,
        sortBy: req.query.repoSort || "stars",
      }),
      findLanguageStatsByUsername(username),
      findAnalysisHistoryByUsername(username, 5),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        profile,
        top_repositories: repos,
        language_breakdown: languageStats,
        analysis_history: history,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/profiles/:username/refresh ──────────────────────────────────
async function refreshProfile(req, res, next) {
  req.query.force = "true";
  return analyzeUser(req, res, next);
}

// ─── DELETE /api/profiles/:username ───────────────────────────────────────
async function deleteProfile(req, res, next) {
  const { username } = req.params;
  try {
    const deleted = await deleteProfileByUsername(username);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Profile @${username} not found.`,
      });
    }
    return res.status(200).json({
      success: true,
      message: `Profile @${username} and all related data deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/profiles/:username/repos ────────────────────────────────────
async function getProfileRepos(req, res, next) {
  const { username } = req.params;
  const { limit = 30, sortBy = "stars", order = "DESC" } = req.query;
  try {
    const profile = await findProfileByUsername(username);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: `Profile @${username} not found. Analyze it first.`,
      });
    }

    const repos = await findReposByUsername(username, {
      limit: Math.min(parseInt(limit), 100),
      sortBy,
      order,
    });

    return res.status(200).json({
      success: true,
      username,
      total: repos.length,
      data: repos,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/profiles/:username/history ──────────────────────────────────
async function getProfileHistory(req, res, next) {
  const { username } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    const profile = await findProfileByUsername(username);
    if (!profile) {
      return res.status(404).json({ success: false, message: `Profile @${username} not found.` });
    }

    const history = await findAnalysisHistoryByUsername(username, limit);

    return res.status(200).json({
      success: true,
      username,
      data: history,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/profiles/compare?users=a,b,c ─────────────────────────────────
async function compareProfiles(req, res, next) {
  const { users } = req.query;
  if (!users) {
    return res.status(400).json({
      success: false,
      message: "Provide a comma-separated list of usernames via ?users=alice,bob",
    });
  }

  const usernames = [...new Set(users.split(",").map((u) => u.trim()).filter(Boolean))].slice(0, 5);

  try {
    const profiles = await Promise.all(usernames.map(findProfileByUsername));
    const found = profiles.filter(Boolean);

    if (!found.length) {
      return res.status(404).json({
        success: false,
        message: "None of the requested profiles have been analyzed yet.",
      });
    }

    const compared = found
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .map((p, i) => ({
        rank: i + 1,
        username: p.username,
        name: p.name,
        avatar_url: p.avatar_url,
        followers: p.followers,
        public_repos: p.public_repos,
        total_stars: p.total_stars,
        top_language: p.top_language,
        engagement_score: p.engagement_score,
        account_age_days: p.account_age_days,
      }));

    return res.status(200).json({
      success: true,
      compared_users: usernames,
      not_found: usernames.filter((u) => !found.find((p) => p.username.toLowerCase() === u.toLowerCase())),
      data: compared,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/stats ────────────────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const stats = await getOverallStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/github/rate-limit ────────────────────────────────────────────
async function getGithubRateLimit(req, res, next) {
  try {
    const rateLimit = await fetchRateLimit();
    const resetDate = new Date(rateLimit.reset * 1000);
    return res.status(200).json({
      success: true,
      data: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        used: rateLimit.used,
        reset_at: resetDate.toISOString(),
        authenticated: !!process.env.GITHUB_TOKEN,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
