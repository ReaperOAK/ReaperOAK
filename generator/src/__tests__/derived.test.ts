import { describe, it, expect } from "vitest";
import { featuredPanel } from "../panels/md/featured.js";
import { stackPanel } from "../panels/md/stack.js";
import { logPanel } from "../panels/md/log.js";
import { writingPanel } from "../panels/md/writing.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const ranked: Snapshot = { ...FIXTURE, featured: [
  { name: "todayeggrates", url: "https://github.com/ReaperOAK/todayeggrates",
    description: "Daily commodity rates", stack: "JavaScript · MDX", score: 0.9 },
] };

describe("featuredPanel", () => {
  it("prefers ranked repos over the static list", () => {
    const out = featuredPanel.render(featuredPanel.select(ranked)!, ranked);
    expect(out).toContain("todayeggrates");
    expect(out).toContain("Daily commodity rates");
  });

  it("falls back to the static list when ranking produced nothing", () => {
    const out = featuredPanel.render(featuredPanel.select(FIXTURE)!, FIXTURE);
    expect(out).toContain("GenAI Media Platform");
  });

  it("renders every project as a real markdown link", () => {
    const out = featuredPanel.render(featuredPanel.select(ranked)!, ranked);
    expect(out).toContain("](https://github.com/ReaperOAK/todayeggrates)");
  });

  // Defect fix: Unreleased curated products aren't GitHub repos, so rankRepos never sees them.
  // Without this, a ranked list silently drops the two live projects.
  it("shows curated live projects first when ranked repos exist, with no duplicates", () => {
    const withDup: Snapshot = { ...FIXTURE, featured: [
      { name: "GenAI Media Platform", url: "https://github.com/ReaperOAK/GenAI-Media-Platform",
        description: "duplicate of the curated entry", stack: "x", score: 0.5 },
      { name: "todayeggrates", url: "https://github.com/ReaperOAK/todayeggrates",
        description: "Daily commodity rates", stack: "JavaScript · MDX", score: 0.9 },
    ] };
    const rows = featuredPanel.select(withDup)!;
    const names = rows.map((r) => r.name);
    expect(names[0]).toBe("GenAI Media Platform");
    expect(names[1]).toBe("Creator Marketplace");
    expect(names.filter((n) => n === "GenAI Media Platform")).toHaveLength(1);
    expect(names).toContain("todayeggrates");

    const out = featuredPanel.render(rows, withDup);
    expect(out).toContain("| **GenAI Media Platform** |"); // the curated row, not the ranked-repo duplicate
  });

  it("caps combined curated + ranked rows at 6", () => {
    const many: Snapshot = { ...FIXTURE, featured: Array.from({ length: 10 }, (_, i) => ({
      name: `repo${i}`, url: `https://github.com/ReaperOAK/repo${i}`,
      description: "d", stack: "TS", score: 1 - i * 0.01,
    })) };
    expect(featuredPanel.select(many)!.length).toBe(6);
  });
});

describe("stackPanel", () => {
  it("uses the measured language mix when available", () => {
    const ctx: Snapshot = { ...FIXTURE, languages: [
      { name: "TypeScript", color: "#3178c6", pct: 41.2 },
      { name: "Python", color: "#3572A5", pct: 22.0 },
    ] };
    const out = stackPanel.render(stackPanel.select(ctx)!, ctx);
    expect(out).toContain("TypeScript 41%");
    expect(out).toContain("Python 22%");
  });

  it("falls back to the static language list when there is no measurement", () => {
    const out = stackPanel.render(stackPanel.select(FIXTURE)!, FIXTURE);
    expect(out).toContain("**Languages**");
  });
});

describe("logPanel", () => {
  it("omits itself when the log is empty rather than inventing entries", () => {
    expect(logPanel.select(FIXTURE)).toBeNull();
  });

  it("renders one bullet per log line", () => {
    const ctx: Snapshot = { ...FIXTURE, fields: { ...FIXTURE.fields,
      engineeringLog: ["Shipped the telemetry canvas", "Hardened readme validation"] } };
    const out = logPanel.render(logPanel.select(ctx)!, ctx);
    expect((out.match(/^- /gm) ?? []).length).toBe(2);
  });
});

describe("writingPanel", () => {
  it("omits itself while there is no feed", () => {
    expect(writingPanel.select(FIXTURE)).toBeNull();
  });

  it("renders posts as real markdown links when a feed exists", () => {
    const ctx: Snapshot = { ...FIXTURE, feed: [
      { title: "Honest backtests", url: "https://blog.example/a", date: "2026-09-06" },
    ] };
    const out = writingPanel.render(writingPanel.select(ctx)!, ctx);
    expect(out).toContain("[Honest backtests](https://blog.example/a)");
  });
});
