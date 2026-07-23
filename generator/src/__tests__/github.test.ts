import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getGithubSnapshot } from "../data/github.js";
import { CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";

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
