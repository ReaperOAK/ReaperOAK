import type { Config } from "../config.js";
import type { FeedItem } from "../types.js";
import { readCache, writeCache } from "../cache.js";
import { LEAK_PATTERN } from "../render/leaks.js";

const CACHE_KEY = "feed-items";
const MAX_ITEMS = 4;

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

/** Value of a quoted attribute (single or double quotes) inside a tag's attribute text. */
function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** RSS carries the url as element text. Atom carries it in `href` and lists several links per
 *  entry (self, edit, enclosure, alternate), so take the human-facing one: `rel="alternate"` or
 *  no `rel`. An entry with only machine links gets no url and is skipped - a link to the entry's
 *  own XML is worse than no link. */
function entryUrl(block: string): string | null {
  const text = tag(block, "link");
  if (text) return text;
  for (const m of block.matchAll(/<link\b([^>]*)>/gi)) {
    const href = attr(m[1]!, "href");
    const rel = attr(m[1]!, "rel");
    if (href && (!rel || rel.toLowerCase() === "alternate")) return href;
  }
  return null;
}

/** Only http(s). A `)` or whitespace in the url would break out of `(url)`; reject rather
 *  than mangle it. */
function isSafeUrl(url: string): boolean {
  return /^https?:\/\//.test(url) && !/[)\s]/.test(url);
}

/** The only date shapes an item may carry: `YYYY-MM-DD`, or "" for no date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A feed date is free text (RSS `pubDate`, Atom `published`/`updated`), CDATA included, and
 *  is printed inside `<sub>`. Reducing it to a calendar date leaves nothing to inject and
 *  nothing for a markdown autolink to latch on to. Unparseable -> "": the post is still worth
 *  listing, a made-up date is not. */
function normaliseDate(raw: string): string {
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return "";
  const day = new Date(ms).toISOString().slice(0, 10);
  return ISO_DATE.test(day) ? day : ""; // years past 9999 serialise as `+YYYYYY-...`
}

/** Everything the Writing panel prints for an item. A leak in the title or url
 *  (`/posts/undefined` is a plausible url) would put a leak in the README, so the item is
 *  dropped instead. The date cannot leak: it is a validated `YYYY-MM-DD` or empty. Titles are
 *  not markdown-escaped here - that happens where they are rendered (writing.ts), so cached
 *  and freshly parsed items take the same path. */
function leaks(i: FeedItem): boolean {
  return LEAK_PATTERN.test(`${i.title}\n${i.url}`);
}

/** Regex parsing is deliberate — no XML dependency for four titles and four links. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items: FeedItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const url = entryUrl(b);
    // `||`, not `??`: an empty <published/> must fall through to <updated>. Atom's `published`
    // is when the post went out; `updated` moves on every edit.
    const date = normaliseDate(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || "");
    if (!title || !url || !isSafeUrl(url)) continue;
    const item = { title, url, date };
    if (!leaks(item)) items.push(item);
  }
  return items.slice(0, MAX_ITEMS);
}

function isFeedItem(v: unknown): v is FeedItem {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.title === "string" && typeof r.url === "string" && typeof r.date === "string"
    && (r.date === "" || ISO_DATE.test(r.date))
    && isSafeUrl(r.url) && !leaks({ title: r.title, url: r.url, date: r.date });
}

/** The on-disk cache is untrusted the same way github-snapshot's is: a schema change or a
 *  hand-edited file could hand back anything. Unlike normaliseSnapshot, there is no per-field
 *  patch-up worth doing for a 4-item list — one bad row means the whole cache is untrustworthy. */
function validateCache(raw: unknown): FeedItem[] | null {
  return Array.isArray(raw) && raw.every(isFeedItem) ? raw : null;
}

/** Inert until FEED_URL is set. Returns null so the Writing panel omits itself. */
export async function getFeed(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<FeedItem[] | null> {
  if (!config.feedUrl) return null;
  try {
    const res = await fetchImpl(config.feedUrl, {
      headers: { "user-agent": "reaperoak-readme-generator" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`feed ${res.status}`);
    const items = parseFeed(await res.text());
    if (items.length === 0) return null;
    writeCache(CACHE_KEY, items);
    return items;
  } catch {
    return validateCache(readCache<unknown>(CACHE_KEY));
  }
}
