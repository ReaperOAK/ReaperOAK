import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getDynamicFields, sanitizeLine, sanitizeBullets } from "../llm/prompts.js";
import { content } from "../content.js";
import { CACHE_DIR, writeCache } from "../cache.js";
import type { Config } from "../config.js";
import { FIXTURE, LLM_CONFIG } from "./fixtures.js";

const snap = FIXTURE.github;

const reply = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }));

/** Answers the engineering-log request with `bullets` and every other request with a clean
 *  line. Records each request body so a test can see exactly what the model was asked. */
function llmFake(bullets: string, bodies: string[] = []) {
  return vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
    bodies.push(init.body);
    return reply(init.body.includes("bullet lines") ? bullets : "A fine sentence.");
  });
}

const VALID_CACHE = {
  tagline: "Cached tagline", recentWork: "This week: cached work.", thinkingAbout: "Cached thought",
  engineeringLog: ["Shipped cache A", "Shipped cache B", "Shipped cache C"], featuredBlurbs: {},
};

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
  it("rejects a line that would trip README validation", () => {
    expect(sanitizeLine("NaN is the new tagline", 100)).toBeNull();
    expect(sanitizeLine("Hello {{ name }}", 100)).toBeNull();
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

describe("getDynamicFields cache and gating", () => {
  it("keeps a valid cached engineeringLog when the LLM fails", async () => {
    writeCache("dynamic-fields", VALID_CACHE);
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(LLM_CONFIG, snap, fake as unknown as typeof fetch);
    expect(out.engineeringLog).toEqual(VALID_CACHE.engineeringLog);
  });

  it("keeps a valid cached recentWork when the LLM fails", async () => {
    writeCache("dynamic-fields", VALID_CACHE);
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(LLM_CONFIG, snap, fake as unknown as typeof fetch);
    expect(out.recentWork).toBe(VALID_CACHE.recentWork);
  });

  it("falls back to the cached log when the model returns fewer than 3 valid bullets", async () => {
    writeCache("dynamic-fields", VALID_CACHE);
    const out = await getDynamicFields(LLM_CONFIG, snap, llmFake("- Shipped one\n- Shipped two") as unknown as typeof fetch);
    expect(out.engineeringLog).toEqual(VALID_CACHE.engineeringLog);
  });

  it("does not trust cached strings that would trip README validation", async () => {
    writeCache("dynamic-fields", {
      ...VALID_CACHE,
      tagline: "NaN is not a tagline",
      engineeringLog: ["Shipped A", "Fixed NaN propagation", "Shipped C"],
    });
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(LLM_CONFIG, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe(content.fallback.tagline);
    expect(out.engineeringLog).toEqual(content.fallback.engineeringLog);
    expect(out.thinkingAbout).toBe(VALID_CACHE.thinkingAbout); // the clean fields survive
  });

  // Handed "no recent commits" the model invents bullets. With nothing real to summarise,
  // neither commit-derived field is generated; the cached values stand.
  it.each([
    ["only bot commits", ["chore: refresh profile README [skip ci]"]],
    ["no commits at all", []],
  ])("does not ask the model to summarise commits when there are %s", async (_label, msgs) => {
    writeCache("dynamic-fields", VALID_CACHE);
    const bodies: string[] = [];
    const fake = llmFake("- Invented one\n- Invented two\n- Invented three", bodies);
    const out = await getDynamicFields(LLM_CONFIG, { ...snap, recentCommitMessages: msgs }, fake as unknown as typeof fetch);
    expect(bodies).toHaveLength(2); // tagline + thinkingAbout only
    expect(bodies.some((b) => b.includes("commit messages"))).toBe(false);
    expect(bodies.some((b) => b.includes("no recent commits"))).toBe(false);
    expect(out.engineeringLog).toEqual(VALID_CACHE.engineeringLog);
    expect(out.recentWork).toBe(VALID_CACHE.recentWork);
  });

  it("with no commits and no cache, recentWork is the static fallback and the log is empty", async () => {
    const out = await getDynamicFields(LLM_CONFIG, { ...snap, recentCommitMessages: [] }, llmFake("- a\n- b\n- c") as unknown as typeof fetch);
    expect(out.recentWork).toBe(content.fallback.recentWork);
    expect(out.engineeringLog).toEqual([]);
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

  it.each([
    "Fixed NaN propagation",
    "Guarded against undefined fields",
    "Fixed {{ }} interpolation",
    "Why undefined is not a function",
    "Capped the Infinity retry loop",
    "Rendered [object Object] in the log",
  ])("drops a line that would trip README validation: %s", (line) => {
    expect(sanitizeBullets(`Shipped X\n${line}`, 5, 120)).toEqual(["Shipped X"]);
  });

  it.each([
    "3 retries added to the queue",
    "10x faster cold starts",
    "99.9% uptime held through the migration",
    "**Shipped** the importer",
    "-5% p99 latency on search",
  ])("does not mangle a real line that starts with a digit or asterisk: %s", (line) => {
    expect(sanitizeBullets(line, 5, 120)).toEqual([line]);
  });

  it("strips only real bullet markers", () => {
    expect(sanitizeBullets("  - A\n* B\n• C\n1. D\n2) E", 9, 120)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("drops a preamble line that ends in a colon", () => {
    expect(sanitizeBullets("Here are the bullets:\n- Shipped A\n- Shipped B", 5, 120)).toEqual(["Shipped A", "Shipped B"]);
  });

  it("drops a markdown link even when it has no url scheme", () => {
    expect(sanitizeBullets("Shipped X\nUpdated [notes](#changelog)", 5, 120)).toEqual(["Shipped X"]);
  });

  it.each([
    "See https://evil.example for details",
    "Docs live at www.evil.example now",
    "Docs live at WWW.EVIL.EXAMPLE now",
    "See HTTPS://evil.example",
  ])("drops a bare url, which GitHub would autolink: %s", (line) => {
    expect(sanitizeBullets(`Shipped X\n${line}`, 5, 120)).toEqual(["Shipped X"]);
  });

  it("keeps a line that merely mentions http as a word", () => {
    expect(sanitizeBullets("Added HTTP/2 support\nTuned httpClient timeouts", 5, 120))
      .toEqual(["Added HTTP/2 support", "Tuned httpClient timeouts"]);
  });

  it("drops an over-length line that sits before the max cutoff", () => {
    const long = "x".repeat(200);
    expect(sanitizeBullets(`one\n${long}\ntwo\nthree`, 3, 120)).toEqual(["one", "two", "three"]);
  });

  it("drops blank and whitespace-only lines without letting them use up the max", () => {
    expect(sanitizeBullets("\n\none\n   \ntwo\n\nthree", 3, 120)).toEqual(["one", "two", "three"]);
  });
});
