# Deploying to Render (Free Tier)

This guide gets you live in ~10 minutes using:
- **Render** — hosts the Node.js API (free)
- **PlanetScale** — hosts the MySQL database (free serverless tier)

---

## Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/github-analyzer.git
git push -u origin main
```

---

## Step 2 — Set up a free MySQL database on PlanetScale

1. Go to [planetscale.com](https://planetscale.com) and create a free account.
2. Click **"Create a database"** → name it `github-analyzer` → choose a region close to `oregon` (Render default).
3. Once created, click **"Connect"** → choose **"Connect with: Node.js"**.
4. Copy these four values — you'll need them shortly:
   ```
   Host:     xxxxxxxxx.us-east.psdb.cloud
   Username: xxxxxxxxxxxxxxxxx
   Password: <your-planetscale-password>
   Database: github-analyzer
   ```
5. **Important:** PlanetScale uses a branch model. Your `main` branch is your production DB.
   The tables are created **automatically** when the server first boots.

> **Free tier limits:** 5 GB storage, 1 billion row reads/month — more than enough.

---

## Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub account and select the `github-analyzer` repo.
3. Render will auto-detect the `render.yaml` blueprint. Confirm the settings:
   - **Name:** `github-analyzer-api`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Free
4. Click **"Advanced"** → **"Add Environment Variable"** and fill in:

   | Key | Value |
   |-----|-------|
   | `DB_HOST` | (PlanetScale host from Step 2) |
   | `DB_USER` | (PlanetScale username) |
   | `DB_PASSWORD` | (PlanetScale password) |
   | `DB_NAME` | `github-analyzer` |
   | `DB_PORT` | `3306` |
   | `DB_SSL` | `true` |
   | `GITHUB_TOKEN` | (your GitHub PAT — optional but recommended) |
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
| **Spin-down** | Free services sleep after 15 min of inactivity. First request after sleep takes ~30 sec. The built-in keep-alive pinger mitigates this. |
| **Build minutes** | 500 free build minutes/month (each deploy uses ~1–2 min) |
| **Bandwidth** | 100 GB/month |
| **GitHub API** | Without `GITHUB_TOKEN`: 60 req/hr. With token: 5000 req/hr |

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
