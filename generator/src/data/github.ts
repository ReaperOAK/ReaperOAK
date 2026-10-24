import type { Config } from "../config.js";
import type { GithubSnapshot, RepoNode } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "github-snapshot";
const EMPTY: GithubSnapshot = {
  recentCommitMessages: [], totalContributions: 0, currentStreakDays: 0,
  commits: 0, prs: 0, reviews: 0, issues: 0, calendar: [], repos: [],
  fetchedAt: new Date(0).toISOString(),
};

// The GraphQL response is untrusted JSON: a missing field or a non-numeric value would
// otherwise make Number(...) silently produce NaN, which then propagates into the snapshot.
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// The on-disk cache is also untrusted: readCache is a bare JSON.parse with no runtime
// check, and the file may predate a schema change (missing fields) or simply be corrupt
// (wrong types). Unlike num() above, this does NOT coerce "12" -> 12 -- a wrong type means
// the value is not trustworthy, so it falls back rather than being guessed at.
function finiteNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function strOr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function calendarArray(v: unknown): Array<{ date: string; count: number }> {
  if (!Array.isArray(v)) return [];
  return v
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && typeof d.date === "string")
    .map((d) => ({ date: d.date as string, count: finiteNum(d.count, 0) }));
}

function languageArray(v: unknown): RepoNode["languages"] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object" && typeof l.name === "string")
    .map((l) => ({ name: l.name as string, color: typeof l.color === "string" ? l.color : null, size: finiteNum(l.size, 0) }));
}

function repoArray(v: unknown): RepoNode[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is Record<string, unknown> =>
      !!r && typeof r === "object" && typeof r.name === "string" && typeof r.url === "string")
    .map((r) => ({
      name: r.name as string,
      url: r.url as string,
      description: typeof r.description === "string" ? r.description : null,
      homepageUrl: typeof r.homepageUrl === "string" ? r.homepageUrl : null,
      stars: finiteNum(r.stars, 0),
      forks: finiteNum(r.forks, 0),
      pushedAt: strOr(r.pushedAt, new Date(0).toISOString()),
      isFork: typeof r.isFork === "boolean" ? r.isFork : false,
      isArchived: typeof r.isArchived === "boolean" ? r.isArchived : false,
      commitsLastYear: finiteNum(r.commitsLastYear, 0),
      languages: languageArray(r.languages),
    }));
}

// Choke point: every path that returns a cached snapshot (no token, fetch failure) routes
// through here. Whatever readCache hands back -- old schema, corrupt types, or a perfectly
// good snapshot -- comes out as a fully-populated, correctly-typed GithubSnapshot. A missing
// or wrong-typed field falls back to EMPTY value for that field, never to a guess.
function normaliseSnapshot(raw: unknown): GithubSnapshot {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    recentCommitMessages: stringArray(r.recentCommitMessages),
    totalContributions: finiteNum(r.totalContributions, EMPTY.totalContributions),
    currentStreakDays: finiteNum(r.currentStreakDays, EMPTY.currentStreakDays),
    commits: finiteNum(r.commits, EMPTY.commits),
    prs: finiteNum(r.prs, EMPTY.prs),
    reviews: finiteNum(r.reviews, EMPTY.reviews),
    issues: finiteNum(r.issues, EMPTY.issues),
    calendar: calendarArray(r.calendar),
    repos: repoArray(r.repos),
    // A missing fetchedAt falls back to the epoch (EMPTY), never to now -- an old cache
    // must not claim to be fresh. A valid cached fetchedAt is passed through untouched.
    fetchedAt: strOr(r.fetchedAt, EMPTY.fetchedAt),
  };
}

function cachedSnapshot(): GithubSnapshot {
  return normaliseSnapshot(readCache<unknown>(CACHE_KEY));
}

