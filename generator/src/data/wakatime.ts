import type { Config } from "../config.js";
import type { WakaSnapshot, WakaLanguage } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "wakatime-snapshot";
const ENDPOINT = "https://wakatime.com/api/v1/users/current/stats/last_7_days";
const TOP_LANGUAGES = 5;

// readCache is a bare JSON.parse with no runtime check -- the file may predate a schema
// change or simply be corrupt. Each language entry is validated independently and dropped
// (not coerced) if malformed; the snapshot itself is dropped if nothing valid remains, so a
// half-broken cache degrades to null-omission rather than a half-broken widget.
// Unlike the live path, the cache is untrusted on type: a wrong type means the value is not
// trustworthy, so we use strict type checks (no Number(...) coercion), matching github.ts.
function validLanguages(v: unknown): WakaLanguage[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object" && typeof l.name === "string")
    .filter((l): l is Record<string, unknown> & { seconds: number; pct: number } =>
      typeof l.seconds === "number" && Number.isFinite(l.seconds) &&
      typeof l.pct === "number" && Number.isFinite(l.pct)
    )
    .map((l) => ({ name: l.name as string, seconds: l.seconds, pct: l.pct }));
}

function validCachedSnapshot(raw: unknown): WakaSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const languages = validLanguages(r.languages);
  const totalSeconds = Number(r.totalSeconds);
  if (languages.length === 0 || !Number.isFinite(totalSeconds) || typeof r.range !== "string") return null;
  return { languages, totalSeconds, range: r.range };
}

/**
 * Returns null -- never an empty widget -- when there is no key, no tracked time,
 * or no valid cached value to fall back on.
 */
export async function getWakatime(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<WakaSnapshot | null> {
  if (!config.wakatimeKey) return null;
  try {
    const res = await fetchImpl(ENDPOINT, {
      headers: {
        authorization: `Basic ${Buffer.from(config.wakatimeKey).toString("base64")}`,
        "user-agent": "reaperoak-readme-generator",
      },
    });
    if (!res.ok) throw new Error(`wakatime ${res.status}`);
    const json = (await res.json()) as any;
    const d = json?.data;

    // Check totalSeconds is finite; drop the snapshot if not
    const rawTotalSeconds = Number(d?.total_seconds);
    if (!Number.isFinite(rawTotalSeconds)) return null;
    const totalSeconds = rawTotalSeconds;

    const languages = (d?.languages ?? [])
      .filter((l: any): l is Record<string, unknown> => !!l && typeof l === "object" && typeof l.name === "string")
      .filter((l: any) => {
        // Drop entries where seconds or percent aren't finite (before converting)
        const seconds = Number(l.total_seconds);
        const pct = Number(l.percent);
        return Number.isFinite(seconds) && Number.isFinite(pct) && seconds > 0;
      })
      .map((l: any) => ({
        name: String(l.name),
        seconds: Number(l.total_seconds),
        pct: Number(l.percent),
      }))
      .slice(0, TOP_LANGUAGES);
    if (languages.length === 0) return null;

    const snap: WakaSnapshot = {
      languages,
      totalSeconds,
      range: String(d?.human_readable_range ?? "last 7 days"),
    };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return validCachedSnapshot(readCache<unknown>(CACHE_KEY));
  }
}
