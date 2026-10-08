import type { Snapshot } from "../panels/types.js";
import type { Config } from "../config.js";

/** A config with one LLM model configured and every other source off. */
export const LLM_CONFIG: Config = {
  githubToken: null, githubLogin: "ReaperOAK",
  llm: { baseUrl: "https://openrouter.ai/api/v1", key: "k", models: ["m"] },
  wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};

/** The canonical empty-ish snapshot every test builds on. Every optional source is
 *  null, so any panel that appears against this fixture appears unconditionally. */
export const FIXTURE: Snapshot = {
  github: { recentCommitMessages: ["feat: a"], totalContributions: 1234, currentStreakDays: 7,
    commits: 900, prs: 60, reviews: 30, issues: 12, calendar: [], repos: [],
    fetchedAt: "2026-09-06T13:44:00.000Z" },
  languages: null, featured: null, waka: null, leetcode: null,
  neetcode: null, uptime: null, feed: null,
  syncedAt: "2026-09-06T13:44:00.000Z",
  fields: {
    tagline: "TAGLINE", recentWork: "RECENT WORK", thinkingAbout: "THINKING",
    engineeringLog: [],
    featuredBlurbs: {},
  },
};

/** FIXTURE.github with three real commits: the fewest for the engineering log to be generated. */
export const GITHUB_3_COMMITS = {
  ...FIXTURE.github,
  recentCommitMessages: ["feat: a", "fix: b", "feat: c"],
};

/** Model text no panel may print, each with the reason. Used against the sanitisers and the
 *  cache readers alike, since both gate on the same predicate. */
export const UNSAFE_LLM_TEXT: ReadonlyArray<readonly [string, string]> = [
  ["an empty string", ""],
  ["a blank string", "   "],
  ["a line break", "first\nsecond"],
  ["a carriage return", "first\rsecond"],
  ["a code fence", "run ```rm``` now"],
  ["html", "Shipped <b>it</b>"],
  ["a markdown link", "See [notes](#top)"],
  ["an http url", "See https://evil.example now"],
  ["a www url", "See www.evil.example now"],
  ["a leak", "Fixed NaN propagation"],
];

/** A feed whose CDATA title and date try to start a heading, a rule and a list. */
export const INJECTED_FEED_XML = `<rss><channel>
<item><title><![CDATA[Real post

## Injected heading

---

- fake list]]></title><link>https://blog.example/a</link><pubDate>Sat, 06 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>Second post</title><link>https://blog.example/b</link><pubDate><![CDATA[2026-09-06

## Injected date]]></pubDate></item>
</channel></rss>`;
