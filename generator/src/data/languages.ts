import type { LanguageShare, RepoNode } from "../types.js";

const HALF_LIFE_DAYS = 180;
const FALLBACK_COLOR = "#8F887B";  // Tokens.mut — readable in both themes

/**
 * Per-repo normalised language shares, summed with recency decay.
 *
 * Each repo contributes its own language *distribution* (summing to 1), scaled by
 * exp(-days_since_push / 180). A repo with ten times the bytes therefore does not
 * get ten times the vote — it gets one vote, weighted by how recently it was touched.
 */
export function computeLanguageShares(
  repos: RepoNode[],
  todayISO: string,
  top = 6,
): LanguageShare[] {
  const now = Date.parse(todayISO);
  if (!Number.isFinite(now)) return [];

  const weights = new Map<string, number>();
  const colors = new Map<string, string>();

  for (const r of repos) {
    if (r.isFork || r.isArchived) continue;
    const total = r.languages.reduce((a, l) => a + l.size, 0);
    // One bad `size` poisons `total` (NaN), and normalising any language's byte
    // count against a NaN total would silently corrupt every share in this repo,
    // not just the offending entry. Drop the whole repo — including its otherwise
    // -valid languages — rather than guess which entries are still trustworthy.
    if (total <= 0 || !Number.isFinite(total)) continue;

    const pushedTime = Date.parse(r.pushedAt);
    if (!Number.isFinite(pushedTime)) continue;

    const days = Math.max(0, (now - pushedTime) / 86_400_000);
    const recency = Math.exp(-days / HALF_LIFE_DAYS);

    for (const l of r.languages) {
      weights.set(l.name, (weights.get(l.name) ?? 0) + (l.size / total) * recency);
      if (!colors.has(l.name)) colors.set(l.name, l.color ?? FALLBACK_COLOR);
    }
  }

  const sum = [...weights.values()].reduce((a, w) => a + w, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return [];

  return [...weights.entries()]
    .map(([name, w]) => ({ name, color: colors.get(name) ?? FALLBACK_COLOR, pct: (w / sum) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, top);
}
