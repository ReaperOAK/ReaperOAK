import { describe, it, expect } from "vitest";
import { featuredPanel } from "../panels/md/featured.js";
import { stackPanel } from "../panels/md/stack.js";
import { logPanel } from "../panels/md/log.js";
import { writingPanel } from "../panels/md/writing.js";
import { parseFeed } from "../data/feed.js";
import { FIXTURE, INJECTED_FEED_XML } from "./fixtures.js";
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

  it("escapes html and brackets in a description, not just pipes", () => {
    const ctx = withRepo({ description: "Wraps <script>alert(1)</script> and [x]" });
    expect(lastRow(ctx)).toBe(
      "| **[repo](https://github.com/ReaperOAK/repo)** | Wraps &lt;script&gt;alert(1)&lt;/script&gt; and \\[x\\] | `TS` |");
  });

  it("keeps a name or stack holding a pipe or newline from breaking the row", () => {
    const ctx = withRepo({ name: "a|b", stack: "C|D\nE" });
    expect(lastRow(ctx)).toBe("| **[a\\|b](https://github.com/ReaperOAK/repo)** | d | `C\\|D E` |");
  });

  // Ranked repos carry GitHub text. Anything LEAK_PATTERN matches must not reach the README.
  const repo = (name: string, over: Partial<RankedRepo> = {}): RankedRepo => ({
    name, url: `https://github.com/ReaperOAK/${name}`, description: "d", stack: "TS", score: 1, ...over,
  });
  const table = (...repos: RankedRepo[]) => {
    const ctx: Snapshot = { ...FIXTURE, featured: repos };
    return featuredPanel.render(featuredPanel.select(ctx)!, ctx);
  };
  /** The ranked rows only: the two curated live projects have no github url. */
  const repoRows = (out: string) => out.split("\n").filter((l) => l.includes("github.com/ReaperOAK/"));

  it.each([
    "NaN-safe math utilities",
    "Handles undefined inputs",
    "Guards the Infinity case",
    "Prints [object Object] on error",
    "Template {{ name }} renderer",
  ])("blanks a description that would leak and keeps the repo: %s", (description) => {
    expect(repoRows(table(repo("a"), repo("b", { description }), repo("c")))).toEqual([
      "| **[a](https://github.com/ReaperOAK/a)** | d | `TS` |",
      "| **[b](https://github.com/ReaperOAK/b)** |  | `TS` |",
      "| **[c](https://github.com/ReaperOAK/c)** | d | `TS` |",
    ]);
  });

  it.each([
    ["name", { name: "NaN-utils" }],
    ["url", { url: "https://github.com/ReaperOAK/undefined" }],
    ["stack", { stack: "TS · undefined" }],
  ])("drops a repo whose %s would leak", (_label, over) => {
    const bad = repo("b", { url: "https://github.com/ReaperOAK/b", ...over });
    expect(repoRows(table(repo("a"), bad, repo("c")))).toEqual([
      "| **[a](https://github.com/ReaperOAK/a)** | d | `TS` |",
      "| **[c](https://github.com/ReaperOAK/c)** | d | `TS` |",
    ]);
  });

  it("lets the next-ranked repo take the row of one that was dropped", () => {
    const repos = Array.from({ length: 7 }, (_, i) => repo(i === 1 ? "undefined" : `r${i}`));
    const ctx: Snapshot = { ...FIXTURE, featured: repos };
    expect(featuredPanel.select(ctx)!.map((r) => r.name))
      .toEqual(["GenAI Media Platform", "Creator Marketplace", "r0", "r2", "r3", "r4"]);
  });

  it("falls back to the curated list rather than an empty table when every ranked repo leaks", () => {
    const ctx: Snapshot = { ...FIXTURE, featured: [repo("NaN-utils")] };
    expect(featuredPanel.select(ctx)).toEqual(featuredPanel.select(FIXTURE));
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

  it("escapes a pipe in a title", () => {
    expect(line(post({ title: "Rates | update" }))).toBe("- [Rates \\| update](https://blog.example/a)");
  });

  // The end-to-end case: a CDATA title and date that try to start a heading, a rule and a list
  // must come out as inert text on the post's own line, and break neither the link nor the list.
  it("renders a feed title and date that carry newlines as one line each", () => {
    const ctx: Snapshot = { ...FIXTURE, feed: parseFeed(INJECTED_FEED_XML) };
    expect(writingPanel.render(writingPanel.select(ctx)!, ctx)).toBe([
      "<!-- section:writing -->",
      "### Writing",
      "",
      "- [Real post ## Injected heading --- - fake list](https://blog.example/a) — <sub>2026-09-06</sub>",
      "- [Second post](https://blog.example/b)",
    ].join("\n"));
  });

  // Cached items skip the parser, so the panel has to hold the line on its own.
  it("flattens a title and date that arrive with newlines, as a cached item could", () => {
    expect(line(post({ title: "Real post\n\n## Injected", date: "2026-09-06\n\n## Injected" })))
      .toBe("- [Real post ## Injected](https://blog.example/a) — <sub>2026-09-06 ## Injected</sub>");
  });

  it("does not render an html title or date as html", () => {
    const out = line(post({ title: "<img src=x onerror=alert(1)>", date: "<b>today</b>" }))!;
    expect(out).not.toMatch(/<(img|b)\b/);
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).toContain("<sub>&lt;b&gt;today&lt;/b&gt;</sub>");
  });
});
