import type { RankedRepo, RepoNode } from "../types.js";

export interface ScoreContext { todayISO: string; maxCommits: number; maxReach: number; }
export interface RankOptions { todayISO: string; pins: string[]; blocks: string[]; limit?: number; }

// exp(-days / N): N is the decay time constant, not the half-life (half-life = N * ln2 ≈ 62 days at N=90).
const RECENCY_DECAY_DAYS = 90;

/** log1p scaled to 0..1 against the largest value in the candidate set. */
function norm(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Math.log1p(v) / Math.log1p(max);
}

/**
 * 0.40 recency + 0.25 sustained commits + 0.20 completeness + 0.15 reach.
 * Forks and archived repos score 0 and are dropped by rankRepos.
 */
export function scoreRepo(r: RepoNode, ctx: ScoreContext): number {
  if (r.isFork || r.isArchived) return 0;

  // Guard against unparseable dates returning NaN — treat as score 0
  const todayMs = Date.parse(ctx.todayISO);
  const pushedAtMs = Date.parse(r.pushedAt);
  if (!isFinite(todayMs) || !isFinite(pushedAtMs)) return 0;

  const days = Math.max(0, (todayMs - pushedAtMs) / 86_400_000);
  const recency = Math.exp(-days / RECENCY_DECAY_DAYS);
  const volume = norm(r.commitsLastYear, ctx.maxCommits);
  const completeness =
    ((r.description ? 1 : 0) + (r.homepageUrl ? 1 : 0) + (r.languages.length > 0 ? 1 : 0)) / 3;
  const reach = norm(r.stars + r.forks, ctx.maxReach);

  return 0.40 * recency + 0.25 * volume + 0.20 * completeness + 0.15 * reach;
}

export function rankRepos(repos: RepoNode[], opts: RankOptions): RankedRepo[] {
  const blocked = new Set(opts.blocks);
  const pinned = new Set(opts.pins);
  const candidates = repos.filter((r) => !r.isFork && !r.isArchived && !blocked.has(r.name));
  if (candidates.length === 0) return [];

  const ctx: ScoreContext = {
    todayISO: opts.todayISO,
    maxCommits: Math.max(1, ...candidates.map((r) => r.commitsLastYear)),
    maxReach: Math.max(1, ...candidates.map((r) => r.stars + r.forks)),
  };

  const ranked = candidates
    .map((r) => ({
      name: r.name,
      url: r.url,
      description: r.description ?? "",
      stack: r.languages.slice(0, 3).map((l) => l.name).join(" · "),
      score: scoreRepo(r, ctx),
      pinned: pinned.has(r.name),
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.score - a.score;
    })
    .map(({ pinned: _pinned, ...rest }) => rest);

  return opts.limit === undefined ? ranked : ranked.slice(0, opts.limit);
}
