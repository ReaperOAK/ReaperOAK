export interface Config {
  githubToken: string | null;
  githubLogin: string;
  openRouter: { key: string; model: string } | null;
  wakatimeEnabled: boolean;
}

const DEFAULT_MODEL = "openai/gpt-4o-mini"; // cheap + fast; swappable via env

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const key = env.OPENROUTER_API_KEY?.trim();
  return {
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubLogin: env.GITHUB_LOGIN?.trim() || "ReaperOAK",
    openRouter: key ? { key, model: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL } : null,
    wakatimeEnabled: Boolean(env.WAKATIME_API_KEY?.trim()),
  };
}
