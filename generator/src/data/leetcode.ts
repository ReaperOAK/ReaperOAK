import type { Config } from "../config.js";
import type { LeetcodeSnapshot } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "leetcode-snapshot";
const ENDPOINT = "https://leetcode.com/graphql";

const QUERY = `query($username:String!){
  matchedUser(username:$username){
    submitStatsGlobal{ acSubmissionNum{ difficulty count } }
    profile{ ranking }
  }
}`;

/**
 * A difficulty row that's absent is a genuine zero (the user has never attempted it) --
 * distinct from a row that's present but whose count isn't a finite number, which means
 * the API response itself is malformed. The caller must not treat those two cases alike:
 * an absent row degrades to 0, a malformed one signals the whole snapshot is untrustworthy.
 */
function countFor(rows: Array<{ difficulty: string; count: unknown }>, key: string): number | null {
  const row = rows.find((r) => r.difficulty === key);
  if (!row) return 0;
  return typeof row.count === "number" && Number.isFinite(row.count) ? row.count : null;
}

// readCache is a bare JSON.parse with no runtime check -- the file may predate a schema
// change or be hand-corrupted. Strict type checks only, no Number("12") coercion: a wrong
// type means the value is not trustworthy, matching github.ts / wakatime.ts.
function validCachedLeetcode(raw: unknown): LeetcodeSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.handle !== "string") return null;
  if (typeof r.total !== "number" || !Number.isFinite(r.total) || r.total <= 0) return null;
  if (typeof r.easy !== "number" || !Number.isFinite(r.easy)) return null;
  if (typeof r.medium !== "number" || !Number.isFinite(r.medium)) return null;
  if (typeof r.hard !== "number" || !Number.isFinite(r.hard)) return null;
  if (r.ranking !== null && !(typeof r.ranking === "number" && Number.isFinite(r.ranking))) return null;
  return { handle: r.handle, total: r.total, easy: r.easy, medium: r.medium, hard: r.hard, ranking: r.ranking };
}

/** Public endpoint, no key. Returns null when the handle is unset, unknown, or has no solves. */
export async function getLeetcode(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<LeetcodeSnapshot | null> {
  const handle = config.leetcodeHandle;
  if (!handle) return null;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: `https://leetcode.com/u/${handle}/`,
        "user-agent": "reaperoak-readme-generator",
      },
      body: JSON.stringify({ query: QUERY, variables: { username: handle } }),
    });
    if (!res.ok) throw new Error(`leetcode ${res.status}`);
    const json = (await res.json()) as any;
    const user = json?.data?.matchedUser;
    if (!user) throw new Error("no such user");

    const rows = user.submitStatsGlobal?.acSubmissionNum ?? [];
    const total = countFor(rows, "All");
    const easy = countFor(rows, "Easy");
    const medium = countFor(rows, "Medium");
    const hard = countFor(rows, "Hard");
    // Any malformed count (present row, non-numeric value) makes the whole response
    // untrustworthy -- fall through to the last good cache rather than render a fake 0.
    if (total === null || easy === null || medium === null || hard === null) {
      throw new Error("malformed leetcode counts");
    }
    if (total <= 0) return null;

    // ranking is decorative, not a solve count -- a missing or malformed value degrades to
    // null (a real, renderable state per LeetcodeSnapshot) instead of failing the snapshot.
    const rankingRaw = user.profile?.ranking;
    const ranking = typeof rankingRaw === "number" && Number.isFinite(rankingRaw) ? rankingRaw : null;

    const snap: LeetcodeSnapshot = { handle, total, easy, medium, hard, ranking };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return validCachedLeetcode(readCache<unknown>(CACHE_KEY));
  }
}
