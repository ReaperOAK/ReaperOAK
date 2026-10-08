import type { Snapshot } from "../panels/types.js";

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
