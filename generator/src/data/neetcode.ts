import type { Config } from "../config.js";
import type { NeetcodeSnapshot } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "neetcode-snapshot";
const REPO = "neetcode-submissions";
const TARGET = 150;

/**
 * One problem = one directory, however many submission files it holds.
 * Paths shaped "<category>/<problem>/<file>"; anything shallower is not a solution.
 */
export function countDistinctProblems(paths: string[]): number {
  const problems = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    if (parts.length < 3) continue;
    problems.add(`${parts[0]}/${parts[1]}`);
  }
  return problems.size;
}

// readCache is a bare JSON.parse with no runtime check -- the file may predate a schema
// change or be hand-corrupted. Strict type checks only, no Number("12") coercion. The
// live path never writes solved/target <= 0 (see below), so a non-positive cached value
// is itself a sign of corruption, not a legitimate "zero progress" state.
function validCachedNeetcode(raw: unknown): NeetcodeSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.solved !== "number" || !Number.isFinite(r.solved) || r.solved <= 0) return null;
  if (typeof r.target !== "number" || !Number.isFinite(r.target) || r.target <= 0) return null;
  return { solved: r.solved, target: r.target };
}

export async function getNeetcode(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<NeetcodeSnapshot | null> {
  if (!config.githubToken) return null;
  try {
    const url = `https://api.github.com/repos/${config.githubLogin}/${REPO}/git/trees/HEAD?recursive=1`;
    const res = await fetchImpl(url, {
      headers: {
        // The token goes only here, in the Authorization header -- never in the URL,
        // a thrown error message, or the on-disk cache.
        authorization: `Bearer ${config.githubToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "reaperoak-readme-generator",
      },
    });
    if (!res.ok) throw new Error(`neetcode ${res.status}`);
    const json = (await res.json()) as any;
    // A tree that isn't an array at all is a malformed response, not an empty repo -- treat
    // it like any other bad response (throw -> fall back to last-good cache), rather than
    // silently defaulting to [] and reporting a fabricated "0 solved".
    if (!Array.isArray(json?.tree)) throw new Error("malformed neetcode tree");
    // A path that isn't a string (a malformed or unexpected tree entry) is dropped, not
    // coerced via String(...) -- coercion would fabricate a fake "problem directory".
    const paths: string[] = json.tree
      .filter((n: any) => n?.type === "blob" && typeof n?.path === "string")
      .map((n: any) => n.path as string);

    const solved = countDistinctProblems(paths);
    if (solved <= 0) return null;

    const snap: NeetcodeSnapshot = { solved, target: TARGET };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return validCachedNeetcode(readCache<unknown>(CACHE_KEY));
  }
}
