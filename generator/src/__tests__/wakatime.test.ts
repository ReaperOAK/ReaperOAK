import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getWakatime } from "../data/wakatime.js";
import { CACHE_DIR, writeCache } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: "waka_test", leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("getWakatime", () => {
  it("returns null when no key is configured", async () => {
    expect(await getWakatime({ ...cfg, wakatimeKey: null })).toBeNull();
  });

  it("parses languages and total time", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days",
      total_seconds: 40000,
      languages: [
        { name: "TypeScript", total_seconds: 27120, percent: 67.8 },
        { name: "Python", total_seconds: 12880, percent: 32.2 },
      ],
    } }));
    const snap = (await getWakatime(cfg, fake as unknown as typeof fetch))!;
    expect(snap.range).toBe("Last 7 Days");
    expect(snap.totalSeconds).toBe(40000);
    expect(snap.languages[0]).toEqual({ name: "TypeScript", seconds: 27120, pct: 67.8 });
  });

  it("returns null rather than an empty widget when the account has no tracked time", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days", total_seconds: 0, languages: [] } }));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null on a non-200 response when there is no cache", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("never throws on a network error", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("serves the last good value when a later fetch fails", async () => {
    const good = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days", total_seconds: 100,
      languages: [{ name: "Go", total_seconds: 100, percent: 100 }] } }));
    await getWakatime(cfg, good as unknown as typeof fetch);
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    const snap = (await getWakatime(cfg, bad as unknown as typeof fetch))!;
    expect(snap.languages[0]!.name).toBe("Go");
  });

  it("sends the key as a basic auth header, never in the query string", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "r", total_seconds: 1,
      languages: [{ name: "Go", total_seconds: 1, percent: 100 }] } }));
    await getWakatime(cfg, fake as unknown as typeof fetch);
    const [url, init] = fake.mock.calls[0]!;
    expect(String(url)).not.toContain("waka_test");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: `Basic ${Buffer.from("waka_test").toString("base64")}`,
    });
  });

  it("drops malformed language entries from a cached fallback but keeps valid ones", async () => {
    // Seed a cache whose languages array mixes one valid entry with two malformed ones:
    // a non-numeric pct and a missing seconds field. readCache is a bare JSON.parse with
    // no validation, so this mirrors what an old-schema or hand-corrupted cache file looks
    // like on disk.
    writeCache("wakatime-snapshot", {
      languages: [
        { name: "Go", seconds: 100, pct: 100 },
        { name: "Rust", seconds: 50, pct: "oops" },
        { name: "C", pct: 10 },
      ],
      totalSeconds: 150,
      range: "Last 7 Days",
    });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    const snap = await getWakatime(cfg, bad as unknown as typeof fetch);
    expect(snap).not.toBeNull();
    expect(snap!.languages).toEqual([{ name: "Go", seconds: 100, pct: 100 }]);
  });

  it("returns null when every cached language entry is malformed", async () => {
    writeCache("wakatime-snapshot", {
      languages: [{ name: "Rust", seconds: 50, pct: "oops" }, { name: "C", pct: 10 }],
      totalSeconds: 50,
      range: "Last 7 Days",
    });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getWakatime(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("returns null on a wrong-typed cached totalSeconds even with valid languages", async () => {
    writeCache("wakatime-snapshot", {
      languages: [{ name: "Go", seconds: 100, pct: 100 }],
      totalSeconds: "not-a-number",
      range: "Last 7 Days",
    });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getWakatime(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("drops languages with non-numeric percent from the live API", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days",
      total_seconds: 100,
      languages: [{ name: "Go", total_seconds: 100, percent: "not-a-number" }],
    } }));
    const snap = await getWakatime(cfg, fake as unknown as typeof fetch);
    expect(snap).toBeNull();
  });

  it("returns null when live totalSeconds is not a finite number", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days",
      total_seconds: "not-a-number",
      languages: [{ name: "Go", total_seconds: 100, percent: 100 }],
    } }));
    const snap = await getWakatime(cfg, fake as unknown as typeof fetch);
    expect(snap).toBeNull();
  });

  it("drops from live response any language with non-numeric percent", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days",
      total_seconds: 200,
      languages: [
        { name: "Go", total_seconds: 100, percent: 50 },
        { name: "Rust", total_seconds: 100, percent: "broken" },
      ],
    } }));
    const snap = (await getWakatime(cfg, fake as unknown as typeof fetch))!;
    expect(snap.languages).toHaveLength(1);
    expect(snap.languages[0]!.name).toBe("Go");
  });

  it("returns null when live totalSeconds is not finite", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days",
      total_seconds: "invalid",
      languages: [{ name: "Go", total_seconds: 100, percent: 100 }],
    } }));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("rejects cached language with string seconds (no type coercion)", async () => {
    writeCache("wakatime-snapshot", {
      languages: [{ name: "Go", seconds: "100", pct: 100 }],
      totalSeconds: 100,
      range: "Last 7 Days",
    });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    const snap = await getWakatime(cfg, bad as unknown as typeof fetch);
    expect(snap).toBeNull();
  });

  it("rejects cached language with string pct (no type coercion)", async () => {
    writeCache("wakatime-snapshot", {
      languages: [{ name: "Go", seconds: 100, pct: "50" }],
      totalSeconds: 100,
      range: "Last 7 Days",
    });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    const snap = await getWakatime(cfg, bad as unknown as typeof fetch);
    expect(snap).toBeNull();
  });
});
