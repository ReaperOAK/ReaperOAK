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

const VOICE =
  "You write one line for Owais Ahmed Khan (ReaperOAK), a founding engineer who ships production AI systems. " +
  "Voice: precise, understated, technical, no hype. No emoji. No hashtags. Never use the words passionate, ninja, rockstar, guru. Plain sentence only.";

export async function getDynamicFields(
  config: Config, snapshot: GithubSnapshot, fetchImpl: typeof fetch = fetch,
): Promise<DynamicFields> {
  const fb = content.fallback;
  if (!config.openRouter) return { ...fb };
  const { key, model } = config.openRouter;
  const cached = readCache<DynamicFields>(CACHE_KEY);

  const pick = async (system: string, user: string, max: number, fallback: string, cachedVal?: string) => {
    const out = sanitizeLine(await chat({ key, model, system, user, fetchImpl }), max);
    return out ?? cachedVal ?? fallback;
  };

  const commits = snapshot.recentCommitMessages.slice(0, 8).join("; ") || "no recent commits";
  const result: DynamicFields = {
    tagline: await pick(VOICE, `Rewrite this mission line, same meaning, <=90 chars, no name/company: "${fb.tagline}"`, 100, fb.tagline, cached?.tagline),
    recentWork: await pick(VOICE, `From these commit messages write one sentence starting "This week:" (<=160 chars): ${commits}`, 170, fb.recentWork, cached?.recentWork),
    thinkingAbout: await pick(VOICE, `Write one fresh systems-design thought Owais is chewing on today (<=160 chars).`, 170, fb.thinkingAbout, cached?.thinkingAbout),
    featuredBlurbs: {},
  };
  writeCache(CACHE_KEY, result);
  return result;
}
