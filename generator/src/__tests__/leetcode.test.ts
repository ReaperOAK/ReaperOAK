import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getLeetcode } from "../data/leetcode.js";
import { CACHE_DIR, writeCache } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: "oaak78692", uptimeTargets: [], feedUrl: null,
};

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const payload = (all: number, easy: number, medium: number, hard: number, ranking: number | null) => ({
  data: {
    matchedUser: {
      submitStatsGlobal: { acSubmissionNum: [
        { difficulty: "All", count: all }, { difficulty: "Easy", count: easy },
        { difficulty: "Medium", count: medium }, { difficulty: "Hard", count: hard },
      ] },
      profile: { ranking },
    },
  },
});

describe("getLeetcode", () => {
  it("returns null when no handle is configured, without making a request", async () => {
    // Assert no request happened, not just that the result is null -- otherwise this
    // would pass "by accident" via the network-error fallback even with the guard removed.
    const fake = vi.fn();
    expect(await getLeetcode({ ...cfg, leetcodeHandle: null }, fake as unknown as typeof fetch)).toBeNull();
    expect(fake).not.toHaveBeenCalled();
  });

  it("parses solved counts by difficulty", async () => {
    const fake = vi.fn().mockResolvedValue(ok(payload(214, 96, 101, 17, 184203)));
    const snap = (await getLeetcode(cfg, fake as unknown as typeof fetch))!;
    expect(snap).toEqual({
      handle: "oaak78692", total: 214, easy: 96, medium: 101, hard: 17, ranking: 184203,
    });
  });

  it("tolerates a missing profile ranking", async () => {
    const fake = vi.fn().mockResolvedValue(ok(payload(10, 10, 0, 0, null)));
    expect((await getLeetcode(cfg, fake as unknown as typeof fetch))!.ranking).toBeNull();
  });

  it("returns null when the user has solved nothing", async () => {
    const fake = vi.fn().mockResolvedValue(ok(payload(0, 0, 0, 0, null)));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the handle does not exist", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: { matchedUser: null } }));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("never throws on a network error", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null on a non-200 response when there is no cache", async () => {
    // Body is well-formed and would parse into a valid snapshot -- the only thing making
    // this fail is the status check, so this isolates that guard from a JSON-parse throw.
    const fake = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload(214, 96, 101, 17, 1)), {
        status: 500, headers: { "content-type": "application/json" },
      }),
    );
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("serves the last good value when a later fetch fails", async () => {
    const good = vi.fn().mockResolvedValue(ok(payload(5, 5, 0, 0, 1)));
    await getLeetcode(cfg, good as unknown as typeof fetch);
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await getLeetcode(cfg, bad as unknown as typeof fetch))!.total).toBe(5);
  });

  it("never sends the handle anywhere but the URL/referer/body it already belongs in", async () => {
    // Sanity check there's no secret involved here -- the handle is public by design --
    // but confirm the request shape stays header-based auth-free (no key to leak).
    const fake = vi.fn().mockResolvedValue(ok(payload(1, 1, 0, 0, null)));
    await getLeetcode(cfg, fake as unknown as typeof fetch);
    const [, init] = fake.mock.calls[0]!;
    expect((init as RequestInit).headers).not.toHaveProperty("authorization");
  });

  // --- live path: a present-but-non-numeric count must not become NaN or a fake 0 ---

  it("falls back to null (no cache) when a live count is malformed", async () => {
    const fake = vi.fn().mockResolvedValue(ok({
      data: { matchedUser: { submitStatsGlobal: { acSubmissionNum: [
        { difficulty: "All", count: 214 }, { difficulty: "Easy", count: "oops" },
        { difficulty: "Medium", count: 101 }, { difficulty: "Hard", count: 17 },
      ] }, profile: { ranking: 1 } } },
    }));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("falls back to last-good cache when a live count is malformed", async () => {
    const good = vi.fn().mockResolvedValue(ok(payload(5, 5, 0, 0, 1)));
    await getLeetcode(cfg, good as unknown as typeof fetch);
    const malformed = vi.fn().mockResolvedValue(ok({
      data: { matchedUser: { submitStatsGlobal: { acSubmissionNum: [
        { difficulty: "All", count: "not-a-number" },
      ] }, profile: { ranking: null } } },
    }));
    expect((await getLeetcode(cfg, malformed as unknown as typeof fetch))!.total).toBe(5);
  });

  it("degrades a malformed live ranking to null without failing the whole snapshot", async () => {
    const fake = vi.fn().mockResolvedValue(ok({
      data: { matchedUser: { submitStatsGlobal: { acSubmissionNum: [
        { difficulty: "All", count: 3 },
      ] }, profile: { ranking: "not-a-number" } } },
    }));
    const snap = (await getLeetcode(cfg, fake as unknown as typeof fetch))!;
    expect(snap.total).toBe(3);
    expect(snap.ranking).toBeNull();
  });

  it("defaults a difficulty row that's absent entirely (not malformed) to 0", async () => {
    // "Hard" never appears in the response at all -- distinct from the malformed-count
    // case above, this is a genuine zero (never attempted), not untrustworthy data.
    const fake = vi.fn().mockResolvedValue(ok({
      data: { matchedUser: { submitStatsGlobal: { acSubmissionNum: [
        { difficulty: "All", count: 3 }, { difficulty: "Easy", count: 2 }, { difficulty: "Medium", count: 1 },
      ] }, profile: { ranking: null } } },
    }));
    const snap = (await getLeetcode(cfg, fake as unknown as typeof fetch))!;
    expect(snap.hard).toBe(0);
  });

  // --- cached-fallback validation: readCache is a bare JSON.parse, cache may be corrupt ---

  it("rejects a cached snapshot with a wrong-typed handle", async () => {
    writeCache("leetcode-snapshot", { handle: 42, total: 5, easy: 5, medium: 0, hard: 0, ranking: 1 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a non-finite total", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: "5", easy: 5, medium: 0, hard: 0, ranking: 1 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot whose total is zero or negative", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 0, easy: 0, medium: 0, hard: 0, ranking: null });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a wrong-typed difficulty count", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 5, easy: "5", medium: 0, hard: 0, ranking: 1 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a wrong-typed medium count", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 5, easy: 5, medium: "0", hard: 0, ranking: 1 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a wrong-typed hard count", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 5, easy: 5, medium: 0, hard: "0", ranking: 1 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a wrong-typed, non-null ranking", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 5, easy: 5, medium: 0, hard: 0, ranking: "1" });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("accepts a well-formed cached snapshot with a null ranking", async () => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 5, easy: 5, medium: 0, hard: 0, ranking: null });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, bad as unknown as typeof fetch)).toEqual({
      handle: "oaak78692", total: 5, easy: 5, medium: 0, hard: 0, ranking: null,
    });
  });
});

describe("matchedUser guard", () => {
  // A falsy-but-non-null matchedUser (false, 0, "") does NOT throw on property access, so
  // without the guard it would fall through to `return null` inside the try block and
  // silently discard a good cache. null alone can't prove the guard exists: it throws either way.
  it.each([false, 0, ""])("falls back to the cache when matchedUser is %j", async (bad) => {
    writeCache("leetcode-snapshot", { handle: "oaak78692", total: 5, easy: 5, medium: 0, hard: 0, ranking: 1 });
    const fake = vi.fn().mockResolvedValue(ok({ data: { matchedUser: bad } }));
    const snap = await getLeetcode(cfg, fake as unknown as typeof fetch);
    expect(snap).toEqual({ handle: "oaak78692", total: 5, easy: 5, medium: 0, hard: 0, ranking: 1 });
  });
});
