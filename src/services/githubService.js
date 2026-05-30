const axios = require("axios");

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Build axios instance with default headers
const githubClient = axios.create({
  baseURL: GITHUB_API_BASE,
  timeout: 15000,
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
  },
});

// Response interceptor for cleaner error messages
githubClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response) {
      const { status, data } = err.response;
      const msg = data?.message || "GitHub API error";
      const error = new Error(msg);
      error.status = status;
      error.githubError = true;
      if (status === 403 && msg.includes("rate limit")) {
        error.message =
          "GitHub API rate limit exceeded. Add a GITHUB_TOKEN in .env to raise the limit to 5000 req/hr.";
      }
      throw error;
    }
    throw err;
  }
);

/**
 * Fetch a user's public profile
 * @param {string} username
 */
async function fetchUserProfile(username) {
  const { data } = await githubClient.get(`/users/${username}`);
  return data;
}

/**
 * Fetch all public repositories for a user (handles pagination)
 * @param {string} username
 * @param {number} maxRepos – cap to avoid very large accounts
 */
async function fetchUserRepos(username, maxRepos = 100) {
  const repos = [];
  let page = 1;
  const perPage = 100;

  while (repos.length < maxRepos) {
    const { data } = await githubClient.get(`/users/${username}/repos`, {
      params: {
        type: "owner",
        sort: "updated",
        direction: "desc",
        per_page: perPage,
        page,
      },
    });

    if (!data.length) break;
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos.slice(0, maxRepos);
}

/**
 * Check current rate-limit status (useful for debugging)
 */
async function fetchRateLimit() {
  const { data } = await githubClient.get("/rate_limit");
  return data.resources.core;
}

module.exports = { fetchUserProfile, fetchUserRepos, fetchRateLimit };
