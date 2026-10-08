import type { Config } from "../config.js";
import type { DynamicFields, GithubSnapshot } from "../types.js";
import { content } from "../content.js";
import { readCache, writeCache } from "../cache.js";
import { chat } from "./openrouter.js";

const CACHE_KEY = "dynamic-fields";
const BANNED = [/passionate/i, /ninja/i, /rockstar/i, /guru/i, /\bunleash\b/i];

export function sanitizeLine(raw: string | null, max: number): string | null {
  if (!raw) return null;
  const line = raw.replace(/^["']|["']$/g, "").trim();
  if (line.length === 0 || line.length > max) return null;
  if (line.includes("```") || line.includes("\n")) return null;
  if (BANNED.some((re) => re.test(line))) return null;
  return line;
}

/** Splits an LLM reply into clean bullets. Returns [] if the reply is unusable.
 *  Rejects `<`, `](` and `http` — the model output is untrusted and goes straight into
 *  markdown, so it must not be able to inject HTML or links. */
export function sanitizeBullets(raw: string | null, max: number, maxLen: number): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 0 && l.length <= maxLen && !l.includes("```"))
    .filter((l) => !BANNED.some((re) => re.test(l)))
    .filter((l) => !l.includes("<") && !l.includes("](") && !/http/i.test(l))
    .slice(0, max);
}

const VOICE =
  "You write one line for Owais Ahmed Khan (ReaperOAK), a backend and infrastructure engineer who ships production AI systems. " +
  "Voice: precise, understated, technical, no hype. No emoji. No hashtags. Never use the words passionate, ninja, rockstar, guru. Plain sentence only.";

function strField(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
}

function strRecord(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  return entries.every(([, val]) => typeof val === "string") ? (v as Record<string, string>) : null;
}

// The on-disk cache is untrusted the same way github-snapshot's is: readCache is a bare
// JSON.parse with no runtime check, and the file may predate a schema change (this exact bug
// crashed two panels in Task 7 — engineeringLog was added here without a cache migration) or
// simply be corrupt. Every field is validated independently and falls back to content.fallback
// on its own, so one bad field never drags the rest of a still-good cache down with it.
function normaliseCache(raw: unknown, fb: DynamicFields): DynamicFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    tagline: strField(r.tagline, fb.tagline),
    recentWork: strField(r.recentWork, fb.recentWork),
    thinkingAbout: strField(r.thinkingAbout, fb.thinkingAbout),
    engineeringLog: strArray(r.engineeringLog) ?? fb.engineeringLog,
    featuredBlurbs: strRecord(r.featuredBlurbs) ?? fb.featuredBlurbs,
  };
}

/** The daily bot commit ("chore: refresh profile README [skip ci]") would otherwise dominate
 *  what the LLM sees — it was 5 of the last 12 commits in the tracked cache. Excluded from
 *  every prompt that reads commit history, not just the log, since recentWork has the same
 *  failure mode. */
function realCommitMessages(snapshot: GithubSnapshot): string[] {
  return snapshot.recentCommitMessages.filter((m) => !m.includes("[skip ci]"));
}

export async function getDynamicFields(
  config: Config, snapshot: GithubSnapshot, fetchImpl: typeof fetch = fetch,
): Promise<DynamicFields> {
  const fb = content.fallback;
  if (!config.llm) return { ...fb };
  const { key, models, baseUrl } = config.llm;
  const cached = normaliseCache(readCache<unknown>(CACHE_KEY), fb);

  // Try each free model in order; first valid line wins. All fail → cache → static.
  const pick = async (system: string, user: string, max: number, cachedVal: string) => {
    for (const model of models) {
      const out = sanitizeLine(await chat({ baseUrl, key, model, system, user, fetchImpl }), max);
      if (out) return out;
    }
    return cachedVal;
  };

  const commits = realCommitMessages(snapshot).slice(0, 8).join("; ") || "no recent commits";

  const tagline = await pick(VOICE, `Rewrite this mission line, same meaning, <=90 chars, no name/company: "${fb.tagline}"`, 100, cached.tagline);
  const recentWork = await pick(VOICE, `From these commit messages write one sentence starting "This week:" (<=160 chars): ${commits}`, 170, cached.recentWork);
  const thinkingAbout = await pick(VOICE, `Write one fresh systems-design thought Owais is chewing on today (<=160 chars).`, 170, cached.thinkingAbout);

  // No cache, no LLM output → cached.engineeringLog is already fb.engineeringLog ([]), so an
  // unreachable LLM degrades straight to "no section" rather than an invented changelog.
  let engineeringLog = cached.engineeringLog;
  for (const model of models) {
    const out = await chat({
      baseUrl, key, model, fetchImpl,
      system: VOICE,
      user: `From these commit messages, write 3 to 5 bullet lines describing what shipped. `
        + `One clause each, past tense, no bullet characters, no preamble: ${commits}`,
    });
    const bullets = sanitizeBullets(out, 5, 120);
    if (bullets.length >= 3) { engineeringLog = bullets; break; }
  }

  const result: DynamicFields = { tagline, recentWork, thinkingAbout, engineeringLog, featuredBlurbs: {} };
  writeCache(CACHE_KEY, result);
  return result;
}
