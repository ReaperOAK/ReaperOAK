export interface Config {
  githubToken: string | null;
  githubLogin: string;
  openRouter: { key: string; models: string[] } | null;
  wakatimeEnabled: boolean;
}

// Ordered chain of free OpenRouter models. Each is tried in turn; the first to return
// valid output wins. If all fail (rate limit / unavailable / privacy setting), the caller
// degrades to last-good cache, then to the hardcoded static string. All zero-cost.
// Verified free via https://openrouter.ai/api/v1/models. Swap/extend via OPENROUTER_MODELS
// (comma-separated) or OPENROUTER_MODEL (single) env vars.
const FREE_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free", // auto-routes to any available free model — catch-all
];

function resolveModels(env: NodeJS.ProcessEnv): string[] {
  const list = env.OPENROUTER_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (list && list.length) return list;
  const single = env.OPENROUTER_MODEL?.trim();
  if (single) return [single];
  return FREE_MODELS;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const key = env.OPENROUTER_API_KEY?.trim();
  return {
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubLogin: env.GITHUB_LOGIN?.trim() || "ReaperOAK",
    openRouter: key ? { key, models: resolveModels(env) } : null,
    wakatimeEnabled: Boolean(env.WAKATIME_API_KEY?.trim()),
  };
}
