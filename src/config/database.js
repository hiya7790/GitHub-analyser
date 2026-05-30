const mysql = require("mysql2/promise");

// Cloud MySQL providers (TiDB Cloud, PlanetScale, etc.) require SSL.
// Set DB_SSL=true in your environment to enable it.
const sslConfig = process.env.DB_SSL === "true"
  ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
  : undefined;

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "github_analyzer",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(sslConfig && { ssl: sslConfig }),
};

const pool = mysql.createPool(dbConfig);

/**
 * Test the database connection
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL connected successfully");
    conn.release();
    return true;
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    throw err;
  }
}

/**
 * Initialize all database tables
 */
async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // ── profiles ──────────────────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS profiles (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        username         VARCHAR(100) NOT NULL UNIQUE,
        name             VARCHAR(255),
        bio              TEXT,
        company          VARCHAR(255),
        location         VARCHAR(255),
        blog             VARCHAR(500),
        email            VARCHAR(255),
        twitter_username VARCHAR(100),
        avatar_url       VARCHAR(500),
        github_url       VARCHAR(500),

        -- Core numeric insights
        public_repos     INT DEFAULT 0,
        public_gists     INT DEFAULT 0,
        followers        INT DEFAULT 0,
        following        INT DEFAULT 0,

        -- Calculated insights
        total_stars      INT DEFAULT 0,
        total_forks      INT DEFAULT 0,
        total_watchers   INT DEFAULT 0,
        avg_stars        DECIMAL(10,2) DEFAULT 0.00,
        avg_forks        DECIMAL(10,2) DEFAULT 0.00,
        top_language     VARCHAR(100),
        languages_used   JSON,
        account_age_days INT DEFAULT 0,
        engagement_score DECIMAL(10,2) DEFAULT 0.00,

        -- Profile flags
        is_hireable      BOOLEAN DEFAULT FALSE,
        site_admin       BOOLEAN DEFAULT FALSE,

        -- Timestamps
        github_created_at DATETIME,
        github_updated_at DATETIME,
        analyzed_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_refreshed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        INDEX idx_username (username),
        INDEX idx_engagement (engagement_score DESC),
        INDEX idx_followers  (followers DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ── repositories ──────────────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS repositories (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        profile_id       INT NOT NULL,
        username         VARCHAR(100) NOT NULL,
        repo_name        VARCHAR(255) NOT NULL,
        full_name        VARCHAR(400) NOT NULL,
        description      TEXT,
        language         VARCHAR(100),
        stars            INT DEFAULT 0,
        forks            INT DEFAULT 0,
        watchers         INT DEFAULT 0,
        open_issues      INT DEFAULT 0,
        is_fork          BOOLEAN DEFAULT FALSE,
        is_archived      BOOLEAN DEFAULT FALSE,
        topics           JSON,
        repo_url         VARCHAR(500),
        homepage         VARCHAR(500),
        github_created_at DATETIME,
        github_updated_at DATETIME,
        github_pushed_at  DATETIME,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        INDEX idx_profile (profile_id),
        INDEX idx_stars   (stars DESC),
        UNIQUE KEY unique_repo (profile_id, repo_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ── language_stats ────────────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS language_stats (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        profile_id   INT NOT NULL,
        username     VARCHAR(100) NOT NULL,
        language     VARCHAR(100) NOT NULL,
        repo_count   INT DEFAULT 1,
        percentage   DECIMAL(5,2) DEFAULT 0.00,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        UNIQUE KEY unique_lang (profile_id, language),
        INDEX idx_profile_lang (profile_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ── analysis_history ──────────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        profile_id    INT NOT NULL,
        username      VARCHAR(100) NOT NULL,
        followers     INT DEFAULT 0,
        following     INT DEFAULT 0,
        public_repos  INT DEFAULT 0,
        total_stars   INT DEFAULT 0,
        engagement_score DECIMAL(10,2) DEFAULT 0.00,
        snapshot_at   DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        INDEX idx_profile_history (profile_id),
        INDEX idx_snapshot (snapshot_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.commit();
    console.log("✅ Database tables initialized successfully");
  } catch (err) {
    await connection.rollback();
    console.error("❌ Database initialization failed:", err.message);
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { pool, testConnection, initializeDatabase };