const QUERY = `query($login:String!, $since:GitTimestamp!){
  user(login:$login){
    contributionsCollection{
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      contributionCalendar{ totalContributions weeks{ contributionDays{ contributionCount date } } }
    }
    repositories(first:100, ownerAffiliations:OWNER, orderBy:{field:PUSHED_AT, direction:DESC}, isFork:false){
      nodes{
        name url description homepageUrl stargazerCount forkCount pushedAt isFork isArchived
        languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } }
        defaultBranchRef{ target{ ... on Commit {
          history(first:5, since:$since){ totalCount nodes{ message } } } } }
      }
    }
  }
}`;

export function computeStreak(
  weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>,
  todayISO: string = new Date().toISOString().slice(0, 10),
): number {
  // Drop future-dated padding in the current week, then walk newest → oldest.
  const days = weeks.flatMap((w) => w.contributionDays)
    .filter((d) => d.date <= todayISO)
    .sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    if (days[i]!.contributionCount > 0) streak++;
    else if (i === 0) continue; // today may have no commits yet — don't break the streak
    else break;
  }
  return streak;
}

export async function getGithubSnapshot(config: Config, fetchImpl: typeof fetch = fetch): Promise<GithubSnapshot> {
  if (!config.githubToken) return cachedSnapshot();
  try {
    const res = await fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${config.githubToken}`, "content-type": "application/json",
        "user-agent": "reaperoak-readme-generator" },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          login: config.githubLogin,
          since: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
        },
      }),
    });
    if (!res.ok) throw new Error(`github ${res.status}`);
    const json = (await res.json()) as any;
    const u = json?.data?.user;
    if (!u) throw new Error("no user in response");
    const cc = u.contributionsCollection;
    const cal = cc.contributionCalendar;

    // Raw, unfiltered — used below for both the commit-message flatten and the repo mapping,
    // each of which applies its own tolerance for missing fields.
    const repoNodes: any[] = u.repositories?.nodes ?? [];

    // A node without a name/url isn't a usable repo — omit it rather than fabricate "undefined".
    const repos: RepoNode[] = repoNodes
      .filter((r: any) => typeof r?.name === "string" && typeof r?.url === "string")
      .map((r: any) => ({
        name: r.name,
        url: r.url,
        description: r.description ?? null,
        homepageUrl: r.homepageUrl || null,
        stars: num(r.stargazerCount),
        forks: num(r.forkCount),
        pushedAt: String(r.pushedAt ?? new Date(0).toISOString()),
        isFork: Boolean(r.isFork),
        isArchived: Boolean(r.isArchived),
        commitsLastYear: num(r.defaultBranchRef?.target?.history?.totalCount),
        languages: (r.languages?.edges ?? [])
          .filter((e: any) => typeof e?.node?.name === "string")
          .map((e: any) => ({
            name: e.node.name, color: e.node.color ?? null, size: num(e.size),
          })),
      }));

    // A non-string message is dropped rather than stringified — String(undefined) would
    // otherwise leak the literal text "undefined" into the README as a "commit message".
    const messages: string[] = repoNodes
      .flatMap((n: any) => n?.defaultBranchRef?.target?.history?.nodes ?? [])
      .map((c: any) => (typeof c?.message === "string" ? c.message.split("\n")[0]! : null))
      .filter((m): m is string => Boolean(m))
      .slice(0, 12);

    // Same reasoning for calendar days: a day missing its date is dropped, not stringified.
    const calendar = (cal.weeks ?? [])
      .flatMap((w: any) => w.contributionDays ?? [])
      .filter((d: any) => typeof d?.date === "string")
      .map((d: any) => ({ date: d.date, count: num(d.contributionCount) }));

    const snap: GithubSnapshot = {
      recentCommitMessages: messages,
      totalContributions: num(cal.totalContributions),
      currentStreakDays: computeStreak(cal.weeks ?? []),
      commits: num(cc.totalCommitContributions),
      prs: num(cc.totalPullRequestContributions),
      reviews: num(cc.totalPullRequestReviewContributions),
      issues: num(cc.totalIssueContributions),
      calendar,
      repos,
      fetchedAt: new Date().toISOString(),
    };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return cachedSnapshot();
  }
}
