import type { Config } from "../config.js";
import type { GithubSnapshot } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "github-snapshot";
const EMPTY: GithubSnapshot = { recentCommitMessages: [], totalContributions: 0, currentStreakDays: 0 };

const QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      contributionCalendar{ totalContributions weeks{ contributionDays{ contributionCount date } } }
    }
    repositories(first:10, ownerAffiliations:OWNER, orderBy:{field:PUSHED_AT, direction:DESC}, isFork:false){
      nodes{ defaultBranchRef{ target{ ... on Commit { history(first:5){ nodes{ message } } } } } }
    }
  }
}`;

function computeStreak(weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>): number {
  const days = weeks.flatMap((w) => w.contributionDays).sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const d of days) { if (d.contributionCount > 0) streak++; else break; }
  return streak;
}

export async function getGithubSnapshot(config: Config, fetchImpl: typeof fetch = fetch): Promise<GithubSnapshot> {
  if (!config.githubToken) return readCache<GithubSnapshot>(CACHE_KEY) ?? EMPTY;
  try {
    const res = await fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${config.githubToken}`, "content-type": "application/json",
        "user-agent": "reaperoak-readme-generator" },
      body: JSON.stringify({ query: QUERY, variables: { login: config.githubLogin } }),
    });
    if (!res.ok) throw new Error(`github ${res.status}`);
    const json = (await res.json()) as any;
    const u = json?.data?.user;
    if (!u) throw new Error("no user in response");
    const cal = u.contributionsCollection.contributionCalendar;
    const messages: string[] = (u.repositories.nodes ?? [])
      .flatMap((n: any) => n?.defaultBranchRef?.target?.history?.nodes ?? [])
      .map((c: any) => String(c.message).split("\n")[0])
      .filter(Boolean)
      .slice(0, 12);
    const snap: GithubSnapshot = {
      recentCommitMessages: messages,
      totalContributions: cal.totalContributions ?? 0,
      currentStreakDays: computeStreak(cal.weeks ?? []),
    };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return readCache<GithubSnapshot>(CACHE_KEY) ?? EMPTY;
  }
}
