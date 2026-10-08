import { describe, it, expect } from "vitest";
import { featuredPanel } from "../panels/md/featured.js";
import { stackPanel } from "../panels/md/stack.js";
import { logPanel } from "../panels/md/log.js";
import { writingPanel } from "../panels/md/writing.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";
import type { RankedRepo, FeedItem } from "../types.js";

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
  it("shows curated live projects first when ranked repos exist", () => {
    const rows = featuredPanel.select(ranked)!;
    expect(rows.map((r) => r.name)).toEqual(["GenAI Media Platform", "Creator Marketplace", "todayeggrates"]);
  });

  const withRepo = (over: Partial<RankedRepo>, fields: Partial<Snapshot["fields"]> = {}): Snapshot => ({
    ...FIXTURE,
    fields: { ...FIXTURE.fields, ...fields },
    featured: [{ name: "repo", url: "https://github.com/ReaperOAK/repo", description: "d", stack: "TS", score: 1, ...over }],
  });
  const lastRow = (ctx: Snapshot) => featuredPanel.render(featuredPanel.select(ctx)!, ctx).split("\n").at(-1);

  it("escapes a pipe and flattens newlines in a description so the table row survives", () => {
    const ctx = withRepo({ description: "Fast | reliable\nqueue\r\nworker" });
    expect(lastRow(ctx)).toBe("| **[repo](https://github.com/ReaperOAK/repo)** | Fast \\| reliable queue worker | `TS` |");
  });

  it("renders an empty stack as an empty cell, not a pair of backticks", () => {
    const ctx = withRepo({ stack: "" });
    expect(lastRow(ctx)).toBe("| **[repo](https://github.com/ReaperOAK/repo)** | d |  |");
    expect(featuredPanel.render(featuredPanel.select(ctx)!, ctx)).not.toContain("``");
  });

  it("looks blurbs up by own property: a repo named `constructor` keeps its description", () => {
    const ctx = withRepo({ name: "constructor", description: "A real description" });
    const out = featuredPanel.render(featuredPanel.select(ctx)!, ctx);
    expect(out).toContain("A real description");
    expect(out).not.toContain("function");
  });

  it("uses a curated blurb for a repo when one exists", () => {
    const ctx = withRepo({ description: "from github" }, { featuredBlurbs: { repo: "curated blurb" } });
    expect(lastRow(ctx)).toContain("| curated blurb |");
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

  it("replaces the static Languages row with the measured one rather than listing both", () => {
    const ctx: Snapshot = { ...FIXTURE, languages: [{ name: "TypeScript", color: "#3178c6", pct: 41.2 }] };
    const out = stackPanel.render(stackPanel.select(ctx)!, ctx);
    expect(out).toContain("**Languages · measured**");
    expect(out).not.toContain("**Languages**");
    expect(out).toContain("**Frontend**"); // the other curated rows stay
  });

  it("rounds the percentage to nearest, not down", () => {
    const ctx: Snapshot = { ...FIXTURE, languages: [{ name: "TypeScript", color: "#3178c6", pct: 41.6 }] };
    expect(stackPanel.render(stackPanel.select(ctx)!, ctx)).toContain("TypeScript 42%");
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

  const post = (over: Partial<FeedItem>): Snapshot => ({
    ...FIXTURE, feed: [{ title: "T", url: "https://blog.example/a", date: "", ...over }],
  });
  const line = (ctx: Snapshot) => writingPanel.render(writingPanel.select(ctx)!, ctx).split("\n").at(-1);

  it("adds the date when there is one and nothing when there is not", () => {
    expect(line(post({ date: "2026-09-06" }))).toBe("- [T](https://blog.example/a) — <sub>2026-09-06</sub>");
    expect(line(post({ date: "" }))).toBe("- [T](https://blog.example/a)");
  });

  it("escapes brackets so a title cannot close the link early", () => {
    expect(line(post({ title: "Rates [update]" }))).toBe("- [Rates \\[update\\]](https://blog.example/a)");
  });

  it("escapes every character that could start markup, backslash included", () => {
    expect(line(post({ title: "<>[]\\" }))).toBe("- [&lt;&gt;\\[\\]\\\\](https://blog.example/a)");
  });

  it("does not let a backslash defeat the bracket escape and smuggle in a second link", () => {
    expect(line(post({ title: "foo\\](https://evil.example)" })))
      .toBe("- [foo\\\\\\](https://evil.example)](https://blog.example/a)");
  });

  it("does not render an html title or date as html", () => {
    const out = line(post({ title: "<img src=x onerror=alert(1)>", date: "<b>today</b>" }))!;
    expect(out).not.toMatch(/<(img|b)\b/);
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).toContain("<sub>&lt;b&gt;today&lt;/b&gt;</sub>");
  });
});
