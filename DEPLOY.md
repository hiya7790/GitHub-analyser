# Deploying to Render + TiDB Cloud (Free Tier)

This guide gets you live in ~10 minutes using:
- **Render** — hosts the Node.js API (free web service)
- **TiDB Cloud Serverless** — hosts the MySQL-compatible database (free tier: 5 GB, 50M request units/month)

> **Note:** PlanetScale discontinued its free tier in 2024. TiDB Cloud Serverless is the best free MySQL-compatible replacement — it works with the same `mysql2` driver and SQL syntax.

---

## Step 1 — Push your code to GitHub

Your code should already be on GitHub. If not:
```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/github-analyzer.git
git push -u origin main
```

---

## Step 2 — Create a free MySQL database on TiDB Cloud

1. Go to [tidbcloud.com](https://tidbcloud.com) and sign up (GitHub login works).
2. Click **"Create Cluster"** → choose **"Serverless"** (free tier).
3. Name it `github-analyzer` → pick a region close to **Oregon** (Render's free region).
4. Once the cluster is ready, click **"Connect"** → select **"General"** connection type.
5. Copy these values — you'll need them for Render:

   | Field | Example |
   |-------|---------|
   | **Host** | `gateway01.us-west-2.prod.aws.tidbcloud.com` |
   | **Port** | `4000` |
   | **Username** | `2xxxxxxxxx.root` |
   | **Password** | *(shown once — save it!)* |

6. Create a database by clicking the **"SQL Editor"** tab in the console and running:
   ```sql
   CREATE DATABASE IF NOT EXISTS github_analyzer;
   ```

> **Free tier limits:** 5 GB row storage, 5 GB request units/month — more than enough for this project.

---

## Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub account and select the `github-analyzer` (or `GitHub-analyser`) repo.
3. Render will auto-detect the `render.yaml` blueprint. Confirm the settings:
   - **Name:** `github-analyzer-api`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Free
4. Click **"Advanced"** → **"Add Environment Variable"** and fill in:

   | Key | Value |
   |-----|-------|
   | `DB_HOST` | *(TiDB Cloud host from Step 2)* |
   | `DB_USER` | *(TiDB Cloud username from Step 2)* |
   | `DB_PASSWORD` | *(TiDB Cloud password from Step 2)* |
   | `DB_NAME` | `github_analyzer` |
   | `DB_PORT` | `4000` |
   | `DB_SSL` | `true` |
   | `GITHUB_TOKEN` | *(your GitHub PAT — optional but recommended)* |
   | `NODE_ENV` | `production` |

5. Click **"Create Web Service"**. Render will build and deploy automatically.

---

## Step 4 — Verify

Once deployed (takes ~2 minutes), Render gives you a URL like:
```
https://github-analyzer-api.onrender.com
```

Test it:
```bash
# Health check
curl https://github-analyzer-api.onrender.com/health

# Analyze your first profile
curl -X POST https://github-analyzer-api.onrender.com/api/analyze/torvalds

# List all profiles
curl https://github-analyzer-api.onrender.com/api/profiles
```

---

## Free Tier Limitations

| Limitation | Detail |
|---|---|
| **Render spin-down** | Free services sleep after 15 min of inactivity. First request after sleep takes ~30 sec. The built-in keep-alive pinger mitigates this. |
| **Render hours** | 750 free instance hours/month |
| **TiDB storage** | 5 GB row storage on the free tier |
| **TiDB requests** | 50M request units/month |
| **GitHub API** | Without `GITHUB_TOKEN`: 60 req/hr. With token: 5,000 req/hr |

---

## Re-deploying after code changes

```bash
git add .
git commit -m "Update"
git push origin main
# Render auto-deploys on every push to main ✅
```

---

## Checking logs

Render Dashboard → your service → **"Logs"** tab.
Or install the Render CLI:
```bash
npm install -g @render/cli
render logs github-analyzer-api --tail
```

---

## Custom domain (optional)

Render Dashboard → your service → **"Settings"** → **"Custom Domains"** → add your domain → update your DNS CNAME record.
