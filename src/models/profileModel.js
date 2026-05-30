const { pool } = require("../config/database");

// ─── helpers ────────────────────────────────────────────────────────────────

function buildUpsertParts(obj) {
  const keys   = Object.keys(obj);
  const values = Object.values(obj);
  const cols   = keys.map((k) => `\`${k}\``).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  const updates = keys
    .filter((k) => k !== "username")
    .map((k) => `\`${k}\` = VALUES(\`${k}\`)`)
    .join(", ");
  return { cols, placeholders, updates, values };
}

// ─── profile CRUD ───────────────────────────────────────────────────────────

async function upsertProfile(profileData) {
  const data = {
    ...profileData,
    last_refreshed_at: new Date(),
  };
  const { cols, placeholders, updates, values } = buildUpsertParts(data);

  const [result] = await pool.execute(
    `INSERT INTO profiles (${cols}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}, last_refreshed_at = NOW()`,
    values
  );

  // Return the row id (works for both INSERT and UPDATE)
  if (result.insertId) return result.insertId;

  const [[row]] = await pool.execute(
    "SELECT id FROM profiles WHERE username = ?",
    [profileData.username]
  );
  return row.id;
}

async function findProfileByUsername(username) {
  const [[row]] = await pool.execute(
    "SELECT * FROM profiles WHERE username = ?",
    [username]
  );
  return row || null;
}

async function findAllProfiles({ page = 1, limit = 20, sortBy = "engagement_score", order = "DESC" } = {}) {
  const allowedSorts = [
    "engagement_score", "followers", "total_stars",
    "public_repos", "last_refreshed_at", "analyzed_at", "username",
  ];
  const allowedOrders = ["ASC", "DESC"];

  const col = allowedSorts.includes(sortBy) ? sortBy : "engagement_score";
  const dir = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : "DESC";

  const offset = (Math.max(1, page) - 1) * limit;

  const [[{ total }]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM profiles"
  );

  const [rows] = await pool.execute(
    `SELECT * FROM profiles ORDER BY \`${col}\` ${dir} LIMIT ? OFFSET ?`,
    [parseInt(limit), offset]
  );

  return { profiles: rows, total, page: parseInt(page), limit: parseInt(limit) };
}

async function deleteProfileByUsername(username) {
  const [result] = await pool.execute(
    "DELETE FROM profiles WHERE username = ?",
    [username]
  );
  return result.affectedRows > 0;
}

// ─── repositories ───────────────────────────────────────────────────────────

async function upsertRepositories(profileId, username, repos) {
  if (!repos.length) return;

  // Delete existing repos for a clean refresh
  await pool.execute("DELETE FROM repositories WHERE profile_id = ?", [profileId]);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const repo of repos) {
      await conn.execute(
        `INSERT INTO repositories
          (profile_id, username, repo_name, full_name, description, language,
           stars, forks, watchers, open_issues, is_fork, is_archived, topics,
           repo_url, homepage, github_created_at, github_updated_at, github_pushed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId, username,
          repo.repo_name, repo.full_name, repo.description, repo.language,
          repo.stars, repo.forks, repo.watchers, repo.open_issues,
          repo.is_fork, repo.is_archived,
          JSON.stringify(repo.topics),
          repo.repo_url, repo.homepage,
          repo.github_created_at, repo.github_updated_at, repo.github_pushed_at,
        ]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findReposByUsername(username, { limit = 30, sortBy = "stars", order = "DESC" } = {}) {
  const allowedSorts = ["stars", "forks", "watchers", "open_issues", "github_pushed_at"];
  const col = allowedSorts.includes(sortBy) ? sortBy : "stars";
  const dir = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const [rows] = await pool.execute(
    `SELECT * FROM repositories WHERE username = ? ORDER BY \`${col}\` ${dir} LIMIT ?`,
    [username, parseInt(limit)]
  );
  return rows;
}

// ─── language stats ─────────────────────────────────────────────────────────

async function upsertLanguageStats(profileId, username, langStats) {
  await pool.execute("DELETE FROM language_stats WHERE profile_id = ?", [profileId]);

  for (const stat of langStats) {
    await pool.execute(
      `INSERT INTO language_stats (profile_id, username, language, repo_count, percentage)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE repo_count = ?, percentage = ?`,
      [profileId, username, stat.language, stat.repo_count, stat.percentage,
       stat.repo_count, stat.percentage]
    );
  }
}

async function findLanguageStatsByUsername(username) {
  const [rows] = await pool.execute(
    `SELECT language, repo_count, percentage
       FROM language_stats
      WHERE username = ?
      ORDER BY repo_count DESC`,
    [username]
  );
  return rows;
}

// ─── analysis history ───────────────────────────────────────────────────────

async function insertAnalysisHistory(profileId, snapshot) {
  await pool.execute(
    `INSERT INTO analysis_history
       (profile_id, username, followers, following, public_repos, total_stars, engagement_score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      profileId, snapshot.username,
      snapshot.followers, snapshot.following,
      snapshot.public_repos, snapshot.total_stars,
      snapshot.engagement_score,
    ]
  );
}

async function findAnalysisHistoryByUsername(username, limit = 10) {
  const [rows] = await pool.execute(
    `SELECT * FROM analysis_history
      WHERE username = ?
      ORDER BY snapshot_at DESC
      LIMIT ?`,
    [username, parseInt(limit)]
  );
  return rows;
}

// ─── stats ──────────────────────────────────────────────────────────────────

async function getOverallStats() {
  const [[counts]] = await pool.execute(
    `SELECT
       COUNT(*)                   AS total_profiles,
       SUM(public_repos)          AS total_repos_analyzed,
       SUM(followers)             AS total_followers,
       SUM(total_stars)           AS total_stars,
       AVG(engagement_score)      AS avg_engagement_score,
       MAX(engagement_score)      AS max_engagement_score,
       MAX(followers)             AS max_followers,
       MAX(total_stars)           AS max_stars
     FROM profiles`
  );

  const [[topEngaged]] = await pool.execute(
    `SELECT username, engagement_score FROM profiles ORDER BY engagement_score DESC LIMIT 1`
  );

  const [[mostFollowed]] = await pool.execute(
    `SELECT username, followers FROM profiles ORDER BY followers DESC LIMIT 1`
  );

  const [topLanguages] = await pool.execute(
    `SELECT language, SUM(repo_count) AS total_repos
       FROM language_stats
      GROUP BY language
      ORDER BY total_repos DESC
      LIMIT 5`
  );

  return { ...counts, topEngaged, mostFollowed, topLanguages };
}

module.exports = {
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
};
