import { describe, it, expect } from "vitest";
import { rankRepos, scoreRepo } from "../data/ranking.js";
import type { RepoNode } from "../types.js";

const repo = (over: Partial<RepoNode> = {}): RepoNode => ({
  name: "r", url: "https://github.com/ReaperOAK/r", description: "does a thing",
  homepageUrl: null, stars: 0, forks: 0, pushedAt: "2026-09-06T00:00:00Z",
  isFork: false, isArchived: false, commitsLastYear: 10,
  languages: [{ name: "TypeScript", color: "#3178c6", size: 1000 }], ...over,
});

const TODAY = "2026-09-06T00:00:00Z";
const ctx = { todayISO: TODAY, maxCommits: 400, maxReach: 5 };

describe("scoreRepo", () => {
  it("scores a fork at zero", () => {
    expect(scoreRepo(repo({ isFork: true }), ctx)).toBe(0);
  });

  it("scores an archived repo at zero", () => {
    expect(scoreRepo(repo({ isArchived: true }), ctx)).toBe(0);
  });

  it("ranks a recently pushed repo above an identical stale one", () => {
    const fresh = scoreRepo(repo({ pushedAt: "2026-09-05T00:00:00Z" }), ctx);
    const stale = scoreRepo(repo({ pushedAt: "2025-09-05T00:00:00Z" }), ctx);
    expect(fresh).toBeGreaterThan(stale);
  });

  it("rewards a homepage and a description over a bare repo", () => {
    const full = scoreRepo(repo({ homepageUrl: "https://x.com", description: "d" }), ctx);
    const bare = scoreRepo(repo({ homepageUrl: null, description: null }), ctx);
    expect(full).toBeGreaterThan(bare);
  });

  it("lets recency outweigh stars", () => {
    const freshNoStars = scoreRepo(repo({ pushedAt: "2026-09-06T00:00:00Z", stars: 0 }), ctx);
    const staleStarred = scoreRepo(repo({ pushedAt: "2024-09-06T00:00:00Z", stars: 5 }), ctx);
    expect(freshNoStars).toBeGreaterThan(staleStarred);
  });

  // NaN guard tests
  it("returns a finite score even when pushedAt is unparseable", () => {
    const score = scoreRepo(repo({ pushedAt: "invalid-date" }), ctx);
    expect(isFinite(score)).toBe(true);
  });

  it("returns a finite score even when todayISO is unparseable", () => {
    const score = scoreRepo(repo(), { todayISO: "invalid-date", maxCommits: 400, maxReach: 5 });
    expect(isFinite(score)).toBe(true);
  });

  // norm() guard tests — direct scoreRepo callers can pass an arbitrary ctx or RepoNode,
  // so norm must be correct (not merely finite downstream) for every value it can see.
  it("treats a non-positive maxCommits as zero commit volume", () => {
    // recency=1 (pushedAt===TODAY), completeness=2/3 (description+languages, no homepage),
    // reach=norm(0,5)=0 -> only the 0.20*completeness term survives when volume=0.
    const score = scoreRepo(repo(), { ...ctx, maxCommits: 0 });
    expect(score).toBeCloseTo(8 / 15, 10);
  });

  it("treats a non-finite maxCommits as zero commit volume", () => {
    const score = scoreRepo(repo(), { ...ctx, maxCommits: NaN });
    expect(score).toBeCloseTo(8 / 15, 10);
  });

  it("treats a non-finite commitsLastYear as zero commit volume", () => {
    const score = scoreRepo(repo({ commitsLastYear: NaN }), ctx);
    expect(score).toBeCloseTo(8 / 15, 10);
  });
});

describe("rankRepos", () => {
  it("drops forks and archived repos entirely", () => {
    const out = rankRepos([
      repo({ name: "fork", isFork: true }),
      repo({ name: "arch", isArchived: true }),
      repo({ name: "real" }),
    ], { todayISO: TODAY, pins: [], blocks: [] });
    expect(out.map((r) => r.name)).toEqual(["real"]);
  });

  it("puts pinned repos first regardless of score", () => {
    const out = rankRepos([
      repo({ name: "hot", pushedAt: "2026-09-06T00:00:00Z", commitsLastYear: 400 }),
      repo({ name: "cold", pushedAt: "2024-01-01T00:00:00Z", commitsLastYear: 1 }),
    ], { todayISO: TODAY, pins: ["cold"], blocks: [] });
    expect(out[0]!.name).toBe("cold");
  });

  it("removes blocked repos", () => {
    const out = rankRepos([repo({ name: "keep" }), repo({ name: "drop" })],
      { todayISO: TODAY, pins: [], blocks: ["drop"] });
    expect(out.map((r) => r.name)).toEqual(["keep"]);
  });

  it("honours the limit", () => {
    const repos = ["a", "b", "c", "d"].map((name) => repo({ name }));
    expect(rankRepos(repos, { todayISO: TODAY, pins: [], blocks: [], limit: 2 })).toHaveLength(2);
  });

  it("returns an empty list when limit is zero", () => {
    const repos = ["a", "b"].map((name) => repo({ name }));
    expect(rankRepos(repos, { todayISO: TODAY, pins: [], blocks: [], limit: 0 })).toEqual([]);
  });

  it("uses an empty description when the repo has none", () => {
    const out = rankRepos([repo({ name: "bare", description: null })],
      { todayISO: TODAY, pins: [], blocks: [] });
    expect(out[0]!.description).toBe("");
  });

  it("builds the stack string from the top languages", () => {
    const out = rankRepos([repo({ languages: [
      { name: "TypeScript", color: "#3178c6", size: 900 },
      { name: "Shell", color: "#89e051", size: 100 },
    ] })], { todayISO: TODAY, pins: [], blocks: [] });
    expect(out[0]!.stack).toBe("TypeScript · Shell");
  });

  it("returns an empty list for no input rather than throwing", () => {
    expect(rankRepos([], { todayISO: TODAY, pins: [], blocks: [] })).toEqual([]);
  });

  it("returns a finite score for all results", () => {
    const out = rankRepos([repo()], { todayISO: TODAY, pins: [], blocks: [] });
    expect(out.length).toBe(1);
    expect(isFinite(out[0]!.score)).toBe(true);
  });
});
