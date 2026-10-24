export interface UptimeTarget { label: string; url: string; }

export interface Config {
  githubToken: string | null;
  githubLogin: string;
  /** OpenAI-compatible gateway. OmniRoute when reachable, else OpenRouter. */
  llm: { baseUrl: string; key: string; models: string[] } | null;
  wakatimeKey: string | null;
  leetcodeHandle: string | null;
  uptimeTargets: UptimeTarget[];
  feedUrl: string | null;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Ordered chain tried in turn; the first to return valid output wins. If all fail the caller
// degrades to last-good cache, then to the hardcoded static string. All zero-cost.
const DEFAULT_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
];

function resolveModels(env: NodeJS.ProcessEnv): string[] {
  const llmList = env.LLM_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (llmList && llmList.length) return llmList;
  const orList = env.OPENROUTER_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (orList && orList.length) return orList;
  const single = env.OPENROUTER_MODEL?.trim();
  if (single) return [single];
  return DEFAULT_MODELS;
}

/** "label=url,label=url" → targets. Malformed entries are dropped, never thrown on. */
function parseUptimeTargets(raw: string | undefined): UptimeTarget[] {
  if (!raw) return [];
  return raw.split(",").map((pair) => {
    const idx = pair.indexOf("=");
    if (idx <= 0) return null;
    const label = pair.slice(0, idx).trim();
    const url = pair.slice(idx + 1).trim();
    return label && url.startsWith("http") ? { label, url } : null;
  }).filter((t): t is UptimeTarget => t !== null);
}

function resolveLlm(env: NodeJS.ProcessEnv): Config["llm"] {
  const models = resolveModels(env);
  const gatewayKey = env.LLM_API_KEY?.trim();
  const gatewayBase = env.LLM_BASE_URL?.trim();
  if (gatewayKey && gatewayBase) return { baseUrl: gatewayBase, key: gatewayKey, models };
  const orKey = env.OPENROUTER_API_KEY?.trim();
  if (orKey) return { baseUrl: OPENROUTER_BASE, key: orKey, models };
  return null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubLogin: env.GITHUB_LOGIN?.trim() || "ReaperOAK",
    llm: resolveLlm(env),
    wakatimeKey: env.WAKATIME_API_KEY?.trim() || null,
    leetcodeHandle: env.LEETCODE_HANDLE?.trim() || null,
    uptimeTargets: parseUptimeTargets(env.UPTIME_TARGETS),
    feedUrl: env.FEED_URL?.trim() || null,
  };
}
