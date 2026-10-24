import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getGithubSnapshot, computeStreak } from "../data/github.js";
import { CACHE_DIR, writeCache } from "../cache.js";
import type { Config } from "../config.js";
import type { GithubSnapshot } from "../types.js";

describe("computeStreak", () => {
  const week = (days: Array<[string, number]>) => ({ contributionDays: days.map(([date, contributionCount]) => ({ date, contributionCount })) });
  it("does not break the streak when today has no commits yet", () => {
    // today = 2026-07-29 with 0; the three prior days are active.
    const weeks = [week([["2026-07-26", 3], ["2026-07-27", 1], ["2026-07-28", 2], ["2026-07-29", 0]])];
    expect(computeStreak(weeks, "2026-07-29")).toBe(3);
  });
  it("counts today when today is active", () => {
    const weeks = [week([["2026-07-27", 1], ["2026-07-28", 2], ["2026-07-29", 5]])];
    expect(computeStreak(weeks, "2026-07-29")).toBe(3);
  });
  it("returns 0 when yesterday was also empty", () => {
    const weeks = [week([["2026-07-27", 4], ["2026-07-28", 0], ["2026-07-29", 0]])];
    expect(computeStreak(weeks, "2026-07-29")).toBe(0);
  });
  it("ignores future-dated padding days in the current week", () => {
    const weeks = [week([["2026-07-28", 2], ["2026-07-29", 1], ["2026-07-30", 0], ["2026-07-31", 0]])];
    expect(computeStreak(weeks, "2026-07-29")).toBe(2);
  });
});

const cfg: Config = {
  githubToken: "t", githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};

