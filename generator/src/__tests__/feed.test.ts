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
    expect(items[0]).toEqual({ title: "Honest backtests", url: "https://blog.example/a", date: "2026-09-06" });
  });

  it("reads Atom entries with href links", () => {
    expect(parseFeed(ATOM)[0]).toEqual({ title: "Atom post", url: "https://blog.example/c", date: "2026-09-06" });
  });

  // MAX_ITEMS: the Writing panel is four lines, whatever the feed holds.
  it("keeps only the first four items, in feed order", () => {
    const xml = `<rss><channel>${[1, 2, 3, 4, 5, 6].map((n) =>
      `<item><title>Post ${n}</title><link>https://blog.example/${n}</link></item>`).join("")}</channel></rss>`;
    expect(parseFeed(xml).map((i) => i.title)).toEqual(["Post 1", "Post 2", "Post 3", "Post 4"]);
  });

  it("returns an empty list for junk rather than throwing", () => {
    expect(parseFeed("not xml at all")).toEqual([]);
  });

  it("leaves titles raw - escaping happens where they are rendered", () => {
    const xml = `<rss><channel><item><title><![CDATA[<b>Rates</b> [update]]]></title><link>https://blog.example/d</link></item></channel></rss>`;
    expect(parseFeed(xml)[0]!.title).toBe("<b>Rates</b> [update]");
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

describe("parseFeed dates", () => {
  const rssDate = (date: string) =>
    `<rss><channel><item><title>T</title><link>https://blog.example/a</link>${date}</item></channel></rss>`;
  const atomDates = (dates: string) =>
    `<feed><entry><title>T</title><link href="https://blog.example/a"/>${dates}</entry></feed>`;

  it.each([
    ["an RFC 822 pubDate", rssDate("<pubDate>Sat, 06 Sep 2026 23:30:00 -0500</pubDate>"), "2026-09-07"],
    ["an ISO timestamp", rssDate("<pubDate>2026-09-06T10:00:00Z</pubDate>"), "2026-09-06"],
    ["a CDATA pubDate", rssDate("<pubDate><![CDATA[Sat, 06 Sep 2026 10:00:00 GMT]]></pubDate>"), "2026-09-06"],
    ["no date at all", rssDate(""), ""],
  ])("reduces %s to a calendar date in UTC", (_label, xml, date) => {
    expect(parseFeed(xml)[0]!.date).toBe(date);
  });

  it.each([
    ["words", "not a date at all"],
    ["a leak", "NaN"],
    ["html", "<b>today</b>"],
    ["a date followed by a heading", "2026-09-06\n\n## Injected date"],
    ["an email address", "see author@blog.example"],
    ["a year too large to print as four digits", "+275760-09-13T00:00:00.000Z"],
  ])("omits a date that is %s, but keeps the post", (_label, raw) => {
    expect(parseFeed(rssDate(`<pubDate><![CDATA[${raw}]]></pubDate>`)))
      .toEqual([{ title: "T", url: "https://blog.example/a", date: "" }]);
  });

  it("prefers an Atom published date over updated, whichever comes first", () => {
    const published = "<published>2026-01-02T00:00:00Z</published>";
    const updated = "<updated>2026-09-06T10:00:00Z</updated>";
    expect(parseFeed(atomDates(updated + published))[0]!.date).toBe("2026-01-02");
    expect(parseFeed(atomDates(published + updated))[0]!.date).toBe("2026-01-02");
  });

  it("falls through to updated when published is empty", () => {
    expect(parseFeed(atomDates("<published></published><updated>2026-09-06T10:00:00Z</updated>"))[0]!.date)
      .toBe("2026-09-06");
  });

  it("prefers pubDate over the Atom dates", () => {
    const xml = rssDate("<updated>2026-01-01T00:00:00Z</updated><pubDate>2026-09-06T10:00:00Z</pubDate>");
    expect(parseFeed(xml)[0]!.date).toBe("2026-09-06");
  });
});

const entry = (links: string) =>
  `<feed><entry><title>T</title>${links}<updated>2026-09-06T10:00:00Z</updated></entry></feed>`;

describe("parseFeed link selection", () => {
  it.each([
    ["alternate after self",
      `<link rel="self" href="https://blog.example/feed/c.xml"/><link rel="alternate" href="https://blog.example/c"/>`],
    ["alternate after edit and enclosure",
      `<link rel="edit" href="https://blog.example/api/c"/><link rel="enclosure" href="https://blog.example/c.mp3"/>`
      + `<link rel="alternate" type="text/html" href="https://blog.example/c"/>`],
    ["href written before rel",
      `<link href="https://blog.example/feed/c.xml" rel="self"/><link href="https://blog.example/c" rel="alternate"/>`],
    ["single-quoted attributes",
      `<link rel='self' href='https://blog.example/feed/c.xml'/><link rel='alternate' href='https://blog.example/c'/>`],
    ["an upper-case rel value",
      `<link rel="self" href="https://blog.example/feed/c.xml"/><link rel="ALTERNATE" href="https://blog.example/c"/>`],
    ["a link with no rel", `<link rel="self" href="https://blog.example/feed/c.xml"/><link href="https://blog.example/c"/>`],
    ["a single-quoted link with no rel", `<link href='https://blog.example/c'/>`],
  ])("picks the human-facing link: %s", (_label, links) => {
    expect(parseFeed(entry(links))[0]).toMatchObject({ url: "https://blog.example/c" });
  });

  it("skips an entry that has only machine links, rather than linking to its xml", () => {
    expect(parseFeed(entry(
      `<link rel="self" href="https://blog.example/feed/c.xml"/><link rel="edit" href="https://blog.example/api/c"/>`,
    ))).toEqual([]);
  });

  it("prefers the rss <link> text over an atom:link self element", () => {
    const xml = `<rss><channel><item><title>T</title><atom:link rel="self" href="https://blog.example/self"/>`
      + `<link>https://blog.example/a</link></item></channel></rss>`;
    expect(parseFeed(xml)[0]).toMatchObject({ url: "https://blog.example/a" });
  });
});

describe("parseFeed rejects untrusted values", () => {
  const rss = (item: string) => `<rss><channel><item>${item}</item><item><title>Good</title><link>https://blog.example/ok</link></item></channel></rss>`;

  it.each([
    ["a leak in the title", `<title>Why undefined is not a function</title><link>https://blog.example/x</link>`],
    ["a leak in the url", `<title>Fine</title><link>https://blog.example/posts/undefined</link>`],
    ["a template token", `<title>Hello {{ name }}</title><link>https://blog.example/x</link>`],
    ["a stringified object", `<title>[object Object]</title><link>https://blog.example/x</link>`],
    ["an Infinity title", `<title>Infinity and beyond</title><link>https://blog.example/x</link>`],
    ["a non-http scheme", `<title>Fine</title><link>httpx://blog.example/x</link>`],
    ["an http url behind another scheme", `<title>Fine</title><link>ftp://files.example/https://blog.example/x</link>`],
    ["a relative url", `<title>Fine</title><link>/posts/x</link>`],
  ])("skips an item with %s and keeps the rest", (_label, item) => {
    expect(parseFeed(rss(item)).map((i) => i.title)).toEqual(["Good"]);
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

  // A good fetch must refresh the cache, or the next outage serves nothing (or a stale list).
  it("caches a good fetch, so the next failed fetch serves it", async () => {
    const online = vi.fn().mockResolvedValue(new Response(RSS, { status: 200 }));
    const fresh = await getFeed(cfg, online as unknown as typeof fetch);
    expect(fresh).toHaveLength(2);
    const offline = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, offline as unknown as typeof fetch)).toEqual(fresh);
  });

  // The body here parses as a perfectly good feed, as a proxy's error page can: only the
  // status check stands between it and the README.
  it("treats a non-2xx response as a failed fetch and serves the cache instead", async () => {
    const cached = { title: "Cached post", url: "https://blog.example/z", date: "2026-09-01" };
    writeCache("feed-items", [cached]);
    const broken = vi.fn().mockResolvedValue(new Response(RSS, { status: 500 }));
    expect(await getFeed(cfg, broken as unknown as typeof fetch)).toEqual([cached]);
  });

  it("returns null on a non-2xx response when there is no cache", async () => {
    const broken = vi.fn().mockResolvedValue(new Response(RSS, { status: 500 }));
    expect(await getFeed(cfg, broken as unknown as typeof fetch)).toBeNull();
  });

  it("falls back to a valid cache on fetch failure", async () => {
    writeCache("feed-items", [{ title: "Cached post", url: "https://blog.example/z", date: "2026-09-01" }]);
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    const out = await getFeed(cfg, fake as unknown as typeof fetch);
    expect(out).toEqual([{ title: "Cached post", url: "https://blog.example/z", date: "2026-09-01" }]);
  });

  it("serves a cached item that has no date", async () => {
    const undated = { title: "Cached post", url: "https://blog.example/z", date: "" };
    writeCache("feed-items", [undated]);
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toEqual([undated]);
  });

  it("ignores a malformed on-disk cache rather than serving garbage", async () => {
    writeCache("feed-items", { not: "an array" });
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  // Every case sits beside a good item, so the whole cache must be rejected for one bad row.
  // Non-string cases use values that do not stringify to a leak ("undefined"), otherwise the
  // leak check would mask a missing type check.
  const GOOD = { title: "Cached post", url: "https://blog.example/z", date: "2026-09-01" };
  it.each([
    ["a null element", null],
    ["a missing title", { url: GOOD.url, date: GOOD.date }],
    ["a non-string title", { ...GOOD, title: 5 }],
    ["a missing date", { title: GOOD.title, url: GOOD.url }],
    ["a non-string date", { ...GOOD, date: 20260901 }],
    ["a missing url", { title: GOOD.title, date: GOOD.date }],
    ["a non-string url", { ...GOOD, url: ["https://blog.example/z"] }],
    ["a relative url", { ...GOOD, url: "/posts/z" }],
    ["a non-http scheme", { ...GOOD, url: "httpx://blog.example/z" }],
    ["an http url behind another scheme", { ...GOOD, url: "ftp://files.example/https://blog.example/z" }],
    ["a url with a closing paren", { ...GOOD, url: "https://blog.example/z)x" }],
    ["a url with whitespace", { ...GOOD, url: "https://blog.example/z x" }],
    ["a leak in the title", { ...GOOD, title: "Why undefined is not a function" }],
    ["a leak in the url", { ...GOOD, url: "https://blog.example/posts/undefined" }],
    ["a leak in the date", { ...GOOD, date: "NaN" }],
    ["a free-text date", { ...GOOD, date: "Sat, 06 Sep 2026 10:00:00 GMT" }],
    ["a date with a heading after it", { ...GOOD, date: "2026-09-01\n\n## Injected" }],
    ["a date with trailing text", { ...GOOD, date: "2026-09-01 www.evil.example" }],
  ])("ignores a cache holding %s", async (_label, bad) => {
    writeCache("feed-items", [GOOD, bad]);
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });
});
