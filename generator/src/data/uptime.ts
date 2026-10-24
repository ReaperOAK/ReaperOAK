import type { Config, UptimeTarget } from "../config.js";
import type { UptimeResult } from "../types.js";

const TIMEOUT_MS = 5000;

function request(target: UptimeTarget, method: "HEAD" | "GET", fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(target.url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "reaperoak-readme-generator" },
  });
}

/**
 * Live HEAD checks. Deliberately uncached — a stale "up" is worse than no reading,
 * so a failed check reports null rather than the last good status.
 */
export async function checkUptime(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<UptimeResult[] | null> {
  if (config.uptimeTargets.length === 0) return null;

  return Promise.all(config.uptimeTargets.map(async (target): Promise<UptimeResult> => {
    const started = Date.now();
    try {
      let res = await request(target, "HEAD", fetchImpl);
      // Some servers reject HEAD outright (405 Method Not Allowed / 501 Not Implemented)
      // while being perfectly reachable via GET. Retry once before trusting that status —
      // otherwise a live target reads as broken.
      if (res.status === 405 || res.status === 501) {
        res = await request(target, "GET", fetchImpl);
        // Only the status matters. Cancel the body so the full page isn't downloaded and
        // the connection is released — an unread body can hold the process open.
        await res.body?.cancel().catch(() => {});
      }
      return { label: target.label, url: target.url, status: res.status, ms: Date.now() - started };
    } catch {
      return { label: target.label, url: target.url, status: null, ms: null };
    }
  }));
}
