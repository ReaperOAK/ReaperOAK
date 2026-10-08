import type { Config } from "../config.js";
import type { FeedItem } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "feed-items";
const MAX_ITEMS = 4;

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

/** Escapes markdown link syntax in an untrusted feed title so it can't close the
 *  `[title](url)` link early. */
function sanitizeTitle(title: string): string {
  return title.replace(/[[\]]/g, (c) => (c === "[" ? "\\[" : "\\]"));
}

/** A `)` or whitespace in the url would break out of `(url)`; reject rather than mangle it. */
function isSafeUrl(url: string): boolean {
  return url.startsWith("http") && !/[)\s]/.test(url);
}

/** Regex parsing is deliberate — no XML dependency for four titles and four links. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items: FeedItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const url = tag(b, "link") || /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] || null;
    const date = tag(b, "pubDate") ?? tag(b, "updated") ?? tag(b, "published") ?? "";
    if (!title || !url || !isSafeUrl(url)) continue;
    items.push({ title: sanitizeTitle(title), url, date });
  }
  return items.slice(0, MAX_ITEMS);
}

function isFeedItem(v: unknown): v is FeedItem {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.title === "string" && typeof r.url === "string"
    && r.url.startsWith("http") && typeof r.date === "string";
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
