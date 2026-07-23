import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getDynamicFields, sanitizeLine } from "../llm/prompts.js";
import { content } from "../content.js";
import { CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";
import type { GithubSnapshot } from "../types.js";

const snap: GithubSnapshot = { recentCommitMessages: ["feat: ledger"], totalContributions: 5, currentStreakDays: 2 };

// Isolate each test from last-good cache so the fallback path is exercised deterministically.
beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

describe("sanitizeLine", () => {
  it("rejects empty and over-length", () => {
    expect(sanitizeLine("", 100)).toBeNull();
    expect(sanitizeLine("x".repeat(500), 100)).toBeNull();
  });
  it("rejects banned phrases and markdown-breaking chars", () => {
    expect(sanitizeLine("I am a passionate developer", 100)).toBeNull();
    expect(sanitizeLine("has a ``` fence", 100)).toBeNull();
  });
  it("accepts and trims a clean line", () => {
    expect(sanitizeLine("  Shipping fail-closed billing.  ", 100)).toBe("Shipping fail-closed billing.");
  });
});

describe("getDynamicFields", () => {
  it("returns static fallbacks when OpenRouter is disabled", async () => {
    const cfg: Config = { githubToken: null, githubLogin: "ReaperOAK", openRouter: null, wakatimeEnabled: false };
    const out = await getDynamicFields(cfg, snap);
    expect(out.tagline).toBe(content.fallback.tagline);
    expect(out.thinkingAbout).toBe(content.fallback.thinkingAbout);
  });

  it("uses LLM output when valid, falls back per-field when invalid", async () => {
    const cfg: Config = { githubToken: null, githubLogin: "ReaperOAK",
      openRouter: { key: "k", model: "m" }, wakatimeEnabled: false };
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Building calm systems." } }] })))
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "passionate ninja rockstar" } }] })));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe("Building calm systems.");
    expect(out.recentWork).toBe(content.fallback.recentWork);
  });

  it("never throws on network error", async () => {
    const cfg: Config = { githubToken: null, githubLogin: "ReaperOAK",
      openRouter: { key: "k", model: "m" }, wakatimeEnabled: false };
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe(content.fallback.tagline);
  });
});
