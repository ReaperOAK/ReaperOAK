export interface Config {
  githubToken: string | null;
  githubLogin: string;
  openRouter: { key: string; model: string } | null;
  wakatimeEnabled: boolean;
}

// Free OpenRouter model (zero cost, rate-limited). Any failure degrades to cache→static,
// so rate-limit hits never break the profile. Swap via OPENROUTER_MODEL env.
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const key = env.OPENROUTER_API_KEY?.trim();
  return {
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubLogin: env.GITHUB_LOGIN?.trim() || "ReaperOAK",
    openRouter: key ? { key, model: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL } : null,
    wakatimeEnabled: Boolean(env.WAKATIME_API_KEY?.trim()),
  };
}
