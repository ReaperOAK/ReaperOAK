import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getFeed, parseFeed } from "../data/feed.js";
import { writeCache, CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null, wakatimeKey: null,
  leetcodeHandle: null, uptimeTargets: [], feedUrl: "https://blog.example/rss.xml",
};

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title>Honest backtests</title><link>https://blog.example/a</link><pubDate>Sat, 06 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>Lease renewal races</title><link>https://blog.example/b</link><pubDate>Fri, 05 Sep 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed>
<entry><title>Atom post</title><link href="https://blog.example/c"/><updated>2026-09-06T10:00:00Z</updated></entry>
</feed>`;

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

describe("parseFeed", () => {
  it("reads RSS items", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Honest backtests", url: "https://blog.example/a" });
  });

  it("reads Atom entries with href links", () => {
    expect(parseFeed(ATOM)[0]).toMatchObject({ title: "Atom post", url: "https://blog.example/c" });
  });

  it("returns an empty list for junk rather than throwing", () => {
    expect(parseFeed("not xml at all")).toEqual([]);
  });

  it("escapes ] and [ in titles so a bracket can't close the markdown link early", () => {
    const xml = `<rss><channel><item><title>Rates [update]</title><link>https://blog.example/d</link></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items[0]!.title).toBe("Rates \\[update\\]");
  });

  it("rejects an item whose url contains a closing paren or whitespace", () => {
    const xml = `<rss><channel>
<item><title>Bad paren</title><link>https://blog.example/e)evil</link></item>
<item><title>Bad space</title><link>https://blog.example/f g</link></item>
<item><title>Good one</title><link>https://blog.example/g</link></item>
</channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Good one");
  });
});

describe("getFeed", () => {
  it("returns null when FEED_URL is unset — the panel then omits itself", async () => {
    expect(await getFeed({ ...cfg, feedUrl: null })).toBeNull();
  });

  it("returns parsed items when the feed responds", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(RSS, { status: 200 }));
    expect((await getFeed(cfg, fake as unknown as typeof fetch))!).toHaveLength(2);
  });

  it("returns null on a failed fetch", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the feed is empty", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("<rss><channel></channel></rss>", { status: 200 }));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("falls back to a valid cache on fetch failure", async () => {
    writeCache("feed-items", [{ title: "Cached post", url: "https://blog.example/z", date: "2026-09-01" }]);
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    const out = await getFeed(cfg, fake as unknown as typeof fetch);
    expect(out).toEqual([{ title: "Cached post", url: "https://blog.example/z", date: "2026-09-01" }]);
  });

  it("ignores a malformed on-disk cache rather than serving garbage", async () => {
    writeCache("feed-items", { not: "an array" });
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("ignores a cache whose items are missing required string fields or a valid url", async () => {
    writeCache("feed-items", [{ title: "ok", url: "not-a-url", date: "2026-09-01" }]);
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });
});
