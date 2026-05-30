# GitHub Profile Analyzer API

A production-ready REST API that fetches public GitHub user data, computes rich insights, and stores everything in MySQL for instant retrieval and historical tracking.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 16 |
| Framework | Express.js |
| Database | MySQL 8+ (via `mysql2`) |
| External API | GitHub REST API v3 |
| Extras | Helmet, CORS, Morgan, express-rate-limit, express-validator |

---

## Features

| # | Feature |
|---|---|
| 1 | Fetch public GitHub profile via username |
| 2 | Compute and store rich insights (stars, forks, engagement score, language breakdown, …) |
| 3 | Persist results in MySQL across 4 relational tables |
| 4 | List all analyzed profiles (paginated + sortable) |
| 5 | Fetch a single profile with repos, language stats, and history |
| ✨ | Smart caching – skip re-analysis if data is < 1 hour old |
| ✨ | Force refresh endpoint to pull latest data anytime |
| ✨ | Side-by-side comparison of up to 5 profiles |
| ✨ | Engagement score (0–100) – proprietary metric combining followers, stars, forks, repos, and account age |
| ✨ | Historical snapshots stored on every analysis |
| ✨ | GitHub API rate-limit status endpoint |
| ✨ | Global error handling with environment-aware detail |

---

## Project Structure

```
github-analyzer/
├── index.js                      # Server entry point
├── .env.example                  # Environment variable template
├── database/
│   └── setup.sql                 # Manual SQL setup script
└── src/
    ├── app.js                    # Express app (middleware + routes)
    ├── config/
    │   └── database.js           # MySQL pool + table initialisation
    ├── controllers/
    │   └── profileController.js  # Request / response orchestration
    ├── middleware/
    │   ├── errorHandler.js       # Global error handler + 404
    │   └── validate.js           # express-validator helper
    ├── models/
    │   └── profileModel.js       # All DB queries (CRUD)
    ├── routes/
    │   └── profileRoutes.js      # Route definitions + validation rules
    └── services/
        ├── analyticsService.js   # Pure insight-computation functions
        └── githubService.js      # GitHub API client
```

---

## Database Schema

### `profiles` – one row per username
| Column | Type | Description |
|---|---|---|
| `username` | VARCHAR | GitHub login (unique key) |
| `public_repos` | INT | Number of public repositories |
| `followers` / `following` | INT | Social graph counts |
| `total_stars` | INT | Sum of stars across all repos |
| `total_forks` | INT | Sum of forks across all repos |
| `avg_stars` | DECIMAL | Average stars per own repo |
| `top_language` | VARCHAR | Most-used language |
| `languages_used` | JSON | Ordered language list |
| `account_age_days` | INT | Days since GitHub join date |
| `engagement_score` | DECIMAL | 0–100 composite score |
| `is_hireable` | BOOL | GitHub "hireable" flag |
| `last_refreshed_at` | DATETIME | Last time data was fetched |

### `repositories` – up to 30 top repos per profile
Stores stars, forks, watchers, open issues, topics, language, push date, and more.

### `language_stats` – language frequency per profile
Repo count and percentage breakdown per language.

### `analysis_history` – time-series snapshots
Key metrics logged every time a profile is analyzed, enabling trend tracking.

---

## Setup

### 1. Prerequisites
- Node.js ≥ 16
- MySQL 8+
- (Optional) GitHub Personal Access Token for 5000 req/hr instead of 60

### 2. Clone & install
```bash
git clone <repo-url>
cd github-analyzer
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=github_analyzer
GITHUB_TOKEN=ghp_your_token_here   # optional but recommended
```

### 4. Create the database
```bash
mysql -u root -p < database/setup.sql
```
Or run this in your MySQL client:
```sql
CREATE DATABASE github_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
The server creates all tables automatically on first start.

### 5. Start the server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

---

### `POST /api/analyze/:username`
Fetch a GitHub profile and store all insights.

**Query params**
- `force=true` — bypass 1-hour cache and re-fetch

**Example**
```bash
curl -X POST http://localhost:3000/api/analyze/torvalds
```

**Response**
```json
{
  "success": true,
  "message": "GitHub profile @torvalds analyzed and stored successfully.",
  "cached": false,
  "data": {
    "username": "torvalds",
    "name": "Linus Torvalds",
    "followers": 235000,
    "total_stars": 198450,
    "engagement_score": 97.43,
    "top_language": "C",
    ...
  },
  "meta": {
    "repos_fetched": 8,
    "repos_stored": 8,
    "languages_detected": 3
  }
}
```

---

### `GET /api/profiles`
List all analyzed profiles.

**Query params**
| Param | Default | Options |
|---|---|---|
| `page` | `1` | positive integer |
| `limit` | `20` | 1–100 |
| `sortBy` | `engagement_score` | `engagement_score`, `followers`, `total_stars`, `public_repos`, `last_refreshed_at`, `username` |
| `order` | `DESC` | `ASC`, `DESC` |

```bash
curl "http://localhost:3000/api/profiles?sortBy=followers&limit=5"
```

---

### `GET /api/profiles/:username`
Full profile detail including top repos, language breakdown, and recent history.

```bash
curl http://localhost:3000/api/profiles/torvalds
```

---

### `PUT /api/profiles/:username/refresh`
Force re-fetch and update a stored profile.

```bash
curl -X PUT http://localhost:3000/api/profiles/torvalds/refresh
```

---

### `DELETE /api/profiles/:username`
Delete a profile and all related rows (repos, language stats, history).

```bash
curl -X DELETE http://localhost:3000/api/profiles/torvalds
```

---

### `GET /api/profiles/:username/repos`
Stored repositories for a profile.

**Query params:** `limit` (default 30), `sortBy` (`stars`|`forks`|`watchers`|`open_issues`|`github_pushed_at`), `order`

---

### `GET /api/profiles/:username/history`
Historical engagement snapshots.

**Query params:** `limit` (default 10, max 50)

---

### `GET /api/profiles/compare?users=a,b,c`
Side-by-side comparison of up to 5 analyzed profiles, ranked by engagement score.

```bash
curl "http://localhost:3000/api/profiles/compare?users=torvalds,gvanrossum,dhh"
```

---

### `GET /api/stats`
Aggregate statistics across all stored profiles.

---

### `GET /api/github/rate-limit`
Current GitHub API quota status.

---

### `GET /health`
Server health check.

---

## Engagement Score Formula

The engagement score (0–100) is a composite metric:

| Component | Weight | Logic |
|---|---|---|
| Followers | 30% | Log-scaled, cap 10 000 |
| Total Stars | 25% | Log-scaled, cap 5 000 |
| Total Forks | 20% | Log-scaled, cap 1 000 |
| Public Repos | 15% | Linear, cap 50 |
| Account Age | 10% | Linear, cap 10 years |

---

## Error Responses

All errors follow this structure:
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

| Status | Meaning |
|---|---|
| 404 | Profile not found / unknown route |
| 422 | Validation error (invalid username format, etc.) |
| 429 | Rate limit exceeded |
| 500 | Server / database error |
| 503 | GitHub API unreachable |
