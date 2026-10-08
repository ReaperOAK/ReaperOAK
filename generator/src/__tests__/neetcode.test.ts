import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getNeetcode, countDistinctProblems } from "../data/neetcode.js";
import { CACHE_DIR, writeCache } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: "t", githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const tree = (paths: string[]) => ok({ tree: paths.map((path) => ({ path, type: "blob" })) });

describe("countDistinctProblems", () => {
  it("counts one problem however many submissions it has", () => {
    expect(countDistinctProblems([
      "Data Structures & Algorithms/two-sum/submission-0.py",
      "Data Structures & Algorithms/two-sum/submission-1.py",
      "Data Structures & Algorithms/two-sum/submission-2.py",
    ])).toBe(1);
  });

  it("counts distinct problem directories", () => {
    expect(countDistinctProblems([
      "Data Structures & Algorithms/two-sum/submission-0.py",
      "Data Structures & Algorithms/binary-search/submission-0.py",
    ])).toBe(2);
  });

  it("ignores top-level files that are not inside a problem directory", () => {
    expect(countDistinctProblems(["README.md", "Data Structures & Algorithms/two-sum/s.py"])).toBe(1);
  });

  it("returns 0 for an empty tree", () => {
    expect(countDistinctProblems([])).toBe(0);
  });
});

describe("getNeetcode", () => {
  it("returns null without a github token, without making a request", async () => {
    // Assert no request happened, not just that the result is null -- otherwise this
    // would pass "by accident" via the network-error fallback even with the guard removed.
    const fake = vi.fn();
    expect(await getNeetcode({ ...cfg, githubToken: null }, fake as unknown as typeof fetch)).toBeNull();
    expect(fake).not.toHaveBeenCalled();
  });

  it("reports solved against the 150 target", async () => {
    const fake = vi.fn().mockResolvedValue(tree([
      "Data Structures & Algorithms/two-sum/submission-0.py",
      "Data Structures & Algorithms/binary-search/submission-0.py",
    ]));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toEqual({ solved: 2, target: 150 });
  });

  it("returns null when nothing has been solved", async () => {
    const fake = vi.fn().mockResolvedValue(tree([]));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("never throws when the repo is missing", async () => {
    // Body is well-formed and would parse into a valid snapshot -- the only thing making
    // this fail is the status check, so this isolates that guard from a JSON-parse throw.
    const fake = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tree: [{ path: "a/b/s.py", type: "blob" }] }), {
        status: 404, headers: { "content-type": "application/json" },
      }),
    );
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("serves the last good value when a later fetch fails", async () => {
    const good = vi.fn().mockResolvedValue(tree(["D/a/s.py", "D/b/s.py", "D/c/s.py"]));
    await getNeetcode(cfg, good as unknown as typeof fetch);
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await getNeetcode(cfg, bad as unknown as typeof fetch))!.solved).toBe(3);
  });

  it("sends the token as a bearer header, never in the URL", async () => {
    const secretCfg: Config = { ...cfg, githubToken: "ghp_supersecrettoken123" };
    const fake = vi.fn().mockResolvedValue(tree(["D/a/s.py"]));
    await getNeetcode(secretCfg, fake as unknown as typeof fetch);
    const [url, init] = fake.mock.calls[0]!;
    expect(String(url)).not.toContain("ghp_supersecrettoken123");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer ghp_supersecrettoken123" });
  });

  // --- live path: a tree entry whose path isn't a string must not be fabricated into one ---

  it("drops malformed tree entries on the live path instead of coercing them into paths", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ tree: [
      { path: "Data Structures & Algorithms/two-sum/submission-0.py", type: "blob" },
      { path: 12345, type: "blob" }, // malformed: not a string -- String(12345) would fabricate "12345"
      { type: "blob" }, // malformed: missing path entirely
    ] }));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toEqual({ solved: 1, target: 150 });
  });

  it("ignores tree entries that are not blobs (directories/submodules)", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ tree: [
      { path: "Data Structures & Algorithms/two-sum/submission-0.py", type: "blob" },
      // A "tree" (directory) entry that is itself 3+ segments deep, with no blob under it --
      // e.g. an empty placeholder folder. countDistinctProblems' own depth check would not
      // catch this one (it's deep enough to look like a problem dir), so the blob-type
      // filter is the only thing stopping it from being counted as a second solved problem.
      { path: "Data Structures & Algorithms/empty-folder/notes", type: "tree" },
    ] }));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toEqual({ solved: 1, target: 150 });
  });

  it("falls back to cache when the live tree isn't an array (malformed response)", async () => {
    const good = vi.fn().mockResolvedValue(tree(["D/a/s.py", "D/b/s.py"]));
    await getNeetcode(cfg, good as unknown as typeof fetch);
    // tree: "oops" -- not an array. Must not be silently treated as an empty/0-solved repo
    // and discard the good cache; it's malformed data, so it falls back like any other bad
    // response.
    const malformed = vi.fn().mockResolvedValue(ok({ tree: "oops" }));
    expect((await getNeetcode(cfg, malformed as unknown as typeof fetch))!.solved).toBe(2);
  });

  // --- cached-fallback validation: readCache is a bare JSON.parse, cache may be corrupt ---

  it("rejects a cached snapshot with a non-finite solved count", async () => {
    writeCache("neetcode-snapshot", { solved: "3", target: 150 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getNeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a zero or negative solved count", async () => {
    writeCache("neetcode-snapshot", { solved: 0, target: 150 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getNeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a non-finite target", async () => {
    writeCache("neetcode-snapshot", { solved: 3, target: "150" });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getNeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot with a zero or negative target", async () => {
    writeCache("neetcode-snapshot", { solved: 3, target: 0 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getNeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("rejects a cached snapshot that is missing entirely (malformed shape)", async () => {
    writeCache("neetcode-snapshot", { solved: 3 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getNeetcode(cfg, bad as unknown as typeof fetch)).toBeNull();
  });

  it("accepts a well-formed cached snapshot", async () => {
    writeCache("neetcode-snapshot", { solved: 92, target: 150 });
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getNeetcode(cfg, bad as unknown as typeof fetch)).toEqual({ solved: 92, target: 150 });
  });
});
