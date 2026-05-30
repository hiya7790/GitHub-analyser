-- ============================================================
-- GitHub Profile Analyzer – MySQL Setup Script
-- Run this ONCE before starting the server for the first time.
-- The server also auto-creates tables on startup via initializeDatabase().
-- ============================================================

-- 1. Create the database (if it doesn't exist)
CREATE DATABASE IF NOT EXISTS github_analyzer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE github_analyzer;

-- 2. Create a dedicated application user (recommended for production)
-- Change 'your_strong_password' to something secure
-- CREATE USER IF NOT EXISTS 'github_app'@'localhost' IDENTIFIED BY 'your_strong_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER
--   ON github_analyzer.* TO 'github_app'@'localhost';
-- FLUSH PRIVILEGES;

-- 3. Tables are created automatically by the server on startup.
--    You can run the statements below manually if you prefer.

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
  public_repos     INT DEFAULT 0,
  public_gists     INT DEFAULT 0,
  followers        INT DEFAULT 0,
  following        INT DEFAULT 0,
  total_stars      INT DEFAULT 0,
  total_forks      INT DEFAULT 0,
  total_watchers   INT DEFAULT 0,
  avg_stars        DECIMAL(10,2) DEFAULT 0.00,
  avg_forks        DECIMAL(10,2) DEFAULT 0.00,
  top_language     VARCHAR(100),
  languages_used   JSON,
  account_age_days INT DEFAULT 0,
  engagement_score DECIMAL(10,2) DEFAULT 0.00,
  is_hireable      BOOLEAN DEFAULT FALSE,
  site_admin       BOOLEAN DEFAULT FALSE,
  github_created_at DATETIME,
  github_updated_at DATETIME,
  analyzed_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_refreshed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username   (username),
  INDEX idx_engagement (engagement_score DESC),
  INDEX idx_followers  (followers DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS analysis_history (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  profile_id       INT NOT NULL,
  username         VARCHAR(100) NOT NULL,
  followers        INT DEFAULT 0,
  following        INT DEFAULT 0,
  public_repos     INT DEFAULT 0,
  total_stars      INT DEFAULT 0,
  engagement_score DECIMAL(10,2) DEFAULT 0.00,
  snapshot_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_profile_history (profile_id),
  INDEX idx_snapshot (snapshot_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Optional: verify tables created ──────────────────────────────────────────
SHOW TABLES;