// Isolate each test from last-good cache so the no-cache fallback paths are deterministic.
beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("getGithubSnapshot", () => {
  it("parses a successful GraphQL response", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: { totalContributions: 1234,
              weeks: [{ contributionDays: [{ contributionCount: 1, date: "2026-07-20" }] }] },
          },
          repositories: { nodes: [
            { defaultBranchRef: { target: { history: { nodes: [
              { message: "feat: add rate limiter" }, { message: "fix: webhook replay" }] } } } }] },
        },
      },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.totalContributions).toBe(1234);
    expect(snap.recentCommitMessages).toContain("feat: add rate limiter");
  });

  it("never throws on network error; returns a zeroed snapshot when no cache", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.totalContributions).toBe(0);
    expect(Array.isArray(snap.recentCommitMessages)).toBe(true);
  });

  it("never re-stamps fetchedAt on a failed fetch — the sync stamp never lies", async () => {
    // Seed the cache directly (bypassing a real fetch) with a snapshot whose fetchedAt
    // is unmistakably old, so an accidental re-stamp in the catch block is obvious.
    const cached: GithubSnapshot = {
      recentCommitMessages: ["cached: prior message"], totalContributions: 42, currentStreakDays: 3,
      commits: 10, prs: 2, reviews: 1, issues: 0, calendar: [], repos: [],
      fetchedAt: "2020-01-01T00:00:00.000Z",
    };
    // "github-snapshot" mirrors the private CACHE_KEY inside data/github.ts — not exported,
    // so the test seeds the same on-disk key by name (as cache.test.ts does for its own keys).
    writeCache("github-snapshot", cached);
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.fetchedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(snap.totalContributions).toBe(42); // a second field confirms the whole cached snapshot survived, not just fetchedAt
  });

  it("returns a zeroed snapshot (not a throw) when token is null", async () => {
    const snap = await getGithubSnapshot({ ...cfg, githubToken: null });
    expect(snap.totalContributions).toBe(0);
  });

  it("flattens the calendar and populates contribution counters", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 900,
          totalPullRequestContributions: 60,
          totalPullRequestReviewContributions: 30,
          totalIssueContributions: 12,
          contributionCalendar: { totalContributions: 1002, weeks: [
            { contributionDays: [{ contributionCount: 1, date: "2026-07-20" }, { contributionCount: 4, date: "2026-07-21" }] },
          ] },
        },
        repositories: { nodes: [] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.commits).toBe(900);
    expect(snap.prs).toBe(60);
    expect(snap.reviews).toBe(30);
    expect(snap.issues).toBe(12);
    expect(snap.calendar).toEqual([
      { date: "2026-07-20", count: 1 }, { date: "2026-07-21", count: 4 },
    ]);
  });

  it("maps repository nodes including languages and commit counts", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 0, totalPullRequestContributions: 0,
          totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
          contributionCalendar: { totalContributions: 0, weeks: [] },
        },
        repositories: { nodes: [{
          name: "todayeggrates", url: "https://github.com/ReaperOAK/todayeggrates",
          description: "egg rates", homepageUrl: "https://todayeggrates.com/",
          stargazerCount: 0, forkCount: 1, pushedAt: "2026-09-06T04:00:05Z",
          isFork: false, isArchived: false,
          languages: { edges: [{ size: 802240, node: { name: "JavaScript", color: "#f1e05a" } }] },
          defaultBranchRef: { target: { history: { totalCount: 412, nodes: [{ message: "fix: rate parser" }] } } },
        }] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.repos).toHaveLength(1);
    expect(snap.repos[0]!.commitsLastYear).toBe(412);
    expect(snap.repos[0]!.homepageUrl).toBe("https://todayeggrates.com/");
    expect(snap.repos[0]!.languages[0]).toEqual({ name: "JavaScript", color: "#f1e05a", size: 802240 });
    expect(snap.recentCommitMessages).toContain("fix: rate parser");
  });

  it("stamps fetchedAt on a live fetch", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 0, totalPullRequestContributions: 0,
          totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
          contributionCalendar: { totalContributions: 0, weeks: [] },
        },
        repositories: { nodes: [] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(Date.parse(snap.fetchedAt)).toBeGreaterThan(Date.parse("2026-01-01"));
  });

  it("survives a repo whose defaultBranchRef is null", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 0, totalPullRequestContributions: 0,
          totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
          contributionCalendar: { totalContributions: 0, weeks: [] },
        },
        repositories: { nodes: [{
          name: "empty", url: "u", description: null, homepageUrl: null,
          stargazerCount: 0, forkCount: 0, pushedAt: "2026-01-01T00:00:00Z",
          isFork: false, isArchived: false, languages: { edges: [] }, defaultBranchRef: null,
        }] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.repos[0]!.commitsLastYear).toBe(0);
  });

  it("normalises an old-schema cache (missing new fields) on a failed fetch", async () => {
    // Mirrors the actual key set of the tracked generator/.cache/github-snapshot.json,
    // written before Task 4 widened GithubSnapshot with the commits/prs/reviews/issues/
    // calendar/repos/fetchedAt fields.
    const oldSchema = {
      recentCommitMessages: ["chore: refresh profile README [skip ci]"],
      totalContributions: 9985,
      currentStreakDays: 9,
    };
    writeCache("github-snapshot", oldSchema);
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.calendar).toEqual([]);
    expect(snap.repos).toEqual([]);
    expect(Number.isFinite(snap.commits)).toBe(true);
    expect(Number.isFinite(snap.prs)).toBe(true);
    expect(Number.isFinite(snap.reviews)).toBe(true);
    expect(Number.isFinite(snap.issues)).toBe(true);
    expect(snap.currentStreakDays).toBe(9); // cached value survives, not dropped to EMPTY
  });

  it("normalises the same old-schema cache on the no-token path", async () => {
    const oldSchema = {
      recentCommitMessages: ["chore: refresh profile README [skip ci]"],
      totalContributions: 9985,
      currentStreakDays: 9,
    };
    writeCache("github-snapshot", oldSchema);
    const snap = await getGithubSnapshot({ ...cfg, githubToken: null });
    expect(snap.calendar).toEqual([]);
    expect(snap.repos).toEqual([]);
    expect(snap.commits).toBe(0);
    expect(snap.currentStreakDays).toBe(9);
  });

  it("falls back to EMPTY values for wrong-typed cached fields", async () => {
    writeCache("github-snapshot", {
      recentCommitMessages: ["ok"],
      totalContributions: 10,
      currentStreakDays: 2,
      commits: "12",
      prs: 0,
      reviews: 0,
      issues: 0,
      calendar: "oops",
      repos: [],
      fetchedAt: "2021-01-01T00:00:00.000Z",
    });
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.commits).toBe(0); // wrong type (a string) falls back to EMPTY.commits
    expect(snap.calendar).toEqual([]); // wrong type (a string) falls back to EMPTY.calendar
    expect(snap.currentStreakDays).toBe(2); // a validly-typed field still survives
    expect(snap.fetchedAt).toBe("2021-01-01T00:00:00.000Z"); // validly-typed field survives
  });
});
