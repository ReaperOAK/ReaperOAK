import { describe, it, expect } from "vitest";
import { activeMarkdownPanels, activeSvgPanels } from "../panels/index.js";
import type { Snapshot, MarkdownPanel } from "../panels/types.js";

const EMPTY: Snapshot = {
  github: { recentCommitMessages: [], totalContributions: 0, currentStreakDays: 0,
    commits: 0, prs: 0, reviews: 0, issues: 0, calendar: [], repos: [], fetchedAt: "2026-09-06T00:00:00.000Z" },
  languages: null, featured: null, waka: null, leetcode: null,
  neetcode: null, uptime: null, feed: null,
  syncedAt: "2026-09-06T00:00:00.000Z",
  fields: { tagline: "t", recentWork: "r", thinkingAbout: "k", engineeringLog: [], featuredBlurbs: {} },
};

const yes: MarkdownPanel<string> = {
  id: "yes", kind: "markdown", select: () => "data", render: (d) => `<!-- section:yes -->\n${d}`,
};
const no: MarkdownPanel<string> = {
  id: "no", kind: "markdown", select: () => null, render: () => "never",
};

describe("panel registry", () => {
  it("keeps panels whose select returns data", () => {
    const out = activeMarkdownPanels(EMPTY, [yes]);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toContain("data");
  });

  it("omits panels whose select returns null", () => {
    expect(activeMarkdownPanels(EMPTY, [no])).toHaveLength(0);
  });

  it("preserves registry order", () => {
    const a: MarkdownPanel<string> = { ...yes, id: "a", render: () => "A" };
    const b: MarkdownPanel<string> = { ...yes, id: "b", render: () => "B" };
    expect(activeMarkdownPanels(EMPTY, [a, b]).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("omits an svg panel whose select returns null", () => {
    expect(activeSvgPanels(EMPTY, [
      { id: "s", kind: "svg", size: { w: 10, h: 10 }, select: () => null, render: () => "<g/>" },
    ])).toHaveLength(0);
  });
});
