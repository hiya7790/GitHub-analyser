/**
 * Compute all derived insights from raw GitHub user + repo data.
 * Pure functions – no DB or HTTP calls here.
 */

/**
 * Build language frequency map from repos
 * @param {Array} repos
 * @returns {{ langMap: Object, topLanguage: string|null }}
 */
function computeLanguageStats(repos) {
  const langMap = {};

  for (const repo of repos) {
    if (repo.language && !repo.fork) {
      langMap[repo.language] = (langMap[repo.language] || 0) + 1;
    }
  }

  const sorted = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
  const topLanguage = sorted.length > 0 ? sorted[0][0] : null;
  const total = sorted.reduce((s, [, c]) => s + c, 0);

  // Attach percentage
  const langStats = sorted.map(([language, count]) => ({
    language,
    repo_count: count,
    percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
  }));

  return { langMap, langStats, topLanguage };
}

/**
 * Compute engagement score (0–100 scale, opinionated formula)
 *
 * Weights:
 *   30 % – followers (log-scaled)
 *   25 % – total stars
 *   20 % – total forks
 *   15 % – public repos (activity breadth)
 *   10 % – account age (maturity)
 */
function computeEngagementScore({ followers, totalStars, totalForks, publicRepos, accountAgeDays }) {
  const logScale = (v, cap = 10000) => Math.min(Math.log10(v + 1) / Math.log10(cap + 1), 1);
  const linearScale = (v, cap) => Math.min(v / cap, 1);

  const followerScore  = logScale(followers, 10000)   * 30;
  const starScore      = logScale(totalStars, 5000)   * 25;
  const forkScore      = logScale(totalForks, 1000)   * 20;
  const repoScore      = linearScale(publicRepos, 50) * 15;
  const ageScore       = linearScale(accountAgeDays, 3650) * 10; // 10 yr cap

  return parseFloat((followerScore + starScore + forkScore + repoScore + ageScore).toFixed(2));
}

/**
 * Derive all insights from a raw GitHub profile + repos array.
 * Returns a clean object ready to be persisted.
 */
function analyzeProfile(githubUser, repos) {
  const now = new Date();
  const createdAt = new Date(githubUser.created_at);
  const accountAgeDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

  // Aggregate repo metrics (exclude forks for cleaner numbers)
  const ownRepos = repos.filter((r) => !r.fork);
  const totalStars    = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks    = repos.reduce((s, r) => s + r.forks_count, 0);
  const totalWatchers = repos.reduce((s, r) => s + r.watchers_count, 0);
  const avgStars  = ownRepos.length ? parseFloat((totalStars  / ownRepos.length).toFixed(2)) : 0;
  const avgForks  = ownRepos.length ? parseFloat((totalForks  / ownRepos.length).toFixed(2)) : 0;

  const { langStats, topLanguage } = computeLanguageStats(repos);

  const engagementScore = computeEngagementScore({
    followers: githubUser.followers,
    totalStars,
    totalForks,
    publicRepos: githubUser.public_repos,
    accountAgeDays,
  });

  // Top 30 repos sorted by stars
  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 30)
    .map((r) => ({
      repo_name:        r.name,
      full_name:        r.full_name,
      description:      r.description || null,
      language:         r.language || null,
      stars:            r.stargazers_count,
      forks:            r.forks_count,
      watchers:         r.watchers_count,
      open_issues:      r.open_issues_count,
      is_fork:          r.fork,
      is_archived:      r.archived,
      topics:           r.topics || [],
      repo_url:         r.html_url,
      homepage:         r.homepage || null,
      github_created_at: r.created_at,
      github_updated_at: r.updated_at,
      github_pushed_at:  r.pushed_at,
    }));

  return {
    profile: {
      username:          githubUser.login,
      name:              githubUser.name || null,
      bio:               githubUser.bio  || null,
      company:           githubUser.company || null,
      location:          githubUser.location || null,
      blog:              githubUser.blog || null,
      email:             githubUser.email || null,
      twitter_username:  githubUser.twitter_username || null,
      avatar_url:        githubUser.avatar_url,
      github_url:        githubUser.html_url,

      public_repos:      githubUser.public_repos,
      public_gists:      githubUser.public_gists,
      followers:         githubUser.followers,
      following:         githubUser.following,

      total_stars:       totalStars,
      total_forks:       totalForks,
      total_watchers:    totalWatchers,
      avg_stars:         avgStars,
      avg_forks:         avgForks,
      top_language:      topLanguage,
      languages_used:    JSON.stringify(langStats.map((l) => l.language)),

      account_age_days:  accountAgeDays,
      engagement_score:  engagementScore,

      is_hireable:       !!githubUser.hireable,
      site_admin:        !!githubUser.site_admin,

      github_created_at: new Date(githubUser.created_at),
      github_updated_at: new Date(githubUser.updated_at),
    },
    langStats,
    topRepos,
  };
}

module.exports = { analyzeProfile, computeLanguageStats, computeEngagementScore };
