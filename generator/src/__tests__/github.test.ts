import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getGithubSnapshot, computeStreak } from "../data/github.js";
import { CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";

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

const cfg: Config = { githubToken: "t", githubLogin: "ReaperOAK", openRouter: null, wakatimeEnabled: false };

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
              { message: "feat: add billing ledger" }, { message: "fix: webhook replay" }] } } } }] },
        },
      },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.totalContributions).toBe(1234);
    expect(snap.recentCommitMessages).toContain("feat: add billing ledger");
  });

  it("never throws on network error; returns a zeroed snapshot when no cache", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.totalContributions).toBe(0);
    expect(Array.isArray(snap.recentCommitMessages)).toBe(true);
  });

  it("returns a zeroed snapshot (not a throw) when token is null", async () => {
    const snap = await getGithubSnapshot({ ...cfg, githubToken: null });
    expect(snap.totalContributions).toBe(0);
  });
});
