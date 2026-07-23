import type { Config } from "../config.js";
/** WakaTime is intentionally off unless a key exists. Returns null so callers omit the section. */
export async function getWakatime(config: Config): Promise<null> {
  if (!config.wakatimeEnabled) return null;
  return null; // real fetch deferred; keeping the profile from ever showing an empty widget
}
