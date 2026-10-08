import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getDynamicFields, sanitizeLine, sanitizeBullets } from "../llm/prompts.js";
import { content } from "../content.js";
import { CACHE_DIR, writeCache } from "../cache.js";
import type { Config } from "../config.js";
import { FIXTURE } from "./fixtures.js";

const snap = FIXTURE.github;

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
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK", llm: null,
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const out = await getDynamicFields(cfg, snap);
    expect(out.tagline).toBe(content.fallback.tagline);
    expect(out.thinkingAbout).toBe(content.fallback.thinkingAbout);
  });

  it("uses LLM output when valid, falls back per-field when invalid", async () => {
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Building calm systems." } }] })))
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "passionate ninja rockstar" } }] })));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe("Building calm systems.");
    expect(out.recentWork).toBe(content.fallback.recentWork);
  });

  it("falls through the model chain: first model fails, second returns valid", async () => {
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["bad/model:free", "good/model:free"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    // Odd calls (first model) 404; even calls (second model) succeed.
    let n = 0;
    const fake = vi.fn().mockImplementation(async () => {
      n++;
      return n % 2 === 1
        ? new Response("nope", { status: 404 })
        : new Response(JSON.stringify({ choices: [{ message: { content: "From the second model." } }] }));
    });
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe("From the second model.");
  });

  it("never throws on network error", async () => {
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe(content.fallback.tagline);
  });

  // Defect fix 1: the committed cache predates engineeringLog. A bare JSON.parse would hand
  // back `undefined` for the missing field, and logPanel.select does `.length` on it — this
  // exact bug class crashed two panels in Task 7.
  it("normalises a stale on-disk cache missing engineeringLog rather than crashing", async () => {
    writeCache("dynamic-fields", {
      tagline: "Old tagline", recentWork: "Old work", thinkingAbout: "Old thought", featuredBlurbs: {},
    });
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const fake = vi.fn().mockRejectedValue(new Error("down")); // force the cache-fallback path
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.engineeringLog).toEqual([]);
    expect(() => out.engineeringLog.length).not.toThrow();
    expect(out.tagline).toBe("Old tagline"); // still-valid fields from the old cache survive
  });

  it("falls back per-field, independently, when the cache has wrong types", async () => {
    writeCache("dynamic-fields", {
      tagline: 123,
      recentWork: null,
      thinkingAbout: "a genuinely valid cached thought",
      engineeringLog: ["fine", 5, "also fine"], // one bad element invalidates the whole array
      featuredBlurbs: "not an object",
    });
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe(content.fallback.tagline);
    expect(out.recentWork).toBe(content.fallback.recentWork);
    expect(out.thinkingAbout).toBe("a genuinely valid cached thought");
    expect(out.engineeringLog).toEqual(content.fallback.engineeringLog);
  });

  // Defect fix 2: the daily bot commit was 5 of the last 12 in the tracked cache and would
  // otherwise dominate what the model is asked to summarise.
  it("excludes [skip ci] bot commits from every prompt that reads commit history", async () => {
    const snapWithBot = { ...snap, recentCommitMessages: [
      "feat: real work landed", "chore: refresh profile README [skip ci]", "fix: another real thing",
    ] };
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const bodies: string[] = [];
    const fake = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      bodies.push(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Shipped a real fix." } }] }));
    });
    await getDynamicFields(cfg, snapWithBot, fake as unknown as typeof fetch);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((b) => b.includes("[skip ci]"))).toBe(false);
    expect(bodies.some((b) => b.includes("real work landed"))).toBe(true);
  });

  it("writes the engineering log from valid LLM bullets", async () => {
    const cfg: Config = {
      githubToken: null, githubLogin: "ReaperOAK",
      llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
      wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
    };
    const bullets = "- Shipped the telemetry canvas\n- Hardened readme validation\n- Fixed the log panel crash";
    const fake = vi.fn()
      // tagline, recentWork, thinkingAbout each get one call
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "A tagline." } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "This week: shipped." } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "A thought." } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: bullets } }] })));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.engineeringLog).toEqual([
      "Shipped the telemetry canvas", "Hardened readme validation", "Fixed the log panel crash",
    ]);
  });
});

describe("sanitizeBullets", () => {
  it("returns [] for a null or empty reply", () => {
    expect(sanitizeBullets(null, 5, 120)).toEqual([]);
    expect(sanitizeBullets("", 5, 120)).toEqual([]);
  });

  it("strips bullet characters and numbering", () => {
    expect(sanitizeBullets("- Shipped X\n* Shipped Y\n1. Shipped Z", 5, 120))
      .toEqual(["Shipped X", "Shipped Y", "Shipped Z"]);
  });

  it("rejects lines with injected links or HTML", () => {
    const out = sanitizeBullets("Shipped X\n[click me](http://evil.com)\n<b>bold</b>\nVisit http://evil.com today", 5, 120);
    expect(out).toEqual(["Shipped X"]);
  });

  it("rejects banned hype phrases and code fences", () => {
    const out = sanitizeBullets("A passionate rewrite\nHad a ``` fence\nA clean line", 5, 120);
    expect(out).toEqual(["A clean line"]);
  });

  it("caps at max and drops over-length lines", () => {
    const long = "x".repeat(200);
    const out = sanitizeBullets(`one\ntwo\nthree\n${long}\nfour`, 3, 120);
    expect(out).toEqual(["one", "two", "three"]);
  });
});
