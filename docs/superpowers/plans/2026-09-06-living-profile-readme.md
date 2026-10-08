# Living Profile README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing README generator into a living engineering dashboard — real telemetry panels above, long-form narrative below — where every widget shows true data or disappears.

**Architecture:** A panel registry replaces hand-written section functions. Each panel is one file that declares its data need via `select()`, returns `null` when it has no data, and renders either into an SVG box or to markdown. SVG panels are packed into four composite dual-theme canvases; markdown panels are concatenated in registry order. Data adapters all follow `fetch → cache on success → read cache on failure → null on miss`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Node ≥24, vitest, tsx. No runtime dependencies — `fetch` and `node:fs` only.

**Spec:** [`docs/superpowers/specs/2026-09-06-living-profile-readme-design.md`](../specs/2026-09-06-living-profile-readme-design.md)

## Global Constraints

- Node `>=24` (`generator/package.json` engines). No new runtime dependencies — devDependencies only.
- Zero paid APIs. Every source is free-tier or public.
- Palette is fixed, from `src/render/svg-util.ts`: dark `bg #0B0B0D`, `panel #0E0E11`, `ink #ECE7DE`, `mut #8F887B`, `accent #E8A33D`, `accent2 #C77B30`, `line rgba(255,255,255,0.08)`; light `bg #FBF8F2`, `panel #FFFFFF`, `ink #1A1712`, `mut #6B6459`, `accent #C77B30`, `accent2 #A15E1E`, `line rgba(0,0,0,0.10)`. Never introduce a new colour literal in a panel — read from `Tokens`.
- No third-party badge or stat services (shields.io, capsule-render, github-readme-stats). All SVG is generated in-repo.
- **Null-omission rule:** `select()` returning `null` omits the panel entirely. A panel never renders a frame around missing data, and never renders a zero as if it were real.
- **Split rule:** images carry shape, markdown carries meaning. Every project name, repo link, and commit message is real markdown. Never bake a link into an SVG.
- **Sync stamp never lies.** If data came from cache, the stamp shows when that data was *fetched*, not when the job ran.
- All tests live in `generator/src/__tests__/*.test.ts` (vitest `include` is `src/**/*.test.ts`).
- Every ESM import of a local module uses the `.js` extension, e.g. `import { x } from "../cache.js"`.
- Commands run from `generator/`.
- Shared test fixtures live in `generator/src/__tests__/fixtures.ts` (a plain module, never collected as a suite). Never export a fixture from a `.test.ts` file.
- This project has no eslint. Do not add eslint directives or comments.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/panels/types.ts` | `Panel`, `SvgPanel`, `MarkdownPanel`, `Box`, `Snapshot` |
| `src/panels/index.ts` | The registry — one ordered array; adding a panel is one line here |
| `src/panels/md/*.ts` | One markdown panel per file |
| `src/panels/svg/*.ts` | One SVG panel per file |
| `src/render/svg/primitives.ts` | `frame`, `counter`, `bar`, `heatGrid`, `gauge`, `statusDot` |
| `src/render/compose.ts` | Packs SVG panels into a named composite canvas |
| `src/data/languages.ts` | `computeLanguageShares` — pure |
| `src/data/ranking.ts` | `rankRepos` — pure |
| `src/data/neetcode.ts` | Distinct-problem count from the submissions repo tree |
| `src/data/leetcode.ts` | Public LeetCode GraphQL |
| `src/data/uptime.ts` | HEAD checks |
| `src/data/feed.ts` | RSS/Atom — written, inert until `FEED_URL` |

**Modified:**

| Path | Change |
|---|---|
| `src/types.ts` | Expanded `GithubSnapshot`; new data-shape interfaces |
| `src/config.ts` | New env: LLM gateway, WakaTime, LeetCode handle, uptime targets, feed URL |
| `src/data/github.ts` | Expanded GraphQL query |
| `src/data/wakatime.ts` | Real fetch, replaces the `null` stub |
| `src/render/markdown.ts` | Becomes a thin registry-driven assembler |
| `src/assemble.ts` | Composite canvases; hardened validation |
| `src/main.ts` | Builds the full `Snapshot` from all adapters |
| `src/llm/openrouter.ts` → `src/llm/gateway.ts` | Configurable base URL; OmniRoute primary, OpenRouter fallback |
| `src/content.ts` | Case studies, roadmap, principles, pins/blocks |
| `.github/workflows/readme.yml` | Self-hosted runner, new secrets |

**Deleted:** `src/render/svg-stats.ts`, `assets/stats-dark.svg`, `assets/stats-light.svg` (superseded by the telemetry canvas).

---

## Task 1: Panel contract and registry

**Files:**
- Create: `generator/src/panels/types.ts`
- Create: `generator/src/panels/index.ts`
- Test: `generator/src/__tests__/panels.test.ts`

**Interfaces:**
- Consumes: `GithubSnapshot`, `DynamicFields` from `src/types.ts`.
- Produces: `Box`, `Snapshot`, `SvgPanel<D>`, `MarkdownPanel<D>`, `Panel`, `PANELS`, `activeMarkdownPanels()`, `activeSvgPanels()`.

Note on the shape: the spec sketched one interface with two optional render methods. This uses a discriminated union instead, so TypeScript can prove a markdown panel never reaches the SVG composer. Same contract, checked at compile time.

- [ ] **Step 1: Write the failing test**

Create `generator/src/__tests__/panels.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activeMarkdownPanels, activeSvgPanels } from "../panels/index.js";
import type { Snapshot, MarkdownPanel } from "../panels/types.js";

const EMPTY: Snapshot = {
  github: { recentCommitMessages: [], totalContributions: 0, currentStreakDays: 0,
    commits: 0, prs: 0, reviews: 0, issues: 0, calendar: [], repos: [], fetchedAt: "2026-09-06T00:00:00.000Z" },
  languages: null, featured: null, waka: null, leetcode: null,
  neetcode: null, uptime: null, feed: null,
  syncedAt: "2026-09-06T00:00:00.000Z",
  fields: { tagline: "t", recentWork: "r", thinkingAbout: "k", featuredBlurbs: {} },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/panels.test.ts`
Expected: FAIL — `Failed to resolve import "../panels/index.js"`

- [ ] **Step 3: Write the panel contract**

Create `generator/src/panels/types.ts`:

```ts
import type { Tokens } from "../render/svg-util.js";
import type { DynamicFields, GithubSnapshot } from "../types.js";
import type { LanguageShare, RankedRepo, WakaSnapshot, LeetcodeSnapshot,
  NeetcodeSnapshot, UptimeResult, FeedItem } from "../types.js";

/** A rectangle a panel draws inside. The composer decides x/y; the panel never does. */
export interface Box { x: number; y: number; w: number; h: number; }

/** Everything a panel may read. Null on a field means that source had nothing to say. */
export interface Snapshot {
  github: GithubSnapshot;
  languages: LanguageShare[] | null;
  featured: RankedRepo[] | null;
  waka: WakaSnapshot | null;
  leetcode: LeetcodeSnapshot | null;
  neetcode: NeetcodeSnapshot | null;
  uptime: UptimeResult[] | null;
  feed: FeedItem[] | null;
  /** ISO timestamp of the DATA, not of the run. Cached data keeps its original fetch time. */
  syncedAt: string;
  fields: DynamicFields;
}

export interface SvgPanel<D> {
  id: string;
  kind: "svg";
  size: { w: number; h: number };
  /** Return null to omit this panel entirely. */
  select(ctx: Snapshot): D | null;
  render(d: D, t: Tokens, box: Box): string;
}

export interface MarkdownPanel<D> {
  id: string;
  kind: "markdown";
  /** Return null to omit this panel entirely. */
  select(ctx: Snapshot): D | null;
  render(d: D, ctx: Snapshot): string;
}

export type Panel = SvgPanel<any> | MarkdownPanel<any>;
```

- [ ] **Step 4: Write the registry**

Create `generator/src/panels/index.ts`:

```ts
import type { MarkdownPanel, Panel, Snapshot, SvgPanel } from "./types.js";

/** The registry. Adding a panel is one import and one entry here. */
export const PANELS: Panel[] = [];

export interface RenderedMarkdown { id: string; body: string; }
export interface ResolvedSvg { id: string; data: unknown; panel: SvgPanel<unknown>; }

/** Runs select() on each markdown panel and drops the ones with nothing to say. */
export function activeMarkdownPanels(
  ctx: Snapshot,
  panels: Panel[] = PANELS,
): RenderedMarkdown[] {
  const out: RenderedMarkdown[] = [];
  for (const p of panels) {
    if (p.kind !== "markdown") continue;
    const panel = p as MarkdownPanel<unknown>;
    const data = panel.select(ctx);
    if (data === null || data === undefined) continue;
    out.push({ id: panel.id, body: panel.render(data, ctx) });
  }
  return out;
}

/** Resolves svg panels to (panel, data) pairs, dropping the ones with nothing to say. */
export function activeSvgPanels(ctx: Snapshot, panels: Panel[] = PANELS): ResolvedSvg[] {
  const out: ResolvedSvg[] = [];
  for (const p of panels) {
    if (p.kind !== "svg") continue;
    const panel = p as SvgPanel<unknown>;
    const data = panel.select(ctx);
    if (data === null || data === undefined) continue;
    out.push({ id: panel.id, data, panel });
  }
  return out;
}
```

- [ ] **Step 5: Add the new types**

Append to `generator/src/types.ts`:

```ts
export interface RepoNode {
  name: string;
  url: string;
  description: string | null;
  homepageUrl: string | null;
  stars: number;
  forks: number;
  pushedAt: string;          // ISO
  isFork: boolean;
  isArchived: boolean;
  commitsLastYear: number;
  languages: Array<{ name: string; color: string | null; size: number }>;
}

export interface LanguageShare { name: string; color: string; pct: number; }

export interface RankedRepo {
  name: string; url: string; description: string; stack: string; score: number;
}

export interface WakaLanguage { name: string; seconds: number; pct: number; }
export interface WakaSnapshot { languages: WakaLanguage[]; totalSeconds: number; range: string; }

export interface LeetcodeSnapshot {
  handle: string; easy: number; medium: number; hard: number; total: number; ranking: number | null;
}

export interface NeetcodeSnapshot { solved: number; target: number; }

export interface UptimeResult { label: string; url: string; status: number | null; ms: number | null; }

export interface FeedItem { title: string; url: string; date: string; }
```

Then replace the existing `GithubSnapshot` interface in `generator/src/types.ts` with:

```ts
export interface GithubSnapshot {
  recentCommitMessages: string[];  // newest first, across owned repos
  totalContributions: number;      // last 12 months
  currentStreakDays: number;
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  calendar: Array<{ date: string; count: number }>;  // flat, newest last
  repos: RepoNode[];
  fetchedAt: string;               // ISO — when this data was actually fetched
}
```

- [ ] **Step 6: Keep the existing GitHub adapter compiling**

`src/data/github.ts` builds a `GithubSnapshot` and has an `EMPTY` constant. Both now miss fields. Update the constant in `generator/src/data/github.ts`:

```ts
const EMPTY: GithubSnapshot = {
  recentCommitMessages: [], totalContributions: 0, currentStreakDays: 0,
  commits: 0, prs: 0, reviews: 0, issues: 0, calendar: [], repos: [],
  fetchedAt: new Date(0).toISOString(),
};
```

And in the same file, extend the object built inside `getGithubSnapshot` so it type-checks — the real values arrive in Task 4:

```ts
    const snap: GithubSnapshot = {
      recentCommitMessages: messages,
      totalContributions: cal.totalContributions ?? 0,
      currentStreakDays: computeStreak(cal.weeks ?? []),
      commits: 0, prs: 0, reviews: 0, issues: 0, calendar: [], repos: [],
      fetchedAt: new Date().toISOString(),
    };
```

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: PASS — the four new panel tests plus all pre-existing tests.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no output (exit 0).

- [ ] **Step 9: Commit**

```bash
git add generator/src/panels generator/src/types.ts generator/src/data/github.ts generator/src/__tests__/panels.test.ts
git commit -m "feat(generator): add panel contract and registry"
```

---

## Task 2: Port markdown sections to panels

Behaviour-preserving refactor. The README output must not change. A characterization test locks the current output before anything moves.

**Files:**
- Create: `generator/src/panels/md/currently.ts`, `featured.ts`, `stack.ts`, `numbers.ts`, `connect.ts`, `coda.ts`
- Create: `generator/src/__tests__/fixtures.ts`
- Modify: `generator/src/render/markdown.ts`
- Modify: `generator/src/panels/index.ts`
- Test: `generator/src/__tests__/markdown-golden.test.ts`

`fixtures.ts` is a plain module, not a test file — vitest's `include` is `src/**/*.test.ts`, so it is never collected as a suite. Every later task imports `FIXTURE` from here. Do not export fixtures out of a `.test.ts` file.

**Interfaces:**
- Consumes: `activeMarkdownPanels`, `Snapshot`, `MarkdownPanel` from Task 1.
- Produces: `renderReadme(ctx: Snapshot): string` — signature changes from `(fields, snap)` to a single `Snapshot`. `SECTION_MARKERS` is removed; `assemble.ts` switches to deriving markers from the active panels in Task 13.

Hero and stats stay in `render/markdown.ts` for now — they move in Task 3.

- [ ] **Step 1: Write the shared fixture**

Create `generator/src/__tests__/fixtures.ts`:

```ts
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
    featuredBlurbs: {},
  },
};
```

- [ ] **Step 2: Write the characterization test**

Create `generator/src/__tests__/markdown-golden.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderReadme } from "../render/markdown.js";
import { FIXTURE } from "./fixtures.js";

describe("renderReadme", () => {
  it("emits every section marker in registry order", () => {
    const md = renderReadme(FIXTURE);
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order).toEqual([
      "hero", "currently", "featured", "engine-room", "numbers", "stats", "connect", "coda",
    ]);
  });

  it("renders the LLM fields verbatim", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("RECENT WORK");
    expect(md).toContain("THINKING");
  });

  it("falls back to each project's static problem line when no blurb is supplied", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("Generative-AI media platform orchestrating foundation models for image, video, and audio.");
  });

  it("separates sections with a horizontal rule", () => {
    expect(renderReadme(FIXTURE)).toContain("\n\n---\n\n");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/__tests__/markdown-golden.test.ts`
Expected: FAIL — `renderReadme` currently takes two arguments, so TypeScript rejects the single-argument call.

- [ ] **Step 4: Create the markdown panels**

Create `generator/src/panels/md/currently.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import type { DynamicFields } from "../../types.js";

export const currentlyPanel: MarkdownPanel<DynamicFields> = {
  id: "currently",
  kind: "markdown",
  select: (ctx) => ctx.fields,
  render: (f) => `<!-- section:currently -->
### Currently

- **Building** a GenAI Media Platform and a Creator Marketplace at Cornflakes Media.
- **This cycle** — ${f.recentWork}
- **Thinking about** — ${f.thinkingAbout}`,
};
```

Create `generator/src/panels/md/featured.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { FeaturedItem } from "../../types.js";

export const featuredPanel: MarkdownPanel<FeaturedItem[]> = {
  id: "featured",
  kind: "markdown",
  select: () => (content.featured.length ? content.featured : null),
  render: (items, ctx) => {
    const rows = items.map((f) => {
      const name = f.live ? `**[${f.title} ↗](${f.url})**` : `**[${f.title}](${f.url})**`;
      const blurb = ctx.fields.featuredBlurbs[f.title] ?? f.problem;
      return `| ${name} | ${blurb} | \`${f.stack}\` |`;
    }).join("\n");
    return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
  },
};
```

Create `generator/src/panels/md/stack.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { StatGroup } from "../../types.js";

export const stackPanel: MarkdownPanel<StatGroup[]> = {
  id: "engine-room",
  kind: "markdown",
  select: () => (content.stackGroups.length ? content.stackGroups : null),
  render: (groups) => {
    const lines = groups.map((g) => `- **${g.heading}** — ${g.items.join(" · ")}`).join("\n");
    return `<!-- section:engine-room -->
### The Engine Room

${lines}`;
  },
};
```

Create `generator/src/panels/md/numbers.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { StatNumber } from "../../types.js";

export const numbersPanel: MarkdownPanel<StatNumber[]> = {
  id: "numbers",
  kind: "markdown",
  select: () => (content.numbers.length ? content.numbers : null),
  render: (nums) => `<!-- section:numbers -->
### Selected numbers

${nums.map((n) => `\`${n.value}\` ${n.label}`).join("  ·  ")}`,
};
```

Create `generator/src/panels/md/connect.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { ContactLink } from "../../types.js";

export const connectPanel: MarkdownPanel<ContactLink[]> = {
  id: "connect",
  kind: "markdown",
  select: () => (content.contacts.length ? content.contacts : null),
  render: (links) => `<!-- section:connect -->
### Connect

${links.map((c) => `[${c.label}](${c.url})`).join(" • ")}`,
};
```

Create `generator/src/panels/md/coda.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";

export const codaPanel: MarkdownPanel<string> = {
  id: "coda",
  kind: "markdown",
  select: () => content.humanLine || null,
  render: (line) => `<!-- section:coda -->
<div align="center"><sub>${line}</sub></div>`,
};
```

- [ ] **Step 5: Register them**

Replace the `PANELS` export in `generator/src/panels/index.ts`:

```ts
import { currentlyPanel } from "./md/currently.js";
import { featuredPanel } from "./md/featured.js";
import { stackPanel } from "./md/stack.js";
import { numbersPanel } from "./md/numbers.js";
import { connectPanel } from "./md/connect.js";
import { codaPanel } from "./md/coda.js";

/** The registry. Order here is the order on the page. */
export const PANELS: Panel[] = [
  currentlyPanel,
  featuredPanel,
  stackPanel,
  numbersPanel,
  connectPanel,
  codaPanel,
];
```

Keep the `import type` line and both `active*` functions exactly as written in Task 1.

- [ ] **Step 6: Rewrite the markdown assembler**

Replace the whole of `generator/src/render/markdown.ts`:

```ts
import { content } from "../content.js";
import { activeMarkdownPanels } from "../panels/index.js";
import type { Snapshot } from "../panels/types.js";

/** Hero and stats are still hand-written here; Task 3 moves them into SVG panels. */
function hero(): string {
  return `<!-- section:hero -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/hero-light.svg">
  <img alt="ReaperOAK — ${content.fullName}" src="assets/hero-dark.svg" width="900">
</picture>
</div>`;
}

function stats(): string {
  return `<!-- section:stats -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/stats-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/stats-light.svg">
  <img alt="GitHub activity" src="assets/stats-dark.svg" width="900">
</picture>
</div>`;
}

export function renderReadme(ctx: Snapshot): string {
  const panels = activeMarkdownPanels(ctx);
  const byId = (id: string) => panels.find((p) => p.id === id)?.body;
  const ordered = [
    hero(),
    byId("currently"),
    byId("featured"),
    byId("engine-room"),
    byId("numbers"),
    stats(),
    byId("connect"),
    byId("coda"),
  ].filter((s): s is string => Boolean(s));
  return ordered.join("\n\n---\n\n") + "\n";
}
```

- [ ] **Step 7: Update the callers**

In `generator/src/assemble.ts`, change the import and the two uses. Replace the import line:

```ts
import { renderReadme } from "./render/markdown.js";
```

Replace the `SECTION_MARKERS` constant with a local list (it moves to derived markers in Task 13):

```ts
const SECTION_MARKERS = [
  "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
  "<!-- section:engine-room -->", "<!-- section:numbers -->", "<!-- section:stats -->",
  "<!-- section:connect -->", "<!-- section:coda -->",
];
export { SECTION_MARKERS };
```

Replace the `assemble` signature and body:

```ts
export function assemble(ctx: Snapshot): { readme: string; assets: Record<string, string> } {
  return {
    readme: renderReadme(ctx),
    assets: {
      "hero-dark.svg": renderHeroSvg("dark", ctx.fields.tagline),
      "hero-light.svg": renderHeroSvg("light", ctx.fields.tagline),
      "stats-dark.svg": renderStatsSvg("dark", ctx.github),
      "stats-light.svg": renderStatsSvg("light", ctx.github),
    },
  };
}
```

Add the import `import type { Snapshot } from "./panels/types.js";` at the top of `assemble.ts`.

- [ ] **Step 8: Update main.ts to build a Snapshot**

Replace the body of `main()` in `generator/src/main.ts`:

```ts
async function main(): Promise<void> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const root = resolve(here, "..", ".."); // repo root (generator/src → repo)
  const config = loadConfig();
  const github = await getGithubSnapshot(config);
  const fields = await getDynamicFields(config, github);
  const ctx: Snapshot = {
    github, fields,
    languages: null, featured: null, waka: null, leetcode: null,
    neetcode: null, uptime: null, feed: null,
    syncedAt: github.fetchedAt,
  };
  const built = assemble(ctx);
  writeOutputs(root, built);
  console.log("README generated:", Object.keys(built.assets).join(", "));
}
```

Add `import type { Snapshot } from "./panels/types.js";` to the imports.

- [ ] **Step 9: Fix the assemble test**

`generator/src/__tests__/assemble.test.ts` calls `assemble(fields, snap)`. Update every call to pass a single `Snapshot`. Import the fixture rather than rebuilding it:

```ts
import { FIXTURE } from "./fixtures.js";
```

and replace each `assemble(fields, snap)` with `assemble(FIXTURE)`.

- [ ] **Step 10: Run the full suite**

Run: `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 11: Verify the real README is byte-identical**

```bash
cp README.md /tmp/readme-before.md
cd generator && npm run build && cd ..
diff /tmp/readme-before.md README.md && echo "IDENTICAL"
```

Expected: `IDENTICAL`. If the diff is non-empty the refactor changed behaviour — fix before committing.

Note: this needs `GITHUB_TOKEN` set for identical LLM/GitHub values. Without it, both runs degrade to the same static fallbacks, so the diff is still meaningful.

- [ ] **Step 12: Commit**

```bash
git add generator/src/panels generator/src/render/markdown.ts generator/src/assemble.ts generator/src/main.ts generator/src/__tests__
git commit -m "refactor(generator): drive markdown sections from the panel registry"
```

---

## Task 3: SVG primitives and the composite canvas

**Files:**
- Create: `generator/src/render/svg/primitives.ts`
- Create: `generator/src/render/compose.ts`
- Create: `generator/src/panels/svg/identity.ts`
- Modify: `generator/src/panels/index.ts`
- Test: `generator/src/__tests__/primitives.test.ts`, `generator/src/__tests__/compose.test.ts`

**Interfaces:**
- Consumes: `Box`, `SvgPanel`, `Snapshot`, `activeSvgPanels` (Task 1); `THEME`, `Tokens`, `escapeXml`, `fontFaceStyle` from `src/render/svg-util.ts`.
- Produces:
  - `frame(box: Box, t: Tokens, label?: string): string`
  - `counter(x: number, y: number, value: string, label: string, t: Tokens): string`
  - `bar(box: Box, pct: number, t: Tokens, color?: string): string`
  - `heatGrid(box: Box, days: Array<{date: string; count: number}>, t: Tokens): string`
  - `gauge(box: Box, value: number, target: number, t: Tokens): string`
  - `statusDot(x: number, y: number, ok: boolean, t: Tokens): string`
  - `composeCanvas(name: string, ctx: Snapshot, theme: "dark" | "light", panelIds: string[]): string | null`

`composeCanvas` returns `null` when every panel it was asked for is inactive — that canvas file is then not written and the markdown panel referencing it omits itself. This is the null-omission rule reaching all the way to the filesystem.

- [ ] **Step 1: Write the failing primitives test**

Create `generator/src/__tests__/primitives.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { frame, counter, bar, heatGrid, gauge, statusDot } from "../render/svg/primitives.js";
import { THEME } from "../render/svg-util.js";

const t = THEME.dark;
const box = { x: 0, y: 0, w: 200, h: 100 };

describe("primitives", () => {
  it("frame draws a rounded rect using only theme tokens", () => {
    const out = frame(box, t, "SIGNAL");
    expect(out).toContain("<rect");
    expect(out).toContain(t.panel);
    expect(out).toContain("SIGNAL");
    expect(out).not.toMatch(/#(?!0E0E11|8F887B|E8A33D|ECE7DE|0B0B0D|C77B30)[0-9A-Fa-f]{6}/);
  });

  it("counter escapes its label", () => {
    expect(counter(10, 20, "5", "a & b", t)).toContain("a &amp; b");
  });

  it("bar clamps a percentage above 100", () => {
    const out = bar(box, 250, t);
    const width = Number(/width="([\d.]+)"[^>]*class="bar-fill"/.exec(out)?.[1] ?? -1);
    expect(width).toBeLessThanOrEqual(box.w);
  });

  it("bar clamps a negative percentage to zero", () => {
    const out = bar(box, -20, t);
    const width = Number(/width="([\d.]+)"[^>]*class="bar-fill"/.exec(out)?.[1] ?? -1);
    expect(width).toBe(0);
  });

  it("heatGrid emits one cell per day", () => {
    const days = Array.from({ length: 14 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, count: i }));
    const out = heatGrid(box, days, t);
    expect((out.match(/<rect/g) ?? []).length).toBe(14);
  });

  it("heatGrid gives a zero-count day the panel colour, not the accent", () => {
    const out = heatGrid(box, [{ date: "2026-08-01", count: 0 }], t);
    expect(out).toContain(t.panel);
    expect(out).not.toContain(t.accent);
  });

  it("gauge reports the fraction as a clamped ratio", () => {
    expect(gauge(box, 51, 150, t)).toContain("51");
    expect(gauge(box, 200, 150, t)).toContain("150");
  });

  it("statusDot distinguishes ok from down", () => {
    expect(statusDot(0, 0, true, t)).not.toBe(statusDot(0, 0, false, t));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/primitives.test.ts`
Expected: FAIL — `Failed to resolve import "../render/svg/primitives.js"`

- [ ] **Step 3: Write the primitives**

Create `generator/src/render/svg/primitives.ts`:

```ts
import type { Tokens } from "../svg-util.js";
import { escapeXml } from "../svg-util.js";
import type { Box } from "../../panels/types.js";

/** A titled panel frame. The label is optional; omit it for a bare container. */
export function frame(box: Box, t: Tokens, label?: string): string {
  const title = label
    ? `<text x="${box.x + 16}" y="${box.y + 24}" font-family="ui-monospace,monospace" font-size="11" letter-spacing="2" fill="${t.mut}">${escapeXml(label.toUpperCase())}</text>`
    : "";
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="14" fill="${t.panel}" stroke="${t.line}"/>${title}`;
}

/** A big number over a small caption, centred on x. */
export function counter(x: number, y: number, value: string, label: string, t: Tokens): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="34" fill="${t.accent}">${escapeXml(value)}</text>
<text x="${x}" y="${y + 22}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" letter-spacing="1" fill="${t.mut}">${escapeXml(label)}</text>`;
}

/** A horizontal progress bar. pct is clamped to 0..100. */
export function bar(box: Box, pct: number, t: Tokens, color?: string): string {
  const safe = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const w = (box.w * safe) / 100;
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.h / 2}" fill="${t.line}"/>
<rect x="${box.x}" y="${box.y}" width="${w}" height="${box.h}" rx="${box.h / 2}" fill="${color ?? t.accent}" class="bar-fill"/>`;
}

/** Five-step amber ramp from panel background to full accent. */
function heatColor(count: number, max: number, t: Tokens): string {
  if (count <= 0) return t.panel;
  const step = Math.min(4, Math.ceil((count / Math.max(1, max)) * 4));
  const opacity = [0, 0.25, 0.45, 0.7, 1][step];
  return `${t.accent}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
}

/** GitHub-style contribution grid, laid out in columns of seven. */
export function heatGrid(box: Box, days: Array<{ date: string; count: number }>, t: Tokens): string {
  if (days.length === 0) return "";
  const cols = Math.ceil(days.length / 7);
  const cell = Math.min(11, Math.floor((box.w - cols * 2) / Math.max(1, cols)));
  const gap = 2;
  const max = Math.max(...days.map((d) => d.count));
  return days.map((d, i) => {
    const x = box.x + Math.floor(i / 7) * (cell + gap);
    const y = box.y + (i % 7) * (cell + gap);
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${heatColor(d.count, max, t)}"><title>${escapeXml(d.date)}: ${d.count}</title></rect>`;
  }).join("");
}

/** A labelled progress readout: "51 / 150" over a bar. value is clamped to target. */
export function gauge(box: Box, value: number, target: number, t: Tokens): string {
  const safeTarget = target > 0 ? target : 1;
  const safeValue = Math.min(safeTarget, Math.max(0, value));
  const pct = (safeValue / safeTarget) * 100;
  return `<text x="${box.x}" y="${box.y + 14}" font-family="OakDisplay,sans-serif" font-weight="800" font-size="20" fill="${t.ink}">${safeValue}<tspan fill="${t.mut}" font-size="13"> / ${safeTarget}</tspan></text>
${bar({ x: box.x, y: box.y + 26, w: box.w, h: 8 }, pct, t)}`;
}

/** Filled dot for up, hollow ring for down. */
export function statusDot(x: number, y: number, ok: boolean, t: Tokens): string {
  return ok
    ? `<circle cx="${x}" cy="${y}" r="4" fill="${t.accent}"/>`
    : `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${t.mut}" stroke-width="1.5"/>`;
}
```

- [ ] **Step 4: Run the primitives test**

Run: `npx vitest run src/__tests__/primitives.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing composer test**

Create `generator/src/__tests__/compose.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { composeCanvas } from "../render/compose.js";
import type { Panel, Snapshot } from "../panels/types.js";
import { FIXTURE } from "./fixtures.js";

const live: Panel = {
  id: "live", kind: "svg", size: { w: 400, h: 100 },
  select: () => ({ n: 1 }), render: () => `<text>LIVE</text>`,
};
const dark: Panel = {
  id: "dark", kind: "svg", size: { w: 400, h: 100 },
  select: () => null, render: () => `<text>NEVER</text>`,
};

describe("composeCanvas", () => {
  it("returns null when every requested panel is inactive", () => {
    expect(composeCanvas("arena", FIXTURE, "dark", ["dark"], [dark])).toBeNull();
  });

  it("emits a single svg root containing the active panel", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["live"], [live, dark])!;
    expect(out.startsWith("<svg")).toBe(true);
    expect((out.match(/<svg/g) ?? []).length).toBe(1);
    expect(out).toContain("LIVE");
    expect(out).not.toContain("NEVER");
  });

  it("gives the sole active panel the full canvas width", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["live", "dark"], [live, dark])!;
    expect(out).toContain('width="900"');
  });

  it("renders light and dark differently", () => {
    const d = composeCanvas("arena", FIXTURE, "dark", ["live"], [live])!;
    const l = composeCanvas("arena", FIXTURE, "light", ["live"], [live])!;
    expect(d).not.toBe(l);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/__tests__/compose.test.ts`
Expected: FAIL — `Failed to resolve import "../render/compose.js"`

- [ ] **Step 7: Write the composer**

Create `generator/src/render/compose.ts`:

```ts
import { THEME, fontFaceStyle } from "./svg-util.js";
import { activeSvgPanels, PANELS } from "../panels/index.js";
import type { Box, Panel, Snapshot } from "../panels/types.js";

const CANVAS_W = 900;
const PAD = 16;

/**
 * Packs the named panels into one dual-theme canvas.
 * Active panels share the row width equally, so a canvas whose neighbour dropped out
 * widens the survivor rather than leaving a hole.
 * Returns null when nothing is active — the caller then writes no file.
 */
export function composeCanvas(
  name: string,
  ctx: Snapshot,
  theme: "dark" | "light",
  panelIds: string[],
  registry: Panel[] = PANELS,
): string | null {
  const wanted = new Set(panelIds);
  const active = activeSvgPanels(ctx, registry).filter((p) => wanted.has(p.id));
  if (active.length === 0) return null;

  const t = THEME[theme];
  const height = Math.max(...active.map((p) => p.panel.size.h)) + PAD * 2;
  const each = (CANVAS_W - PAD * 2 - PAD * (active.length - 1)) / active.length;

  const body = active.map((p, i) => {
    const box: Box = { x: PAD + i * (each + PAD), y: PAD, w: each, h: height - PAD * 2 };
    return p.panel.render(p.data, t, box);
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${height}" viewBox="0 0 ${CANVAS_W} ${height}" role="img" aria-label="${name}">
${fontFaceStyle()}
<rect width="${CANVAS_W}" height="${height}" fill="${t.bg}"/>
${body}
</svg>`;
}
```

- [ ] **Step 8: Run the composer test**

Run: `npx vitest run src/__tests__/compose.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, typecheck silent.

- [ ] **Step 10: Commit**

```bash
git add generator/src/render/svg generator/src/render/compose.ts generator/src/__tests__/primitives.test.ts generator/src/__tests__/compose.test.ts
git commit -m "feat(generator): add svg primitives and composite canvas renderer"
```

---

## Task 4: Expanded GitHub snapshot

**Files:**
- Modify: `generator/src/data/github.ts`
- Test: `generator/src/__tests__/github.test.ts`

**Interfaces:**
- Consumes: `RepoNode`, `GithubSnapshot` from `src/types.ts` (Task 1).
- Produces: `getGithubSnapshot(config, fetchImpl?)` returning the fully populated `GithubSnapshot`, plus the existing exported `computeStreak`.

The existing three `getGithubSnapshot` tests must keep passing unchanged — that is the regression guard.

- [ ] **Step 1: Add the failing tests**

Append to `generator/src/__tests__/github.test.ts`, inside the existing `describe("getGithubSnapshot", ...)` block:

```ts
  it("flattens the calendar and populates contribution counters", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 900,
          totalPullRequestContributions: 60,
          totalPullRequestReviewContributions: 30,
          totalIssueContributions: 12,
          contributionCalendar: { totalContributions: 1002, weeks: [
            { contributionDays: [{ contributionCount: 1, date: "2026-07-20" }, { contributionCount: 4, date: "2026-07-21" }] },
          ] },
        },
        repositories: { nodes: [] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.commits).toBe(900);
    expect(snap.prs).toBe(60);
    expect(snap.reviews).toBe(30);
    expect(snap.issues).toBe(12);
    expect(snap.calendar).toEqual([
      { date: "2026-07-20", count: 1 }, { date: "2026-07-21", count: 4 },
    ]);
  });

  it("maps repository nodes including languages and commit counts", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 0, totalPullRequestContributions: 0,
          totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
          contributionCalendar: { totalContributions: 0, weeks: [] },
        },
        repositories: { nodes: [{
          name: "todayeggrates", url: "https://github.com/ReaperOAK/todayeggrates",
          description: "egg rates", homepageUrl: "https://todayeggrates.com/",
          stargazerCount: 0, forkCount: 1, pushedAt: "2026-09-06T04:00:05Z",
          isFork: false, isArchived: false,
          languages: { edges: [{ size: 802240, node: { name: "JavaScript", color: "#f1e05a" } }] },
          defaultBranchRef: { target: { history: { totalCount: 412, nodes: [{ message: "fix: rate parser" }] } } },
        }] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.repos).toHaveLength(1);
    expect(snap.repos[0]!.commitsLastYear).toBe(412);
    expect(snap.repos[0]!.homepageUrl).toBe("https://todayeggrates.com/");
    expect(snap.repos[0]!.languages[0]).toEqual({ name: "JavaScript", color: "#f1e05a", size: 802240 });
    expect(snap.recentCommitMessages).toContain("fix: rate parser");
  });

  it("stamps fetchedAt on a live fetch", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 0, totalPullRequestContributions: 0,
          totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
          contributionCalendar: { totalContributions: 0, weeks: [] },
        },
        repositories: { nodes: [] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(Date.parse(snap.fetchedAt)).toBeGreaterThan(Date.parse("2026-01-01"));
  });

  it("survives a repo whose defaultBranchRef is null", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: { user: {
        contributionsCollection: {
          totalCommitContributions: 0, totalPullRequestContributions: 0,
          totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
          contributionCalendar: { totalContributions: 0, weeks: [] },
        },
        repositories: { nodes: [{
          name: "empty", url: "u", description: null, homepageUrl: null,
          stargazerCount: 0, forkCount: 0, pushedAt: "2026-01-01T00:00:00Z",
          isFork: false, isArchived: false, languages: { edges: [] }, defaultBranchRef: null,
        }] },
      } },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.repos[0]!.commitsLastYear).toBe(0);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/__tests__/github.test.ts`
Expected: FAIL — four failures; `snap.commits` is `0`, `snap.repos` is `[]`.

- [ ] **Step 3: Replace the query**

In `generator/src/data/github.ts`, replace the `QUERY` constant:

```ts
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
```

- [ ] **Step 4: Replace the parsing**

In `generator/src/data/github.ts`, replace the body between `const u = json?.data?.user;` and `return snap;`:

```ts
    if (!u) throw new Error("no user in response");
    const cc = u.contributionsCollection;
    const cal = cc.contributionCalendar;

    const repoNodes: any[] = u.repositories?.nodes ?? [];
    const repos: RepoNode[] = repoNodes.filter(Boolean).map((r: any) => ({
      name: String(r.name),
      url: String(r.url),
      description: r.description ?? null,
      homepageUrl: r.homepageUrl || null,
      stars: Number(r.stargazerCount ?? 0),
      forks: Number(r.forkCount ?? 0),
      pushedAt: String(r.pushedAt ?? new Date(0).toISOString()),
      isFork: Boolean(r.isFork),
      isArchived: Boolean(r.isArchived),
      commitsLastYear: Number(r.defaultBranchRef?.target?.history?.totalCount ?? 0),
      languages: (r.languages?.edges ?? []).map((e: any) => ({
        name: String(e.node.name), color: e.node.color ?? null, size: Number(e.size ?? 0),
      })),
    }));

    const messages: string[] = repoNodes
      .flatMap((n: any) => n?.defaultBranchRef?.target?.history?.nodes ?? [])
      .map((c: any) => String(c.message).split("\n")[0])
      .filter(Boolean)
      .slice(0, 12);

    const calendar = (cal.weeks ?? [])
      .flatMap((w: any) => w.contributionDays ?? [])
      .map((d: any) => ({ date: String(d.date), count: Number(d.contributionCount ?? 0) }));

    const snap: GithubSnapshot = {
      recentCommitMessages: messages,
      totalContributions: cal.totalContributions ?? 0,
      currentStreakDays: computeStreak(cal.weeks ?? []),
      commits: Number(cc.totalCommitContributions ?? 0),
      prs: Number(cc.totalPullRequestContributions ?? 0),
      reviews: Number(cc.totalPullRequestReviewContributions ?? 0),
      issues: Number(cc.totalIssueContributions ?? 0),
      calendar,
      repos,
      fetchedAt: new Date().toISOString(),
    };
    writeCache(CACHE_KEY, snap);
```

- [ ] **Step 5: Pass the `since` variable**

In the same file, replace the `body:` line of the fetch call:

```ts
      body: JSON.stringify({
        query: QUERY,
        variables: {
          login: config.githubLogin,
          since: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
        },
      }),
```

- [ ] **Step 6: Add the type import**

At the top of `generator/src/data/github.ts`, extend the type import:

```ts
import type { GithubSnapshot, RepoNode } from "../types.js";
```

- [ ] **Step 7: Run the GitHub tests**

Run: `npx vitest run src/__tests__/github.test.ts`
Expected: PASS — the four new tests plus the seven pre-existing ones.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add generator/src/data/github.ts generator/src/__tests__/github.test.ts
git commit -m "feat(generator): fetch repos, languages and contribution counters"
```

---

## Task 5: Language mix normalisation

Raw byte totals let one large repo decide the chart — `todayeggrates` alone carries 802K bytes of JavaScript. That measures repo size, not what its author works in. This computes each repo's own language shares, then sums them weighted by recency decay.

**Files:**
- Create: `generator/src/data/languages.ts`
- Test: `generator/src/__tests__/languages.test.ts`

**Interfaces:**
- Consumes: `RepoNode`, `LanguageShare` from `src/types.ts`.
- Produces: `computeLanguageShares(repos: RepoNode[], todayISO: string, top?: number): LanguageShare[]` — percentages summing to ~100, descending.

- [ ] **Step 1: Write the failing test**

Create `generator/src/__tests__/languages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeLanguageShares } from "../data/languages.js";
import type { RepoNode } from "../types.js";

const repo = (over: Partial<RepoNode>): RepoNode => ({
  name: "r", url: "u", description: null, homepageUrl: null, stars: 0, forks: 0,
  pushedAt: "2026-09-06T00:00:00Z", isFork: false, isArchived: false,
  commitsLastYear: 10, languages: [], ...over,
});

const TODAY = "2026-09-06T00:00:00Z";

describe("computeLanguageShares", () => {
  it("returns an empty list when no repo has languages", () => {
    expect(computeLanguageShares([repo({})], TODAY)).toEqual([]);
  });

  it("does not let a 10x larger repo dominate the chart", () => {
    const shares = computeLanguageShares([
      repo({ name: "huge", languages: [{ name: "JavaScript", color: "#f1e05a", size: 800000 }] }),
      repo({ name: "small", languages: [{ name: "TypeScript", color: "#3178c6", size: 80000 }] }),
    ], TODAY);
    const js = shares.find((s) => s.name === "JavaScript")!.pct;
    const ts = shares.find((s) => s.name === "TypeScript")!.pct;
    expect(Math.abs(js - ts)).toBeLessThan(1);
  });

  it("weights a recently pushed repo above a stale one", () => {
    const shares = computeLanguageShares([
      repo({ name: "fresh", pushedAt: "2026-09-06T00:00:00Z",
        languages: [{ name: "Go", color: "#00ADD8", size: 1000 }] }),
      repo({ name: "stale", pushedAt: "2024-09-06T00:00:00Z",
        languages: [{ name: "PHP", color: "#4F5D95", size: 1000 }] }),
    ], TODAY);
    expect(shares[0]!.name).toBe("Go");
    expect(shares.find((s) => s.name === "Go")!.pct)
      .toBeGreaterThan(shares.find((s) => s.name === "PHP")!.pct);
  });

  it("excludes forks and archived repos", () => {
    const shares = computeLanguageShares([
      repo({ isFork: true, languages: [{ name: "Ruby", color: "#701516", size: 5000 }] }),
      repo({ isArchived: true, languages: [{ name: "Perl", color: "#0298c3", size: 5000 }] }),
      repo({ languages: [{ name: "Python", color: "#3572A5", size: 5000 }] }),
    ], TODAY);
    expect(shares.map((s) => s.name)).toEqual(["Python"]);
  });

  it("normalises percentages to sum to 100", () => {
    const shares = computeLanguageShares([
      repo({ languages: [
        { name: "TypeScript", color: "#3178c6", size: 600 },
        { name: "CSS", color: "#563d7c", size: 400 },
      ] }),
    ], TODAY);
    expect(Math.round(shares.reduce((a, s) => a + s.pct, 0))).toBe(100);
  });

  it("keeps only the top N languages", () => {
    const langs = ["A", "B", "C", "D", "E", "F", "G", "H"].map((n, i) => ({
      name: n, color: "#111111", size: 1000 - i * 10,
    }));
    expect(computeLanguageShares([repo({ languages: langs })], TODAY, 6)).toHaveLength(6);
  });

  it("substitutes a theme-neutral colour when GitHub reports none", () => {
    const shares = computeLanguageShares([
      repo({ languages: [{ name: "Move", color: null, size: 100 }] }),
    ], TODAY);
    expect(shares[0]!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/languages.test.ts`
Expected: FAIL — `Failed to resolve import "../data/languages.js"`

- [ ] **Step 3: Write the implementation**

Create `generator/src/data/languages.ts`:

```ts
import type { LanguageShare, RepoNode } from "../types.js";

const HALF_LIFE_DAYS = 180;
const FALLBACK_COLOR = "#8F887B";  // Tokens.mut — readable in both themes

/**
 * Per-repo normalised language shares, summed with recency decay.
 *
 * Each repo contributes its own language *distribution* (summing to 1), scaled by
 * exp(-days_since_push / 180). A repo with ten times the bytes therefore does not
 * get ten times the vote — it gets one vote, weighted by how recently it was touched.
 */
export function computeLanguageShares(
  repos: RepoNode[],
  todayISO: string,
  top = 6,
): LanguageShare[] {
  const now = Date.parse(todayISO);
  const weights = new Map<string, number>();
  const colors = new Map<string, string>();

  for (const r of repos) {
    if (r.isFork || r.isArchived) continue;
    const total = r.languages.reduce((a, l) => a + l.size, 0);
    if (total <= 0) continue;

    const days = Math.max(0, (now - Date.parse(r.pushedAt)) / 86_400_000);
    const recency = Math.exp(-days / HALF_LIFE_DAYS);

    for (const l of r.languages) {
      weights.set(l.name, (weights.get(l.name) ?? 0) + (l.size / total) * recency);
      if (!colors.has(l.name)) colors.set(l.name, l.color ?? FALLBACK_COLOR);
    }
  }

  const sum = [...weights.values()].reduce((a, w) => a + w, 0);
  if (sum <= 0) return [];

  return [...weights.entries()]
    .map(([name, w]) => ({ name, color: colors.get(name) ?? FALLBACK_COLOR, pct: (w / sum) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, top);
}
```

Note the `top` slice happens after normalisation, so the visible percentages may sum to slightly under 100 when languages are dropped. The "sums to 100" test uses two languages, so nothing is dropped there.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/__tests__/languages.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add generator/src/data/languages.ts generator/src/__tests__/languages.test.ts
git commit -m "feat(generator): compute language mix with per-repo normalisation"
```

---

## Task 6: Featured ranking

Every repo on this account has 0–1 stars, so star-weighted ranking is dead on arrival. Recency and sustained commit volume carry the score; pins guarantee GenAI Media Platform and Creator Marketplace stay on the page even though they are not GitHub repos.

**Files:**
- Create: `generator/src/data/ranking.ts`
- Modify: `generator/src/content.ts`, `generator/src/types.ts`
- Test: `generator/src/__tests__/ranking.test.ts`

**Interfaces:**
- Consumes: `RepoNode`, `RankedRepo` from `src/types.ts`.
- Produces: `scoreRepo(r: RepoNode, ctx: ScoreContext): number` and `rankRepos(repos: RepoNode[], opts: RankOptions): RankedRepo[]`, where:

```ts
export interface ScoreContext { todayISO: string; maxCommits: number; maxReach: number; }
export interface RankOptions { todayISO: string; pins: string[]; blocks: string[]; limit?: number; }
```

- [ ] **Step 1: Write the failing test**

Create `generator/src/__tests__/ranking.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankRepos, scoreRepo } from "../data/ranking.js";
import type { RepoNode } from "../types.js";

const repo = (over: Partial<RepoNode>): RepoNode => ({
  name: "r", url: "https://github.com/ReaperOAK/r", description: "does a thing",
  homepageUrl: null, stars: 0, forks: 0, pushedAt: "2026-09-06T00:00:00Z",
  isFork: false, isArchived: false, commitsLastYear: 10,
  languages: [{ name: "TypeScript", color: "#3178c6", size: 1000 }], ...over,
});

const TODAY = "2026-09-06T00:00:00Z";
const ctx = { todayISO: TODAY, maxCommits: 400, maxReach: 5 };

describe("scoreRepo", () => {
  it("scores a fork at zero", () => {
    expect(scoreRepo(repo({ isFork: true }), ctx)).toBe(0);
  });

  it("scores an archived repo at zero", () => {
    expect(scoreRepo(repo({ isArchived: true }), ctx)).toBe(0);
  });

  it("ranks a recently pushed repo above an identical stale one", () => {
    const fresh = scoreRepo(repo({ pushedAt: "2026-09-05T00:00:00Z" }), ctx);
    const stale = scoreRepo(repo({ pushedAt: "2025-09-05T00:00:00Z" }), ctx);
    expect(fresh).toBeGreaterThan(stale);
  });

  it("rewards a homepage and a description over a bare repo", () => {
    const full = scoreRepo(repo({ homepageUrl: "https://x.com", description: "d" }), ctx);
    const bare = scoreRepo(repo({ homepageUrl: null, description: null }), ctx);
    expect(full).toBeGreaterThan(bare);
  });

  it("lets recency outweigh stars", () => {
    const freshNoStars = scoreRepo(repo({ pushedAt: "2026-09-06T00:00:00Z", stars: 0 }), ctx);
    const staleStarred = scoreRepo(repo({ pushedAt: "2024-09-06T00:00:00Z", stars: 5 }), ctx);
    expect(freshNoStars).toBeGreaterThan(staleStarred);
  });
});

describe("rankRepos", () => {
  it("drops forks and archived repos entirely", () => {
    const out = rankRepos([
      repo({ name: "fork", isFork: true }),
      repo({ name: "arch", isArchived: true }),
      repo({ name: "real" }),
    ], { todayISO: TODAY, pins: [], blocks: [] });
    expect(out.map((r) => r.name)).toEqual(["real"]);
  });

  it("puts pinned repos first regardless of score", () => {
    const out = rankRepos([
      repo({ name: "hot", pushedAt: "2026-09-06T00:00:00Z", commitsLastYear: 400 }),
      repo({ name: "cold", pushedAt: "2024-01-01T00:00:00Z", commitsLastYear: 1 }),
    ], { todayISO: TODAY, pins: ["cold"], blocks: [] });
    expect(out[0]!.name).toBe("cold");
  });

  it("removes blocked repos", () => {
    const out = rankRepos([repo({ name: "keep" }), repo({ name: "drop" })],
      { todayISO: TODAY, pins: [], blocks: ["drop"] });
    expect(out.map((r) => r.name)).toEqual(["keep"]);
  });

  it("honours the limit", () => {
    const repos = ["a", "b", "c", "d"].map((name) => repo({ name }));
    expect(rankRepos(repos, { todayISO: TODAY, pins: [], blocks: [], limit: 2 })).toHaveLength(2);
  });

  it("uses an empty description when the repo has none", () => {
    const out = rankRepos([repo({ name: "bare", description: null })],
      { todayISO: TODAY, pins: [], blocks: [] });
    expect(out[0]!.description).toBe("");
  });

  it("builds the stack string from the top languages", () => {
    const out = rankRepos([repo({ languages: [
      { name: "TypeScript", color: "#3178c6", size: 900 },
      { name: "Shell", color: "#89e051", size: 100 },
    ] })], { todayISO: TODAY, pins: [], blocks: [] });
    expect(out[0]!.stack).toBe("TypeScript · Shell");
  });

  it("returns an empty list for no input rather than throwing", () => {
    expect(rankRepos([], { todayISO: TODAY, pins: [], blocks: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/ranking.test.ts`
Expected: FAIL — `Failed to resolve import "../data/ranking.js"`

- [ ] **Step 3: Write the implementation**

Create `generator/src/data/ranking.ts`:

```ts
import type { RankedRepo, RepoNode } from "../types.js";

export interface ScoreContext { todayISO: string; maxCommits: number; maxReach: number; }
export interface RankOptions { todayISO: string; pins: string[]; blocks: string[]; limit?: number; }

const RECENCY_HALF_LIFE_DAYS = 90;

/** log1p scaled to 0..1 against the largest value in the candidate set. */
function norm(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.log1p(Math.max(0, value)) / Math.log1p(max);
}

/**
 * 0.40 recency + 0.25 sustained commits + 0.20 completeness + 0.15 reach.
 * Forks and archived repos score 0 and are dropped by rankRepos.
 */
export function scoreRepo(r: RepoNode, ctx: ScoreContext): number {
  if (r.isFork || r.isArchived) return 0;

  const days = Math.max(0, (Date.parse(ctx.todayISO) - Date.parse(r.pushedAt)) / 86_400_000);
  const recency = Math.exp(-days / RECENCY_HALF_LIFE_DAYS);
  const volume = norm(r.commitsLastYear, ctx.maxCommits);
  const completeness =
    ((r.description ? 1 : 0) + (r.homepageUrl ? 1 : 0) + (r.languages.length > 0 ? 1 : 0)) / 3;
  const reach = norm(r.stars + r.forks, ctx.maxReach);

  return 0.40 * recency + 0.25 * volume + 0.20 * completeness + 0.15 * reach;
}

export function rankRepos(repos: RepoNode[], opts: RankOptions): RankedRepo[] {
  const blocked = new Set(opts.blocks);
  const pinned = new Set(opts.pins);
  const candidates = repos.filter((r) => !r.isFork && !r.isArchived && !blocked.has(r.name));
  if (candidates.length === 0) return [];

  const ctx: ScoreContext = {
    todayISO: opts.todayISO,
    maxCommits: Math.max(1, ...candidates.map((r) => r.commitsLastYear)),
    maxReach: Math.max(1, ...candidates.map((r) => r.stars + r.forks)),
  };

  const ranked = candidates
    .map((r) => ({
      name: r.name,
      url: r.url,
      description: r.description ?? "",
      stack: r.languages.slice(0, 3).map((l) => l.name).join(" · "),
      score: scoreRepo(r, ctx),
      pinned: pinned.has(r.name),
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.score - a.score;
    })
    .map(({ pinned: _pinned, ...rest }) => rest);

  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/__tests__/ranking.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Add pins and blocks to content**

In `generator/src/content.ts`, add two fields to the `content` object immediately after the `featured` array:

```ts
  /** Repos forced to the top of Featured regardless of score. */
  featuredPins: [],
  /** Repos never shown. */
  featuredBlocks: ["ai-trader-lab", "App", "neetcode-submissions", "ReaperOAK"],
```

Add the matching fields to `StaticContent` in `generator/src/types.ts`, after `featured`:

```ts
  featuredPins: string[];
  featuredBlocks: string[];
```

Rationale for each block: `ai-trader-lab` is byte-identical to `survivorship-free-backtester` (spec open item); `App` is an upstream Expensify fork; `neetcode-submissions` feeds the roadmap gauge instead of Featured; `ReaperOAK` is this profile repo itself.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add generator/src/data/ranking.ts generator/src/content.ts generator/src/types.ts generator/src/__tests__/ranking.test.ts
git commit -m "feat(generator): rank featured repos by recency and sustained commits"
```

---

## Task 7: Telemetry canvas — heatmap and signal counters

Replaces the two-number stats SVG with a contribution heatmap and five counters.

**Files:**
- Create: `generator/src/panels/svg/heatmap.ts`, `generator/src/panels/svg/signal.ts`, `generator/src/panels/md/telemetry.ts`
- Delete: `generator/src/render/svg-stats.ts`, `generator/src/__tests__/svg-stats.test.ts`, `assets/stats-dark.svg`, `assets/stats-light.svg`
- Modify: `generator/src/panels/index.ts`, `generator/src/assemble.ts`, `generator/src/render/markdown.ts`, `generator/src/__tests__/markdown-golden.test.ts`
- Test: `generator/src/__tests__/telemetry.test.ts`

**Interfaces:**
- Consumes: `frame`, `counter`, `heatGrid`, `composeCanvas` (Task 3); `Snapshot` (Task 1).
- Produces: `heatmapPanel`, `signalPanel` (both `SvgPanel`), `telemetryPanel` (`MarkdownPanel` emitting `<!-- section:telemetry -->` and a `<picture>` block).

- [ ] **Step 1: Write the failing test**

Create `generator/src/__tests__/telemetry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { heatmapPanel } from "../panels/svg/heatmap.js";
import { signalPanel } from "../panels/svg/signal.js";
import { telemetryPanel } from "../panels/md/telemetry.js";
import { THEME } from "../render/svg-util.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const box = { x: 0, y: 0, w: 860, h: 240 };
const t = THEME.dark;

const withCalendar = (days: Array<{ date: string; count: number }>): Snapshot =>
  ({ ...FIXTURE, github: { ...FIXTURE.github, calendar: days } });

describe("heatmapPanel", () => {
  it("omits itself when the calendar is empty", () => {
    expect(heatmapPanel.select(withCalendar([]))).toBeNull();
  });

  it("renders one cell per calendar day", () => {
    const ctx = withCalendar([
      { date: "2026-09-01", count: 3 }, { date: "2026-09-02", count: 0 },
    ]);
    const out = heatmapPanel.render(heatmapPanel.select(ctx)!, t, box);
    expect((out.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("signalPanel", () => {
  it("omits itself when every counter is zero", () => {
    const ctx: Snapshot = { ...FIXTURE, github: {
      ...FIXTURE.github, commits: 0, prs: 0, reviews: 0, issues: 0, currentStreakDays: 0 } };
    expect(signalPanel.select(ctx)).toBeNull();
  });

  it("renders all five counters when data exists", () => {
    const out = signalPanel.render(signalPanel.select(FIXTURE)!, t, box);
    for (const label of ["commits", "PRs", "reviews", "issues", "streak"]) {
      expect(out).toContain(label);
    }
  });

  it("formats large numbers with separators", () => {
    const ctx: Snapshot = { ...FIXTURE, github: { ...FIXTURE.github, commits: 1284 } };
    expect(signalPanel.render(signalPanel.select(ctx)!, t, box)).toContain("1,284");
  });
});

describe("telemetryPanel", () => {
  it("omits itself when neither svg panel has data", () => {
    const ctx: Snapshot = { ...FIXTURE, github: { ...FIXTURE.github,
      calendar: [], commits: 0, prs: 0, reviews: 0, issues: 0, currentStreakDays: 0 } };
    expect(telemetryPanel.select(ctx)).toBeNull();
  });

  it("emits a dual-theme picture block referencing both assets", () => {
    const out = telemetryPanel.render(telemetryPanel.select(FIXTURE)!, FIXTURE);
    expect(out).toContain("<!-- section:telemetry -->");
    expect(out).toContain("assets/telemetry-dark.svg");
    expect(out).toContain("assets/telemetry-light.svg");
    expect(out).toContain("prefers-color-scheme: dark");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/telemetry.test.ts`
Expected: FAIL — three unresolved imports.

- [ ] **Step 3: Write the heatmap panel**

Create `generator/src/panels/svg/heatmap.ts`:

```ts
import type { SvgPanel } from "../types.js";
import { frame, heatGrid } from "../../render/svg/primitives.js";

type Day = { date: string; count: number };

export const heatmapPanel: SvgPanel<Day[]> = {
  id: "heatmap",
  kind: "svg",
  size: { w: 860, h: 130 },
  select: (ctx) => (ctx.github.calendar.length ? ctx.github.calendar : null),
  render: (days, t, box) => `${frame(box, t, "contributions · last 12 months")}
${heatGrid({ x: box.x + 16, y: box.y + 38, w: box.w - 32, h: box.h - 54 }, days, t)}`,
};
```

- [ ] **Step 4: Write the signal panel**

Create `generator/src/panels/svg/signal.ts`:

```ts
import type { SvgPanel } from "../types.js";
import { counter, frame } from "../../render/svg/primitives.js";

interface Signal { commits: number; prs: number; reviews: number; issues: number; streak: number; }

export const signalPanel: SvgPanel<Signal> = {
  id: "signal",
  kind: "svg",
  size: { w: 860, h: 110 },
  select: (ctx) => {
    const s: Signal = {
      commits: ctx.github.commits, prs: ctx.github.prs, reviews: ctx.github.reviews,
      issues: ctx.github.issues, streak: ctx.github.currentStreakDays,
    };
    const any = s.commits || s.prs || s.reviews || s.issues || s.streak;
    return any ? s : null;
  },
  render: (s, t, box) => {
    const cells: Array<[number, string]> = [
      [s.commits, "commits"], [s.prs, "PRs"], [s.reviews, "reviews"],
      [s.issues, "issues"], [s.streak, "streak"],
    ];
    const step = box.w / cells.length;
    const body = cells.map(([v, label], i) =>
      counter(box.x + step * (i + 0.5), box.y + 62, v.toLocaleString("en-US"), label, t),
    ).join("\n");
    return `${frame(box, t, "signal")}\n${body}`;
  },
};
```

- [ ] **Step 5: Write the telemetry markdown panel**

Create `generator/src/panels/md/telemetry.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { heatmapPanel } from "../svg/heatmap.js";
import { signalPanel } from "../svg/signal.js";

/**
 * Emits the <picture> block for the telemetry canvas. Omits itself when neither
 * of that canvas's svg panels has data, so the README never points at a file
 * assemble() did not write.
 */
export const telemetryPanel: MarkdownPanel<true> = {
  id: "telemetry",
  kind: "markdown",
  select: (ctx) =>
    heatmapPanel.select(ctx) !== null || signalPanel.select(ctx) !== null ? true : null,
  render: () => `<!-- section:telemetry -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/telemetry-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/telemetry-light.svg">
  <img alt="GitHub telemetry — contributions, pull requests, reviews, issues, streak" src="assets/telemetry-dark.svg" width="900">
</picture>
</div>`,
};
```

- [ ] **Step 6: Register the panels**

In `generator/src/panels/index.ts`, add three imports and rewrite `PANELS`. SVG panels sit at the end — order inside `PANELS` only decides markdown sequence, since the composer selects SVG panels by id:

```ts
import { telemetryPanel } from "./md/telemetry.js";
import { heatmapPanel } from "./svg/heatmap.js";
import { signalPanel } from "./svg/signal.js";

export const PANELS: Panel[] = [
  currentlyPanel,
  telemetryPanel,
  featuredPanel,
  stackPanel,
  numbersPanel,
  connectPanel,
  codaPanel,
  heatmapPanel,
  signalPanel,
];
```

- [ ] **Step 7: Swap the canvas into assemble**

In `generator/src/assemble.ts`, replace the `renderStatsSvg` import with:

```ts
import { composeCanvas } from "./render/compose.js";
```

Replace the `assemble` function body:

```ts
export function assemble(ctx: Snapshot): { readme: string; assets: Record<string, string> } {
  const assets: Record<string, string> = {
    "hero-dark.svg": renderHeroSvg("dark", ctx.fields.tagline),
    "hero-light.svg": renderHeroSvg("light", ctx.fields.tagline),
  };
  for (const theme of ["dark", "light"] as const) {
    const telemetry = composeCanvas("telemetry", ctx, theme, ["heatmap", "signal"]);
    if (telemetry) assets[`telemetry-${theme}.svg`] = telemetry;
  }
  return { readme: renderReadme(ctx), assets };
}
```

Replace `SECTION_MARKERS` in the same file — `stats` is gone and `telemetry` is deliberately **not** required, because it legitimately disappears when GitHub returns nothing:

```ts
const SECTION_MARKERS = [
  "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
  "<!-- section:engine-room -->", "<!-- section:numbers -->",
  "<!-- section:connect -->", "<!-- section:coda -->",
];
```

- [ ] **Step 8: Remove the stats section from the assembler**

In `generator/src/render/markdown.ts`, delete the `stats()` function entirely and replace the `ordered` array:

```ts
  const ordered = [
    hero(),
    byId("currently"),
    byId("telemetry"),
    byId("featured"),
    byId("engine-room"),
    byId("numbers"),
    byId("connect"),
    byId("coda"),
  ].filter((s): s is string => Boolean(s));
```

- [ ] **Step 9: Delete the superseded stats renderer**

```bash
git rm generator/src/render/svg-stats.ts generator/src/__tests__/svg-stats.test.ts assets/stats-dark.svg assets/stats-light.svg
```

- [ ] **Step 10: Update the golden test's expected order**

In `generator/src/__tests__/markdown-golden.test.ts`, replace the expected marker order:

```ts
    expect(order).toEqual([
      "hero", "currently", "telemetry", "featured", "engine-room", "numbers", "connect", "coda",
    ]);
```

- [ ] **Step 11: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add generator/src/panels generator/src/assemble.ts generator/src/render/markdown.ts generator/src/__tests__/telemetry.test.ts generator/src/__tests__/markdown-golden.test.ts
git commit -m "feat(generator): replace stats card with telemetry heatmap canvas"
```

---

## Task 8: Config expansion and the WakaTime adapter

The data layer the CRAFT row needs. Config gains every new environment variable in one pass so later tasks only add adapters, and WakaTime replaces its `null` stub. Task 9 renders the panels.

**Files:**
- Modify: `generator/src/config.ts`, `generator/src/data/wakatime.ts`, `generator/src/panels/index.ts`, `generator/src/assemble.ts`, `generator/src/render/markdown.ts`, `generator/src/main.ts`
- Create: `generator/src/panels/svg/languages.ts`, `generator/src/panels/svg/waka.ts`, `generator/src/panels/md/craft.ts`
- Test: `generator/src/__tests__/config.test.ts`, `generator/src/__tests__/wakatime.test.ts`, `generator/src/__tests__/craft.test.ts`

**Interfaces:**
- Consumes: `computeLanguageShares` (Task 5), `bar`, `frame` (Task 3), `composeCanvas` (Task 3).
- Produces:
  - `Config` gains `wakatimeKey: string | null`, `leetcodeHandle: string | null`, `uptimeTargets: Array<{label:string;url:string}>`, `feedUrl: string | null`, `llm: { baseUrl: string; key: string; models: string[] } | null`
  - `getWakatime(config, fetchImpl?): Promise<WakaSnapshot | null>`
  - `languagesPanel`, `wakaPanel` (`SvgPanel`), `craftPanel` (`MarkdownPanel`, marker `<!-- section:craft -->`)

**Breaking change:** `Config.wakatimeEnabled: boolean` is replaced by `Config.wakatimeKey: string | null`. `generator/src/__tests__/github.test.ts` constructs a `Config` literal at line 28 and must be updated, as must any other `Config` literal in the test suite.

- [ ] **Step 1: Write the failing config test**

Replace the contents of `generator/src/__tests__/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("defaults the github login to ReaperOAK", () => {
    expect(loadConfig({}).githubLogin).toBe("ReaperOAK");
  });

  it("returns null for every optional source when the env is empty", () => {
    const c = loadConfig({});
    expect(c.githubToken).toBeNull();
    expect(c.wakatimeKey).toBeNull();
    expect(c.leetcodeHandle).toBeNull();
    expect(c.feedUrl).toBeNull();
    expect(c.llm).toBeNull();
  });

  it("prefers the OmniRoute gateway when LLM_BASE_URL and LLM_API_KEY are set", () => {
    const c = loadConfig({ LLM_BASE_URL: "http://127.0.0.1:20128/v1", LLM_API_KEY: "k" });
    expect(c.llm).toEqual({
      baseUrl: "http://127.0.0.1:20128/v1", key: "k", models: expect.any(Array),
    });
  });

  it("falls back to OpenRouter when only OPENROUTER_API_KEY is set", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "or" });
    expect(c.llm!.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(c.llm!.key).toBe("or");
  });

  it("splits LLM_MODELS on commas and trims", () => {
    const c = loadConfig({ LLM_BASE_URL: "http://x/v1", LLM_API_KEY: "k", LLM_MODELS: " a , b " });
    expect(c.llm!.models).toEqual(["a", "b"]);
  });

  it("parses uptime targets from label=url pairs", () => {
    const c = loadConfig({ UPTIME_TARGETS: "app.example.com=https://app.example.com,shop=https://shop.example.com/" });
    expect(c.uptimeTargets).toEqual([
      { label: "genai-platform", url: "" },
      { label: "creator-marketplace", url: "" },
    ]);
  });

  it("ignores malformed uptime entries rather than throwing", () => {
    expect(loadConfig({ UPTIME_TARGETS: "garbage,,x=" }).uptimeTargets).toEqual([]);
  });

  it("returns an empty uptime list when the variable is unset", () => {
    expect(loadConfig({}).uptimeTargets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/config.test.ts`
Expected: FAIL — `wakatimeKey`, `llm`, `uptimeTargets` do not exist on `Config`.

- [ ] **Step 3: Rewrite config**

Replace the whole of `generator/src/config.ts`:

```ts
export interface UptimeTarget { label: string; url: string; }

export interface Config {
  githubToken: string | null;
  githubLogin: string;
  /** OpenAI-compatible gateway. OmniRoute when reachable, else OpenRouter. */
  llm: { baseUrl: string; key: string; models: string[] } | null;
  wakatimeKey: string | null;
  leetcodeHandle: string | null;
  uptimeTargets: UptimeTarget[];
  feedUrl: string | null;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Ordered chain tried in turn; the first to return valid output wins. If all fail the caller
// degrades to last-good cache, then to the hardcoded static string. All zero-cost.
const DEFAULT_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
];

function resolveModels(env: NodeJS.ProcessEnv): string[] {
  const list = env.LLM_MODELS?.split(",").map((s) => s.trim()).filter(Boolean)
    ?? env.OPENROUTER_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (list && list.length) return list;
  const single = env.OPENROUTER_MODEL?.trim();
  if (single) return [single];
  return DEFAULT_MODELS;
}

/** "label=url,label=url" → targets. Malformed entries are dropped, never thrown on. */
function parseUptimeTargets(raw: string | undefined): UptimeTarget[] {
  if (!raw) return [];
  return raw.split(",").map((pair) => {
    const idx = pair.indexOf("=");
    if (idx <= 0) return null;
    const label = pair.slice(0, idx).trim();
    const url = pair.slice(idx + 1).trim();
    return label && url.startsWith("http") ? { label, url } : null;
  }).filter((t): t is UptimeTarget => t !== null);
}

function resolveLlm(env: NodeJS.ProcessEnv): Config["llm"] {
  const models = resolveModels(env);
  const gatewayKey = env.LLM_API_KEY?.trim();
  const gatewayBase = env.LLM_BASE_URL?.trim();
  if (gatewayKey && gatewayBase) return { baseUrl: gatewayBase, key: gatewayKey, models };
  const orKey = env.OPENROUTER_API_KEY?.trim();
  if (orKey) return { baseUrl: OPENROUTER_BASE, key: orKey, models };
  return null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubLogin: env.GITHUB_LOGIN?.trim() || "ReaperOAK",
    llm: resolveLlm(env),
    wakatimeKey: env.WAKATIME_API_KEY?.trim() || null,
    leetcodeHandle: env.LEETCODE_HANDLE?.trim() || null,
    uptimeTargets: parseUptimeTargets(env.UPTIME_TARGETS),
    feedUrl: env.FEED_URL?.trim() || null,
  };
}
```

- [ ] **Step 4: Repair the Config literals in existing tests**

In `generator/src/__tests__/github.test.ts`, replace the `cfg` constant:

```ts
const cfg: Config = {
  githubToken: "t", githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};
```

Search for any other `Config` literal and apply the same shape:

```bash
grep -rn "wakatimeEnabled\|openRouter" generator/src
```

Every hit must be updated. In `generator/src/llm/prompts.ts`, replace `if (!config.openRouter) return { ...fb };` with `if (!config.llm) return { ...fb };` and `const { key, models } = config.openRouter;` with `const { key, models, baseUrl } = config.llm;`, then pass `baseUrl` through to `chat({ baseUrl, key, model, system, user, fetchImpl })`. Add `baseUrl: string;` to `ChatArgs` in `generator/src/llm/openrouter.ts` and replace the hardcoded URL with `` `${args.baseUrl}/chat/completions` ``. Task 14 renames that file; this step only makes the base URL configurable.

- [ ] **Step 5: Run the config test**

Run: `npx vitest run src/__tests__/config.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Write the failing WakaTime test**

Create `generator/src/__tests__/wakatime.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getWakatime } from "../data/wakatime.js";
import { CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: "waka_test", leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("getWakatime", () => {
  it("returns null when no key is configured", async () => {
    expect(await getWakatime({ ...cfg, wakatimeKey: null })).toBeNull();
  });

  it("parses languages and total time", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days",
      total_seconds: 40000,
      languages: [
        { name: "TypeScript", total_seconds: 27120, percent: 67.8 },
        { name: "Python", total_seconds: 12880, percent: 32.2 },
      ],
    } }));
    const snap = (await getWakatime(cfg, fake as unknown as typeof fetch))!;
    expect(snap.range).toBe("Last 7 Days");
    expect(snap.totalSeconds).toBe(40000);
    expect(snap.languages[0]).toEqual({ name: "TypeScript", seconds: 27120, pct: 67.8 });
  });

  it("returns null rather than an empty widget when the account has no tracked time", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days", total_seconds: 0, languages: [] } }));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null on a non-200 response when there is no cache", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("never throws on a network error", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getWakatime(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("serves the last good value when a later fetch fails", async () => {
    const good = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "Last 7 Days", total_seconds: 100,
      languages: [{ name: "Go", total_seconds: 100, percent: 100 }] } }));
    await getWakatime(cfg, good as unknown as typeof fetch);
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    const snap = (await getWakatime(cfg, bad as unknown as typeof fetch))!;
    expect(snap.languages[0]!.name).toBe("Go");
  });

  it("sends the key as a basic auth header, never in the query string", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: {
      human_readable_range: "r", total_seconds: 1,
      languages: [{ name: "Go", total_seconds: 1, percent: 100 }] } }));
    await getWakatime(cfg, fake as unknown as typeof fetch);
    const [url, init] = fake.mock.calls[0]!;
    expect(String(url)).not.toContain("waka_test");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: `Basic ${Buffer.from("waka_test").toString("base64")}`,
    });
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/__tests__/wakatime.test.ts`
Expected: FAIL — `getWakatime` currently always resolves to `null`, so the parsing tests fail.

- [ ] **Step 8: Write the WakaTime adapter**

Replace the whole of `generator/src/data/wakatime.ts`:

```ts
import type { Config } from "../config.js";
import type { WakaSnapshot } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "wakatime-snapshot";
const ENDPOINT = "https://wakatime.com/api/v1/users/current/stats/last_7_days";
const TOP_LANGUAGES = 5;

/**
 * Returns null — never an empty widget — when there is no key, no tracked time,
 * or no cached value to fall back on.
 */
export async function getWakatime(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<WakaSnapshot | null> {
  if (!config.wakatimeKey) return null;
  try {
    const res = await fetchImpl(ENDPOINT, {
      headers: {
        authorization: `Basic ${Buffer.from(config.wakatimeKey).toString("base64")}`,
        "user-agent": "reaperoak-readme-generator",
      },
    });
    if (!res.ok) throw new Error(`wakatime ${res.status}`);
    const json = (await res.json()) as any;
    const d = json?.data;
    const languages = (d?.languages ?? [])
      .map((l: any) => ({
        name: String(l.name), seconds: Number(l.total_seconds ?? 0), pct: Number(l.percent ?? 0),
      }))
      .filter((l: { seconds: number }) => l.seconds > 0)
      .slice(0, TOP_LANGUAGES);
    if (languages.length === 0) return null;

    const snap: WakaSnapshot = {
      languages,
      totalSeconds: Number(d?.total_seconds ?? 0),
      range: String(d?.human_readable_range ?? "last 7 days"),
    };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return readCache<WakaSnapshot>(CACHE_KEY);
  }
}
```

- [ ] **Step 9: Run the WakaTime test**

Run: `npx vitest run src/__tests__/wakatime.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 10: Commit the data layer before the panels**

```bash
git add generator/src/config.ts generator/src/data/wakatime.ts generator/src/llm generator/src/__tests__/config.test.ts generator/src/__tests__/wakatime.test.ts generator/src/__tests__/github.test.ts
git commit -m "feat(generator): configurable llm gateway and real wakatime adapter"
```

---

## Task 9: Craft canvas panels

The CRAFT row: real language mix beside real WakaTime hours. When WakaTime is absent, the language panel takes the whole row — the composer already widens survivors, so nothing more is needed here.

**Files:**
- Create: `generator/src/panels/svg/languages.ts`, `generator/src/panels/svg/waka.ts`, `generator/src/panels/md/craft.ts`
- Modify: `generator/src/panels/index.ts`, `generator/src/assemble.ts`, `generator/src/render/markdown.ts`, `generator/src/main.ts`
- Test: `generator/src/__tests__/craft.test.ts`

**Interfaces:**
- Consumes: `bar`, `frame` (Task 3); `computeLanguageShares` (Task 5); `getWakatime` (Task 8); `Snapshot.languages`, `Snapshot.waka`.
- Produces: `languagesPanel`, `wakaPanel` (`SvgPanel`), `craftPanel` (`MarkdownPanel`, marker `<!-- section:craft -->`, assets `craft-{dark,light}.svg`).

- [ ] **Step 1: Write the failing test**

Create `generator/src/__tests__/craft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { languagesPanel } from "../panels/svg/languages.js";
import { wakaPanel } from "../panels/svg/waka.js";
import { craftPanel } from "../panels/md/craft.js";
import { THEME } from "../render/svg-util.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const t = THEME.dark;
const box = { x: 0, y: 0, w: 420, h: 220 };

const withLangs: Snapshot = { ...FIXTURE, languages: [
  { name: "TypeScript", color: "#3178c6", pct: 41.2 },
  { name: "Python", color: "#3572A5", pct: 22.0 },
] };

const withWaka: Snapshot = { ...FIXTURE, waka: {
  range: "Last 7 Days", totalSeconds: 40000,
  languages: [{ name: "TypeScript", seconds: 27120, pct: 67.8 }],
} };

describe("languagesPanel", () => {
  it("omits itself when there are no shares", () => {
    expect(languagesPanel.select({ ...FIXTURE, languages: null })).toBeNull();
    expect(languagesPanel.select({ ...FIXTURE, languages: [] })).toBeNull();
  });

  it("renders one labelled bar per language", () => {
    const out = languagesPanel.render(languagesPanel.select(withLangs)!, t, box);
    expect(out).toContain("TypeScript");
    expect(out).toContain("Python");
    expect(out).toContain("41.2%");
  });

  it("colours each bar with the language colour, not the accent", () => {
    const out = languagesPanel.render(languagesPanel.select(withLangs)!, t, box);
    expect(out).toContain("#3178c6");
  });
});

describe("wakaPanel", () => {
  it("omits itself when wakatime returned nothing", () => {
    expect(wakaPanel.select({ ...FIXTURE, waka: null })).toBeNull();
  });

  it("renders hours and minutes, not raw seconds", () => {
    const out = wakaPanel.render(wakaPanel.select(withWaka)!, t, box);
    expect(out).toContain("7h 32m");
    expect(out).not.toContain("27120");
  });

  it("renders a sub-hour language as minutes only", () => {
    const ctx: Snapshot = { ...FIXTURE, waka: { range: "r", totalSeconds: 600,
      languages: [{ name: "Shell", seconds: 600, pct: 100 }] } };
    expect(wakaPanel.render(wakaPanel.select(ctx)!, t, box)).toContain("10m");
  });
});

describe("craftPanel", () => {
  it("omits itself when neither source has data", () => {
    expect(craftPanel.select({ ...FIXTURE, languages: null, waka: null })).toBeNull();
  });

  it("appears when only the language mix is available", () => {
    expect(craftPanel.select({ ...withLangs, waka: null })).not.toBeNull();
  });

  it("emits a dual-theme picture block for the craft canvas", () => {
    const out = craftPanel.render(craftPanel.select(withLangs)!, withLangs);
    expect(out).toContain("<!-- section:craft -->");
    expect(out).toContain("assets/craft-dark.svg");
    expect(out).toContain("assets/craft-light.svg");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/craft.test.ts`
Expected: FAIL — three unresolved imports.

- [ ] **Step 3: Write the languages panel**

Create `generator/src/panels/svg/languages.ts`:

```ts
import type { SvgPanel } from "../types.js";
import type { LanguageShare } from "../../types.js";
import { bar, frame } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

const ROW_H = 30;

export const languagesPanel: SvgPanel<LanguageShare[]> = {
  id: "languages",
  kind: "svg",
  size: { w: 420, h: 220 },
  select: (ctx) => (ctx.languages && ctx.languages.length ? ctx.languages : null),
  render: (shares, t, box) => {
    const rows = shares.map((s, i) => {
      const y = box.y + 46 + i * ROW_H;
      return `<text x="${box.x + 16}" y="${y}" font-family="ui-monospace,monospace" font-size="12" fill="${t.ink}">${escapeXml(s.name)}</text>
<text x="${box.x + box.w - 16}" y="${y}" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="${t.mut}">${s.pct.toFixed(1)}%</text>
${bar({ x: box.x + 16, y: y + 6, w: box.w - 32, h: 6 }, s.pct, t, s.color)}`;
    }).join("\n");
    return `${frame(box, t, "language mix · weighted by recency")}\n${rows}`;
  },
};
```

- [ ] **Step 4: Write the WakaTime panel**

Create `generator/src/panels/svg/waka.ts`:

```ts
import type { SvgPanel } from "../types.js";
import type { WakaSnapshot } from "../../types.js";
import { bar, frame } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

const ROW_H = 30;

/** 27120 → "7h 32m"; 600 → "10m". Never prints a bare second count. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const wakaPanel: SvgPanel<WakaSnapshot> = {
  id: "waka",
  kind: "svg",
  size: { w: 420, h: 220 },
  select: (ctx) => ctx.waka,
  render: (w, t, box) => {
    const rows = w.languages.map((l, i) => {
      const y = box.y + 46 + i * ROW_H;
      return `<text x="${box.x + 16}" y="${y}" font-family="ui-monospace,monospace" font-size="12" fill="${t.ink}">${escapeXml(l.name)}</text>
<text x="${box.x + box.w - 16}" y="${y}" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="${t.mut}">${formatDuration(l.seconds)}</text>
${bar({ x: box.x + 16, y: y + 6, w: box.w - 32, h: 6 }, l.pct, t)}`;
    }).join("\n");
    return `${frame(box, t, `wakatime · ${w.range}`)}\n${rows}`;
  },
};
```

- [ ] **Step 5: Write the craft markdown panel**

Create `generator/src/panels/md/craft.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { languagesPanel } from "../svg/languages.js";
import { wakaPanel } from "../svg/waka.js";

export const craftPanel: MarkdownPanel<true> = {
  id: "craft",
  kind: "markdown",
  select: (ctx) =>
    languagesPanel.select(ctx) !== null || wakaPanel.select(ctx) !== null ? true : null,
  render: () => `<!-- section:craft -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/craft-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/craft-light.svg">
  <img alt="Language mix and coding time" src="assets/craft-dark.svg" width="900">
</picture>
</div>`,
};
```

- [ ] **Step 6: Register the panels**

In `generator/src/panels/index.ts`, add the imports and place `craftPanel` after `telemetryPanel`, with the two SVG panels appended:

```ts
import { craftPanel } from "./md/craft.js";
import { languagesPanel } from "./svg/languages.js";
import { wakaPanel } from "./svg/waka.js";

export const PANELS: Panel[] = [
  currentlyPanel,
  telemetryPanel,
  craftPanel,
  featuredPanel,
  stackPanel,
  numbersPanel,
  connectPanel,
  codaPanel,
  heatmapPanel,
  signalPanel,
  languagesPanel,
  wakaPanel,
];
```

- [ ] **Step 7: Add the canvas to assemble**

In `generator/src/assemble.ts`, extend the theme loop inside `assemble`:

```ts
  for (const theme of ["dark", "light"] as const) {
    const telemetry = composeCanvas("telemetry", ctx, theme, ["heatmap", "signal"]);
    if (telemetry) assets[`telemetry-${theme}.svg`] = telemetry;
    const craft = composeCanvas("craft", ctx, theme, ["languages", "waka"]);
    if (craft) assets[`craft-${theme}.svg`] = craft;
  }
```

- [ ] **Step 8: Place the section**

In `generator/src/render/markdown.ts`, add `byId("craft")` after `byId("telemetry")` in the `ordered` array.

In `generator/src/__tests__/markdown-golden.test.ts`, the marker-order assertion now depends on whether the fixture has language data. `FIXTURE` has `languages: null` and `waka: null`, so `craft` is absent and the expected order is unchanged. Add a second test proving it appears when data exists:

```ts
  it("inserts the craft section when a language mix exists", () => {
    const md = renderReadme({ ...FIXTURE, languages: [
      { name: "TypeScript", color: "#3178c6", pct: 100 },
    ] });
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order).toContain("craft");
    expect(order.indexOf("craft")).toBeLessThan(order.indexOf("featured"));
  });
```

- [ ] **Step 9: Wire the adapters into main**

Replace the body of `main()` in `generator/src/main.ts`:

```ts
async function main(): Promise<void> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const root = resolve(here, "..", ".."); // repo root (generator/src → repo)
  const config = loadConfig();

  const github = await getGithubSnapshot(config);
  const [waka] = await Promise.all([getWakatime(config)]);
  const fields = await getDynamicFields(config, github);

  const ctx: Snapshot = {
    github,
    fields,
    languages: computeLanguageShares(github.repos, new Date().toISOString()),
    featured: rankRepos(github.repos, {
      todayISO: new Date().toISOString(),
      pins: content.featuredPins,
      blocks: content.featuredBlocks,
      limit: 6,
    }),
    waka,
    leetcode: null,
    neetcode: null,
    uptime: null,
    feed: null,
    syncedAt: github.fetchedAt,
  };

  const built = assemble(ctx);
  writeOutputs(root, built);
  console.log("README generated:", Object.keys(built.assets).join(", "));
}
```

Add these imports at the top of `generator/src/main.ts`:

```ts
import { getWakatime } from "./data/wakatime.js";
import { computeLanguageShares } from "./data/languages.js";
import { rankRepos } from "./data/ranking.js";
import { content } from "./content.js";
```

`Promise.all` around a single call looks odd today; Tasks 10–12 add LeetCode, NeetCode and uptime to the same array so all network work runs concurrently.

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add generator/src/panels generator/src/assemble.ts generator/src/render/markdown.ts generator/src/main.ts generator/src/__tests__/craft.test.ts generator/src/__tests__/markdown-golden.test.ts
git commit -m "feat(generator): add craft canvas with language mix and coding time"
```

---

## Task 10: LeetCode and NeetCode adapters

Two problem-solving signals. LeetCode comes from the public GraphQL endpoint (no key). NeetCode progress is derived from the `ReaperOAK/neetcode-submissions` repo tree — distinct problem directories against a target of 150 — so it updates itself every time a solution is pushed, with no number to bump by hand.

**Files:**
- Create: `generator/src/data/leetcode.ts`, `generator/src/data/neetcode.ts`
- Test: `generator/src/__tests__/leetcode.test.ts`, `generator/src/__tests__/neetcode.test.ts`

**Interfaces:**
- Consumes: `Config` (Task 8), `LeetcodeSnapshot`, `NeetcodeSnapshot` (Task 1), `readCache`/`writeCache`.
- Produces:
  - `getLeetcode(config, fetchImpl?): Promise<LeetcodeSnapshot | null>`
  - `getNeetcode(config, fetchImpl?): Promise<NeetcodeSnapshot | null>` and the exported pure helper `countDistinctProblems(paths: string[]): number`

- [ ] **Step 1: Write the failing LeetCode test**

Create `generator/src/__tests__/leetcode.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getLeetcode } from "../data/leetcode.js";
import { CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: "oaak78692", uptimeTargets: [], feedUrl: null,
};

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const payload = (all: number, easy: number, medium: number, hard: number, ranking: number | null) => ({
  data: {
    matchedUser: {
      submitStatsGlobal: { acSubmissionNum: [
        { difficulty: "All", count: all }, { difficulty: "Easy", count: easy },
        { difficulty: "Medium", count: medium }, { difficulty: "Hard", count: hard },
      ] },
      profile: { ranking },
    },
  },
});

describe("getLeetcode", () => {
  it("returns null when no handle is configured", async () => {
    expect(await getLeetcode({ ...cfg, leetcodeHandle: null })).toBeNull();
  });

  it("parses solved counts by difficulty", async () => {
    const fake = vi.fn().mockResolvedValue(ok(payload(214, 96, 101, 17, 184203)));
    const snap = (await getLeetcode(cfg, fake as unknown as typeof fetch))!;
    expect(snap).toEqual({
      handle: "oaak78692", total: 214, easy: 96, medium: 101, hard: 17, ranking: 184203,
    });
  });

  it("tolerates a missing profile ranking", async () => {
    const fake = vi.fn().mockResolvedValue(ok(payload(10, 10, 0, 0, null)));
    expect((await getLeetcode(cfg, fake as unknown as typeof fetch))!.ranking).toBeNull();
  });

  it("returns null when the user has solved nothing", async () => {
    const fake = vi.fn().mockResolvedValue(ok(payload(0, 0, 0, 0, null)));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the handle does not exist", async () => {
    const fake = vi.fn().mockResolvedValue(ok({ data: { matchedUser: null } }));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("never throws on a network error", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getLeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("serves the last good value when a later fetch fails", async () => {
    const good = vi.fn().mockResolvedValue(ok(payload(5, 5, 0, 0, 1)));
    await getLeetcode(cfg, good as unknown as typeof fetch);
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await getLeetcode(cfg, bad as unknown as typeof fetch))!.total).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/leetcode.test.ts`
Expected: FAIL — `Failed to resolve import "../data/leetcode.js"`

- [ ] **Step 3: Write the LeetCode adapter**

Create `generator/src/data/leetcode.ts`:

```ts
import type { Config } from "../config.js";
import type { LeetcodeSnapshot } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "leetcode-snapshot";
const ENDPOINT = "https://leetcode.com/graphql";

const QUERY = `query($username:String!){
  matchedUser(username:$username){
    submitStatsGlobal{ acSubmissionNum{ difficulty count } }
    profile{ ranking }
  }
}`;

function countFor(rows: Array<{ difficulty: string; count: number }>, key: string): number {
  return Number(rows.find((r) => r.difficulty === key)?.count ?? 0);
}

/** Public endpoint, no key. Returns null when the handle is unset, unknown, or has no solves. */
export async function getLeetcode(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<LeetcodeSnapshot | null> {
  const handle = config.leetcodeHandle;
  if (!handle) return null;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: `https://leetcode.com/u/${handle}/`,
        "user-agent": "reaperoak-readme-generator",
      },
      body: JSON.stringify({ query: QUERY, variables: { username: handle } }),
    });
    if (!res.ok) throw new Error(`leetcode ${res.status}`);
    const json = (await res.json()) as any;
    const user = json?.data?.matchedUser;
    if (!user) throw new Error("no such user");

    const rows = user.submitStatsGlobal?.acSubmissionNum ?? [];
    const total = countFor(rows, "All");
    if (total <= 0) return null;

    const snap: LeetcodeSnapshot = {
      handle,
      total,
      easy: countFor(rows, "Easy"),
      medium: countFor(rows, "Medium"),
      hard: countFor(rows, "Hard"),
      ranking: user.profile?.ranking != null ? Number(user.profile.ranking) : null,
    };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return readCache<LeetcodeSnapshot>(CACHE_KEY);
  }
}
```

- [ ] **Step 4: Run the LeetCode test**

Run: `npx vitest run src/__tests__/leetcode.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing NeetCode test**

Create `generator/src/__tests__/neetcode.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";
import { getNeetcode, countDistinctProblems } from "../data/neetcode.js";
import { CACHE_DIR } from "../cache.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: "t", githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: null, uptimeTargets: [], feedUrl: null,
};

beforeEach(() => { try { rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ } });

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const tree = (paths: string[]) => ok({ tree: paths.map((path) => ({ path, type: "blob" })) });

describe("countDistinctProblems", () => {
  it("counts one problem however many submissions it has", () => {
    expect(countDistinctProblems([
      "Data Structures & Algorithms/two-sum/submission-0.py",
      "Data Structures & Algorithms/two-sum/submission-1.py",
      "Data Structures & Algorithms/two-sum/submission-2.py",
    ])).toBe(1);
  });

  it("counts distinct problem directories", () => {
    expect(countDistinctProblems([
      "Data Structures & Algorithms/two-sum/submission-0.py",
      "Data Structures & Algorithms/binary-search/submission-0.py",
    ])).toBe(2);
  });

  it("ignores top-level files that are not inside a problem directory", () => {
    expect(countDistinctProblems(["README.md", "Data Structures & Algorithms/two-sum/s.py"])).toBe(1);
  });

  it("returns 0 for an empty tree", () => {
    expect(countDistinctProblems([])).toBe(0);
  });
});

describe("getNeetcode", () => {
  it("returns null without a github token", async () => {
    expect(await getNeetcode({ ...cfg, githubToken: null })).toBeNull();
  });

  it("reports solved against the 150 target", async () => {
    const fake = vi.fn().mockResolvedValue(tree([
      "Data Structures & Algorithms/two-sum/submission-0.py",
      "Data Structures & Algorithms/binary-search/submission-0.py",
    ]));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toEqual({ solved: 2, target: 150 });
  });

  it("returns null when nothing has been solved", async () => {
    const fake = vi.fn().mockResolvedValue(tree([]));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("never throws when the repo is missing", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
    expect(await getNeetcode(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("serves the last good value when a later fetch fails", async () => {
    const good = vi.fn().mockResolvedValue(tree(["D/a/s.py", "D/b/s.py", "D/c/s.py"]));
    await getNeetcode(cfg, good as unknown as typeof fetch);
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await getNeetcode(cfg, bad as unknown as typeof fetch))!.solved).toBe(3);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/__tests__/neetcode.test.ts`
Expected: FAIL — `Failed to resolve import "../data/neetcode.js"`

- [ ] **Step 7: Write the NeetCode adapter**

Create `generator/src/data/neetcode.ts`:

```ts
import type { Config } from "../config.js";
import type { NeetcodeSnapshot } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "neetcode-snapshot";
const REPO = "neetcode-submissions";
const TARGET = 150;

/**
 * One problem = one directory, however many submission files it holds.
 * Paths shaped "<category>/<problem>/<file>"; anything shallower is not a solution.
 */
export function countDistinctProblems(paths: string[]): number {
  const problems = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    if (parts.length < 3) continue;
    problems.add(`${parts[0]}/${parts[1]}`);
  }
  return problems.size;
}

export async function getNeetcode(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<NeetcodeSnapshot | null> {
  if (!config.githubToken) return null;
  try {
    const url = `https://api.github.com/repos/${config.githubLogin}/${REPO}/git/trees/HEAD?recursive=1`;
    const res = await fetchImpl(url, {
      headers: {
        authorization: `Bearer ${config.githubToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "reaperoak-readme-generator",
      },
    });
    if (!res.ok) throw new Error(`neetcode ${res.status}`);
    const json = (await res.json()) as any;
    const paths: string[] = (json?.tree ?? [])
      .filter((n: any) => n?.type === "blob")
      .map((n: any) => String(n.path));

    const solved = countDistinctProblems(paths);
    if (solved <= 0) return null;

    const snap: NeetcodeSnapshot = { solved, target: TARGET };
    writeCache(CACHE_KEY, snap);
    return snap;
  } catch {
    return readCache<NeetcodeSnapshot>(CACHE_KEY);
  }
}
```

- [ ] **Step 8: Run the NeetCode test**

Run: `npx vitest run src/__tests__/neetcode.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add generator/src/data/leetcode.ts generator/src/data/neetcode.ts generator/src/__tests__/leetcode.test.ts generator/src/__tests__/neetcode.test.ts
git commit -m "feat(generator): add leetcode and neetcode progress adapters"
```

---

## Task 11: Uptime adapter and the arena canvas

The ARENA row: LeetCode counts, the live NeetCode gauge, and real deploy status. A timed-out check renders `—`, never a fabricated `200`.

**Files:**
- Create: `generator/src/data/uptime.ts`, `generator/src/panels/svg/leetcode.ts`, `generator/src/panels/svg/roadmapGauge.ts`, `generator/src/panels/svg/status.ts`, `generator/src/panels/md/arena.ts`
- Modify: `generator/src/panels/index.ts`, `generator/src/assemble.ts`, `generator/src/render/markdown.ts`, `generator/src/main.ts`
- Test: `generator/src/__tests__/uptime.test.ts`, `generator/src/__tests__/arena.test.ts`

**Interfaces:**
- Consumes: `UptimeResult` (Task 1), `Config.uptimeTargets` (Task 8), `getLeetcode`/`getNeetcode` (Task 10), `frame`/`gauge`/`statusDot`/`counter` (Task 3).
- Produces: `checkUptime(config, fetchImpl?): Promise<UptimeResult[] | null>`; `leetcodePanel`, `roadmapGaugePanel`, `statusPanel` (`SvgPanel`); `arenaPanel` (`MarkdownPanel`, marker `<!-- section:arena -->`, assets `arena-{dark,light}.svg`).

- [ ] **Step 1: Write the failing uptime test**

Create `generator/src/__tests__/uptime.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { checkUptime } from "../data/uptime.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: null, feedUrl: null,
  uptimeTargets: [
    { label: "genai-platform", url: "" },
    { label: "creator-marketplace", url: "" },
  ],
};

describe("checkUptime", () => {
  it("returns null when no targets are configured", async () => {
    expect(await checkUptime({ ...cfg, uptimeTargets: [] })).toBeNull();
  });

  it("reports the status code for each target", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const out = (await checkUptime(cfg, fake as unknown as typeof fetch))!;
    expect(out).toHaveLength(2);
    expect(out[0]!.label).toBe("genai-platform");
    expect(out[0]!.status).toBe(200);
    expect(out[0]!.ms).toBeGreaterThanOrEqual(0);
  });

  it("issues HEAD requests, not GET", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await checkUptime(cfg, fake as unknown as typeof fetch);
    expect((fake.mock.calls[0]![1] as RequestInit).method).toBe("HEAD");
  });

  it("records a null status for a failed check rather than inventing one", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("timeout"));
    const out = (await checkUptime(cfg, fake as unknown as typeof fetch))!;
    expect(out[0]!.status).toBeNull();
    expect(out[0]!.ms).toBeNull();
  });

  it("keeps a healthy target when a sibling fails", async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValueOnce(new Error("down"));
    const out = (await checkUptime(cfg, fake as unknown as typeof fetch))!;
    expect(out[0]!.status).toBe(200);
    expect(out[1]!.status).toBeNull();
  });

  it("reports a 5xx as the real code, not as a failure", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    expect((await checkUptime(cfg, fake as unknown as typeof fetch))![0]!.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/uptime.test.ts`
Expected: FAIL — `Failed to resolve import "../data/uptime.js"`

- [ ] **Step 3: Write the uptime adapter**

Create `generator/src/data/uptime.ts`:

```ts
import type { Config } from "../config.js";
import type { UptimeResult } from "../types.js";

const TIMEOUT_MS = 5000;

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
      const res = await fetchImpl(target.url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "reaperoak-readme-generator" },
      });
      return { label: target.label, url: target.url, status: res.status, ms: Date.now() - started };
    } catch {
      return { label: target.label, url: target.url, status: null, ms: null };
    }
  }));
}
```

- [ ] **Step 4: Run the uptime test**

Run: `npx vitest run src/__tests__/uptime.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing arena test**

Create `generator/src/__tests__/arena.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { leetcodePanel } from "../panels/svg/leetcode.js";
import { roadmapGaugePanel } from "../panels/svg/roadmapGauge.js";
import { statusPanel } from "../panels/svg/status.js";
import { arenaPanel } from "../panels/md/arena.js";
import { THEME } from "../render/svg-util.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const t = THEME.dark;
const box = { x: 0, y: 0, w: 280, h: 190 };

const withLeet: Snapshot = { ...FIXTURE, leetcode: {
  handle: "oaak78692", total: 214, easy: 96, medium: 101, hard: 17, ranking: 184203 } };
const withNeet: Snapshot = { ...FIXTURE, neetcode: { solved: 51, target: 150 } };
const withStatus: Snapshot = { ...FIXTURE, uptime: [
  { label: "genai-platform", url: "", status: 200, ms: 143 },
  { label: "creator-marketplace", url: "", status: null, ms: null },
] };

describe("leetcodePanel", () => {
  it("omits itself when leetcode returned nothing", () => {
    expect(leetcodePanel.select({ ...FIXTURE, leetcode: null })).toBeNull();
  });

  it("shows the total and the per-difficulty split", () => {
    const out = leetcodePanel.render(leetcodePanel.select(withLeet)!, t, box);
    expect(out).toContain("214");
    expect(out).toContain("96");
    expect(out).toContain("17");
  });
});

describe("roadmapGaugePanel", () => {
  it("omits itself when there is no neetcode data", () => {
    expect(roadmapGaugePanel.select({ ...FIXTURE, neetcode: null })).toBeNull();
  });

  it("renders solved against the target", () => {
    const out = roadmapGaugePanel.render(roadmapGaugePanel.select(withNeet)!, t, box);
    expect(out).toContain("51");
    expect(out).toContain("150");
  });
});

describe("statusPanel", () => {
  it("omits itself when there are no checks", () => {
    expect(statusPanel.select({ ...FIXTURE, uptime: null })).toBeNull();
    expect(statusPanel.select({ ...FIXTURE, uptime: [] })).toBeNull();
  });

  it("prints an em dash for an unreachable target instead of a status code", () => {
    const out = statusPanel.render(statusPanel.select(withStatus)!, t, box);
    expect(out).toContain("200");
    expect(out).toContain("—");
  });

  it("labels each target", () => {
    const out = statusPanel.render(statusPanel.select(withStatus)!, t, box);
    expect(out).toContain("genai-platform");
    expect(out).toContain("creator-marketplace");
  });
});

describe("arenaPanel", () => {
  it("omits itself when all three sources are empty", () => {
    expect(arenaPanel.select(FIXTURE)).toBeNull();
  });

  it("appears when only the neetcode gauge has data", () => {
    expect(arenaPanel.select(withNeet)).not.toBeNull();
  });

  it("emits a dual-theme picture block for the arena canvas", () => {
    const out = arenaPanel.render(arenaPanel.select(withNeet)!, withNeet);
    expect(out).toContain("<!-- section:arena -->");
    expect(out).toContain("assets/arena-dark.svg");
    expect(out).toContain("assets/arena-light.svg");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/__tests__/arena.test.ts`
Expected: FAIL — four unresolved imports.

- [ ] **Step 7: Write the three SVG panels**

Create `generator/src/panels/svg/leetcode.ts`:

```ts
import type { SvgPanel } from "../types.js";
import type { LeetcodeSnapshot } from "../../types.js";
import { counter, frame } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

export const leetcodePanel: SvgPanel<LeetcodeSnapshot> = {
  id: "leetcode",
  kind: "svg",
  size: { w: 280, h: 190 },
  select: (ctx) => ctx.leetcode,
  render: (l, t, box) => {
    const split: Array<[number, string]> = [[l.easy, "easy"], [l.medium, "med"], [l.hard, "hard"]];
    const step = box.w / split.length;
    const cells = split.map(([v, label], i) =>
      counter(box.x + step * (i + 0.5), box.y + 148, String(v), label, t)).join("\n");
    const rank = l.ranking !== null
      ? `<text x="${box.x + box.w / 2}" y="${box.y + 100}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}">rank ${l.ranking.toLocaleString("en-US")}</text>`
      : "";
    return `${frame(box, t, `leetcode · ${escapeXml(l.handle)}`)}
<text x="${box.x + box.w / 2}" y="${box.y + 80}" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="44" fill="${t.accent}">${l.total}</text>
${rank}
${cells}`;
  },
};
```

Create `generator/src/panels/svg/roadmapGauge.ts`:

```ts
import type { SvgPanel } from "../types.js";
import type { NeetcodeSnapshot } from "../../types.js";
import { frame, gauge } from "../../render/svg/primitives.js";

export const roadmapGaugePanel: SvgPanel<NeetcodeSnapshot> = {
  id: "roadmap-gauge",
  kind: "svg",
  size: { w: 280, h: 190 },
  select: (ctx) => ctx.neetcode,
  render: (n, t, box) => {
    const pct = Math.round((n.solved / Math.max(1, n.target)) * 100);
    return `${frame(box, t, "neetcode 150")}
${gauge({ x: box.x + 16, y: box.y + 70, w: box.w - 32, h: 34 }, n.solved, n.target, t)}
<text x="${box.x + 16}" y="${box.y + 140}" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}">${pct}% complete</text>`;
  },
};
```

Create `generator/src/panels/svg/status.ts`:

```ts
import type { SvgPanel } from "../types.js";
import type { UptimeResult } from "../../types.js";
import { frame, statusDot } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

const ROW_H = 26;

export const statusPanel: SvgPanel<UptimeResult[]> = {
  id: "status",
  kind: "svg",
  size: { w: 280, h: 190 },
  select: (ctx) => (ctx.uptime && ctx.uptime.length ? ctx.uptime : null),
  render: (rows, t, box) => {
    const body = rows.slice(0, 4).map((r, i) => {
      const y = box.y + 52 + i * ROW_H;
      const ok = r.status !== null && r.status < 400;
      // An unreachable target prints an em dash. Never a fabricated status code.
      const reading = r.status === null ? "—" : String(r.status);
      return `${statusDot(box.x + 22, y - 4, ok, t)}
<text x="${box.x + 36}" y="${y}" font-family="ui-monospace,monospace" font-size="11" fill="${t.ink}">${escapeXml(r.label)}</text>
<text x="${box.x + box.w - 16}" y="${y}" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}">${reading}</text>`;
    }).join("\n");
    return `${frame(box, t, "system status")}\n${body}`;
  },
};
```

- [ ] **Step 8: Write the arena markdown panel**

Create `generator/src/panels/md/arena.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { leetcodePanel } from "../svg/leetcode.js";
import { roadmapGaugePanel } from "../svg/roadmapGauge.js";
import { statusPanel } from "../svg/status.js";

export const arenaPanel: MarkdownPanel<true> = {
  id: "arena",
  kind: "markdown",
  select: (ctx) =>
    leetcodePanel.select(ctx) !== null
    || roadmapGaugePanel.select(ctx) !== null
    || statusPanel.select(ctx) !== null
      ? true : null,
  render: () => `<!-- section:arena -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/arena-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/arena-light.svg">
  <img alt="Problem solving progress and deploy status" src="assets/arena-dark.svg" width="900">
</picture>
</div>`,
};
```

- [ ] **Step 9: Register, compose and place**

In `generator/src/panels/index.ts` add the four imports, put `arenaPanel` after `craftPanel`, and append the three SVG panels to the array.

In `generator/src/assemble.ts`, extend the theme loop:

```ts
    const arena = composeCanvas("arena", ctx, theme, ["leetcode", "roadmap-gauge", "status"]);
    if (arena) assets[`arena-${theme}.svg`] = arena;
```

In `generator/src/render/markdown.ts`, add `byId("arena")` after `byId("craft")` in the `ordered` array.

- [ ] **Step 10: Wire the adapters into main**

In `generator/src/main.ts`, replace the single-element `Promise.all` with all three concurrent sources, and fill the fields:

```ts
  const [waka, leetcode, neetcode, uptime] = await Promise.all([
    getWakatime(config),
    getLeetcode(config),
    getNeetcode(config),
    checkUptime(config),
  ]);
```

and in the `ctx` literal replace the three placeholder lines with `leetcode,`, `neetcode,`, `uptime,`.

Add the imports:

```ts
import { getLeetcode } from "./data/leetcode.js";
import { getNeetcode } from "./data/neetcode.js";
import { checkUptime } from "./data/uptime.js";
```

- [ ] **Step 11: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add generator/src/data/uptime.ts generator/src/panels generator/src/assemble.ts generator/src/render/markdown.ts generator/src/main.ts generator/src/__tests__/uptime.test.ts generator/src/__tests__/arena.test.ts
git commit -m "feat(generator): add arena canvas with leetcode, neetcode and deploy status"
```

---

## Task 12: Narrative content — case studies, roadmap, principles

Static, human-authored content. The drafts below are built from verified material: the numbers in the ai-trader-lab study are quoted from that repo's own README; the ForgeOS line comes from the GitHub languages API (2,223,099 bytes TypeScript, 697,121 Python); the todayeggrates traffic figures are the ones already published in `content.numbers`.

**Files:**
- Modify: `generator/src/types.ts`, `generator/src/content.ts`
- Create: `generator/src/panels/md/cases.ts`, `generator/src/panels/md/roadmap.ts`, `generator/src/panels/md/how.ts`
- Modify: `generator/src/panels/index.ts`, `generator/src/render/markdown.ts`
- Test: `generator/src/__tests__/narrative.test.ts`

**Interfaces:**
- Consumes: `Snapshot.neetcode` (Task 10), `content` (static).
- Produces: `casesPanel` (`<!-- section:cases -->`), `roadmapPanel` (`<!-- section:roadmap -->`), `howPanel` (`<!-- section:how -->`); new `StaticContent` fields `caseStudies`, `roadmapTopics`, `principles`.

- [ ] **Step 1: Add the content types**

Append to `generator/src/types.ts`:

```ts
export interface CaseStudy {
  title: string;
  url: string;
  /** The situation, in one line. */
  problem: string;
  /** The decision taken and why — the part that shows judgement. */
  decision: string;
  /** What was given up. A case study with no tradeoff is a brochure. */
  tradeoff: string;
  /** The measured outcome. Empty string when there is no honest number to give. */
  outcome: string;
  stack: string;
}

export interface RoadmapTopic { name: string; detail: string; progress: number; }
```

And add to the `StaticContent` interface:

```ts
  caseStudies: CaseStudy[];
  roadmapTopics: RoadmapTopic[];
  principles: string[];
```

- [ ] **Step 2: Write the failing test**

Create `generator/src/__tests__/narrative.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { casesPanel } from "../panels/md/cases.js";
import { roadmapPanel } from "../panels/md/roadmap.js";
import { howPanel } from "../panels/md/how.js";
import { content } from "../content.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const withNeet: Snapshot = { ...FIXTURE, neetcode: { solved: 51, target: 150 } };

describe("casesPanel", () => {
  it("renders one collapsible block per case study", () => {
    const out = casesPanel.render(casesPanel.select(FIXTURE)!, FIXTURE);
    expect((out.match(/<details>/g) ?? []).length).toBe(content.caseStudies.length);
    expect((out.match(/<\/details>/g) ?? []).length).toBe(content.caseStudies.length);
  });

  it("keeps every project link as real markdown, never inside an image", () => {
    const out = casesPanel.render(casesPanel.select(FIXTURE)!, FIXTURE);
    for (const c of content.caseStudies) expect(out).toContain(`(${c.url})`);
    expect(out).not.toContain("<img");
  });

  it("states a tradeoff for every case study", () => {
    for (const c of content.caseStudies) expect(c.tradeoff.length).toBeGreaterThan(0);
  });

  it("omits the outcome line when there is no honest number", () => {
    const out = casesPanel.render(
      [{ title: "T", url: "https://x", problem: "p", decision: "d", tradeoff: "t", outcome: "", stack: "s" }],
      FIXTURE,
    );
    expect(out).not.toContain("**Outcome**");
  });
});

describe("roadmapPanel", () => {
  it("shows the live neetcode count when it is available", () => {
    const out = roadmapPanel.render(roadmapPanel.select(withNeet)!, withNeet);
    expect(out).toContain("51 / 150");
  });

  it("omits the neetcode row entirely when the repo could not be read", () => {
    const out = roadmapPanel.render(roadmapPanel.select(FIXTURE)!, FIXTURE);
    expect(out).not.toContain("NeetCode 150");
  });

  it("renders a progress bar per configured topic", () => {
    const out = roadmapPanel.render(roadmapPanel.select(FIXTURE)!, FIXTURE);
    for (const topic of content.roadmapTopics) expect(out).toContain(topic.name);
  });
});

describe("howPanel", () => {
  it("renders every principle", () => {
    const out = howPanel.render(howPanel.select(FIXTURE)!, FIXTURE);
    for (const p of content.principles) expect(out).toContain(p);
  });

  it("omits itself when no principles are configured", () => {
    expect(howPanel.select({ ...FIXTURE })).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/__tests__/narrative.test.ts`
Expected: FAIL — three unresolved imports.

- [ ] **Step 4: Add the content**

In `generator/src/content.ts`, add these three fields to the `content` object:

```ts
  caseStudies: [
    {
      title: "survivorship-free-backtester",
      url: "https://github.com/ReaperOAK/survivorship-free-backtester",
      problem: "Retail backtests test the past using today's winning stocks. The bias is invisible and it inflates every result.",
      decision: "Reconstructed point-in-time Nifty 100/200/500 membership from the Internet Archive, recovered delisted-loser prices, and re-ran every strategy against the honest universe. Lot-level FIFO on top, with real Indian tax (20% STCG / 12.5% LTCG).",
      tradeoff: "The correction destroyed the headline. Momentum's Sharpe fell from ~1.5 to ~1.0, and after tax the high-turnover strategies barely beat buy-and-hold. Publishing that was the point.",
      outcome: "Survivorship inflates momentum by +0.4 to +0.9 Sharpe. Ensemble + regime-cash roughly halves drawdown, −38% to ~−18% — insurance, not free alpha. Intraday dip-buying died under honest testing.",
      stack: "Python · DuckDB · yfinance · NSE bhavcopy",
    },
    {
      title: "todayeggrates",
      url: "https://todayeggrates.com/",
      problem: "Daily commodity rates that people actually check, which means the site is worthless the day it goes stale.",
      decision: "Content as MDX so rates and long-form pages ship through the same pipeline, with SEO treated as a build-time concern rather than a plugin.",
      tradeoff: "MDX made the build heavier and the content model stricter than a CMS would have. Bought two years of uninterrupted daily updates without an editor UI to maintain.",
      outcome: "",
      stack: "JavaScript · MDX · PHP",
    },
    {
      title: "ForgeOS",
      url: "https://github.com/ReaperOAK/ForgeOS",
      problem: "Agents given a whole codebase and a vague goal produce plausible output and unreviewable diffs.",
      decision: "Split the SDLC into stage-specific agents with explicit handoffs and a ticket lifecycle, so each stage has one job and a reviewable artifact.",
      tradeoff: "Far more orchestration machinery than a single-agent loop, and every stage boundary is a place work can stall. Bought traceability from vision to diff.",
      outcome: "",
      stack: "TypeScript · Python · PostgreSQL",
    },
  ],
  roadmapTopics: [
    { name: "System design", detail: "Distributed scheduling, consensus, failure detectors", progress: 30 },
    { name: "Go", detail: "Concurrency, race detector, lease-based coordination", progress: 15 },
    { name: "Deterministic simulation testing", detail: "Virtualised clock, network and disk; reproducible from a seed", progress: 5 },
  ],
  principles: [
    "Every external dependency is optional. If a provider is down the product degrades, it does not break.",
    "A number without a method behind it is decoration. Publish the correction, not just the result.",
    "Tests describe behaviour, not implementation. A refactor that breaks the suite means the suite was wrong.",
    "Ship the smallest thing that can be measured, then measure it.",
  ],
```

The `outcome` for ForgeOS is deliberately empty — there is no honest number yet, and the renderer omits the line rather than inventing one. Fill it in when there is a real figure.

- [ ] **Step 5: Write the case studies panel**

Create `generator/src/panels/md/cases.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { CaseStudy } from "../../types.js";

function block(c: CaseStudy): string {
  const outcome = c.outcome ? `\n**Outcome** — ${c.outcome}\n` : "";
  return `<details>
<summary><b>${c.title}</b> — <code>${c.stack}</code></summary>

**Problem** — ${c.problem}

**Decision** — ${c.decision}

**Tradeoff** — ${c.tradeoff}
${outcome}
[Open ${c.title} ↗](${c.url})

</details>`;
}

export const casesPanel: MarkdownPanel<CaseStudy[]> = {
  id: "cases",
  kind: "markdown",
  select: () => (content.caseStudies.length ? content.caseStudies : null),
  render: (studies) => `<!-- section:cases -->
### Case studies

${studies.map(block).join("\n\n")}`,
};
```

- [ ] **Step 6: Write the roadmap panel**

Create `generator/src/panels/md/roadmap.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { RoadmapTopic } from "../../types.js";

/** Ten-cell text bar. Markdown, not an image, so it stays readable and copyable. */
function textBar(pct: number): string {
  const filled = Math.round(Math.min(100, Math.max(0, pct)) / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export const roadmapPanel: MarkdownPanel<RoadmapTopic[]> = {
  id: "roadmap",
  kind: "markdown",
  select: () => (content.roadmapTopics.length ? content.roadmapTopics : null),
  render: (topics, ctx) => {
    const rows = topics.map((t) =>
      `| **${t.name}** | ${t.detail} | \`${textBar(t.progress)}\` ${t.progress}% |`).join("\n");

    // Live row, derived from the submissions repo. Absent when that read failed —
    // better no row than a stale count presented as current.
    const neet = ctx.neetcode
      ? `\n| **NeetCode 150** | Pattern coverage, one directory per problem | \`${textBar((ctx.neetcode.solved / ctx.neetcode.target) * 100)}\` ${ctx.neetcode.solved} / ${ctx.neetcode.target} |`
      : "";

    return `<!-- section:roadmap -->
### Deliberate practice

| Track | What that means | Progress |
|---|---|---|
${rows}${neet}`;
  },
};
```

- [ ] **Step 7: Write the principles panel**

Create `generator/src/panels/md/how.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";

export const howPanel: MarkdownPanel<string[]> = {
  id: "how",
  kind: "markdown",
  select: () => (content.principles.length ? content.principles : null),
  render: (principles) => `<!-- section:how -->
### How I work

${principles.map((p) => `- ${p}`).join("\n")}`,
};
```

- [ ] **Step 8: Register and place**

In `generator/src/panels/index.ts` add the three imports and insert them into `PANELS` after `featuredPanel`: `casesPanel`, `roadmapPanel`, `howPanel`.

In `generator/src/render/markdown.ts`, extend the `ordered` array — cases and roadmap sit between Featured and the Engine Room; `how` goes after Numbers:

```ts
  const ordered = [
    hero(),
    byId("currently"),
    byId("telemetry"),
    byId("craft"),
    byId("arena"),
    byId("featured"),
    byId("cases"),
    byId("roadmap"),
    byId("engine-room"),
    byId("numbers"),
    byId("how"),
    byId("connect"),
    byId("coda"),
  ].filter((s): s is string => Boolean(s));
```

- [ ] **Step 9: Update the golden marker order**

In `generator/src/__tests__/markdown-golden.test.ts`:

```ts
    expect(order).toEqual([
      "hero", "currently", "telemetry", "featured", "cases", "roadmap",
      "engine-room", "numbers", "how", "connect", "coda",
    ]);
```

`craft` and `arena` are absent because `FIXTURE` has no language, waka, leetcode, neetcode or uptime data — which is exactly the null-omission rule working.

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add generator/src/content.ts generator/src/types.ts generator/src/panels generator/src/render/markdown.ts generator/src/__tests__/narrative.test.ts generator/src/__tests__/markdown-golden.test.ts
git commit -m "feat(generator): add case studies, roadmap and principles sections"
```

---

## Task 13: Engineering log, ranked Featured, real Engine Room, inert Writing

Four sections switch from static to derived. The Writing panel is written now and stays inert until `FEED_URL` is set — the day blogging starts, it is one environment variable and no code change.

**Files:**
- Create: `generator/src/data/feed.ts`, `generator/src/panels/md/log.ts`, `generator/src/panels/md/writing.ts`
- Modify: `generator/src/llm/prompts.ts`, `generator/src/types.ts`, `generator/src/panels/md/featured.ts`, `generator/src/panels/md/stack.ts`, `generator/src/panels/index.ts`, `generator/src/render/markdown.ts`, `generator/src/main.ts`
- Test: `generator/src/__tests__/feed.test.ts`, `generator/src/__tests__/derived.test.ts`

**Interfaces:**
- Consumes: `Snapshot.featured` (Task 6 via main), `Snapshot.languages` (Task 5), `Snapshot.feed`, `getDynamicFields`.
- Produces:
  - `getFeed(config, fetchImpl?): Promise<FeedItem[] | null>`
  - `DynamicFields` gains `engineeringLog: string[]`
  - `logPanel` (`<!-- section:log -->`), `writingPanel` (`<!-- section:writing -->`)
  - `featuredPanel` now prefers `ctx.featured` and falls back to `content.featured`
  - `stackPanel` prepends a real Languages row built from `ctx.languages`

- [ ] **Step 1: Extend DynamicFields**

In `generator/src/types.ts`, add to `DynamicFields`:

```ts
  /** Three to five lines summarising what actually shipped. Empty array = section omitted. */
  engineeringLog: string[];
```

And in `generator/src/content.ts`, add to `fallback`:

```ts
    engineeringLog: [],
```

An empty fallback is deliberate: with no LLM and no cache, an invented changelog would be worse than no section.

- [ ] **Step 2: Write the failing feed test**

Create `generator/src/__tests__/feed.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { getFeed, parseFeed } from "../data/feed.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null, wakatimeKey: null,
  leetcodeHandle: null, uptimeTargets: [], feedUrl: "https://blog.example/rss.xml",
};

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title>Honest backtests</title><link>https://blog.example/a</link><pubDate>Sat, 06 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>Lease renewal races</title><link>https://blog.example/b</link><pubDate>Fri, 05 Sep 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed>
<entry><title>Atom post</title><link href="https://blog.example/c"/><updated>2026-09-06T10:00:00Z</updated></entry>
</feed>`;

describe("parseFeed", () => {
  it("reads RSS items", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Honest backtests", url: "https://blog.example/a" });
  });

  it("reads Atom entries with href links", () => {
    expect(parseFeed(ATOM)[0]).toMatchObject({ title: "Atom post", url: "https://blog.example/c" });
  });

  it("returns an empty list for junk rather than throwing", () => {
    expect(parseFeed("not xml at all")).toEqual([]);
  });
});

describe("getFeed", () => {
  it("returns null when FEED_URL is unset — the panel then omits itself", async () => {
    expect(await getFeed({ ...cfg, feedUrl: null })).toBeNull();
  });

  it("returns parsed items when the feed responds", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(RSS, { status: 200 }));
    expect((await getFeed(cfg, fake as unknown as typeof fetch))!).toHaveLength(2);
  });

  it("returns null on a failed fetch", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the feed is empty", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("<rss><channel></channel></rss>", { status: 200 }));
    expect(await getFeed(cfg, fake as unknown as typeof fetch)).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/__tests__/feed.test.ts`
Expected: FAIL — `Failed to resolve import "../data/feed.js"`

- [ ] **Step 4: Write the feed adapter**

Create `generator/src/data/feed.ts`:

```ts
import type { Config } from "../config.js";
import type { FeedItem } from "../types.js";
import { readCache, writeCache } from "../cache.js";

const CACHE_KEY = "feed-items";
const MAX_ITEMS = 4;

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

/** Regex parsing is deliberate — no XML dependency for four titles and four links. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items: FeedItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const url = tag(b, "link") || /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] || null;
    const date = tag(b, "pubDate") ?? tag(b, "updated") ?? tag(b, "published") ?? "";
    if (title && url) items.push({ title, url, date });
  }
  return items.slice(0, MAX_ITEMS);
}

/** Inert until FEED_URL is set. Returns null so the Writing panel omits itself. */
export async function getFeed(
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<FeedItem[] | null> {
  if (!config.feedUrl) return null;
  try {
    const res = await fetchImpl(config.feedUrl, {
      headers: { "user-agent": "reaperoak-readme-generator" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`feed ${res.status}`);
    const items = parseFeed(await res.text());
    if (items.length === 0) return null;
    writeCache(CACHE_KEY, items);
    return items;
  } catch {
    return readCache<FeedItem[]>(CACHE_KEY);
  }
}
```

- [ ] **Step 5: Run the feed test**

Run: `npx vitest run src/__tests__/feed.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Write the failing derived-sections test**

Create `generator/src/__tests__/derived.test.ts`:

```ts
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
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/__tests__/derived.test.ts`
Expected: FAIL — `logPanel` and `writingPanel` do not exist.

- [ ] **Step 8: Rewrite the featured panel**

Replace the whole of `generator/src/panels/md/featured.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { RankedRepo } from "../../types.js";

/** Ranked repos when GitHub answered; the curated static list otherwise. */
function fromStatic(ctx: { fields: { featuredBlurbs: Record<string, string> } }): RankedRepo[] {
  return content.featured.map((f) => ({
    name: f.title,
    url: f.url,
    description: ctx.fields.featuredBlurbs[f.title] ?? f.problem,
    stack: f.stack,
    score: 0,
  }));
}

export const featuredPanel: MarkdownPanel<RankedRepo[]> = {
  id: "featured",
  kind: "markdown",
  select: (ctx) => {
    if (ctx.featured && ctx.featured.length) return ctx.featured;
    return content.featured.length ? fromStatic(ctx) : null;
  },
  render: (repos, ctx) => {
    const rows = repos.map((r) => {
      const blurb = ctx.fields.featuredBlurbs[r.name] ?? r.description;
      return `| **[${r.name}](${r.url})** | ${blurb} | \`${r.stack}\` |`;
    }).join("\n");
    return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
  },
};
```

- [ ] **Step 9: Rewrite the stack panel**

Replace the whole of `generator/src/panels/md/stack.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { StatGroup } from "../../types.js";

export const stackPanel: MarkdownPanel<StatGroup[]> = {
  id: "engine-room",
  kind: "markdown",
  select: (ctx) => {
    // Measured mix replaces the hand-written Languages row; every other row is curated.
    const rest = content.stackGroups.filter((g) => g.heading !== "Languages");
    if (ctx.languages && ctx.languages.length) {
      const measured: StatGroup = {
        heading: "Languages · measured",
        items: ctx.languages.map((l) => `${l.name} ${Math.round(l.pct)}%`),
      };
      return [measured, ...rest];
    }
    return content.stackGroups.length ? content.stackGroups : null;
  },
  render: (groups) => `<!-- section:engine-room -->
### The Engine Room

${groups.map((g) => `- **${g.heading}** — ${g.items.join(" · ")}`).join("\n")}`,
};
```

- [ ] **Step 10: Write the log and writing panels**

Create `generator/src/panels/md/log.ts`:

```ts
import type { MarkdownPanel } from "../types.js";

export const logPanel: MarkdownPanel<string[]> = {
  id: "log",
  kind: "markdown",
  // No LLM, no cache, no log. An invented changelog is worse than no section.
  select: (ctx) => (ctx.fields.engineeringLog.length ? ctx.fields.engineeringLog : null),
  render: (lines) => `<!-- section:log -->
### Engineering log

${lines.map((l) => `- ${l}`).join("\n")}`,
};
```

Create `generator/src/panels/md/writing.ts`:

```ts
import type { MarkdownPanel } from "../types.js";
import type { FeedItem } from "../../types.js";

/** Inert until FEED_URL is configured. Links stay markdown so they are clickable and indexed. */
export const writingPanel: MarkdownPanel<FeedItem[]> = {
  id: "writing",
  kind: "markdown",
  select: (ctx) => (ctx.feed && ctx.feed.length ? ctx.feed : null),
  render: (items) => `<!-- section:writing -->
### Writing

${items.map((i) => `- [${i.title}](${i.url})${i.date ? ` — <sub>${i.date}</sub>` : ""}`).join("\n")}`,
};
```

- [ ] **Step 11: Generate the log from real commits**

In `generator/src/llm/prompts.ts`, add a bullet-list generator. Insert this helper above `getDynamicFields`:

```ts
/** Splits an LLM reply into clean bullets. Returns [] if the reply is unusable. */
export function sanitizeBullets(raw: string | null, max: number, maxLen: number): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 0 && l.length <= maxLen && !l.includes("```"))
    .filter((l) => !BANNED.some((re) => re.test(l)))
    .slice(0, max);
}
```

Inside `getDynamicFields`, add the log after `thinkingAbout` and before `featuredBlurbs`:

```ts
  const logRaw = await (async () => {
    for (const model of models) {
      const out = await chat({
        baseUrl, key, model, fetchImpl,
        system: VOICE,
        user: `From these commit messages, write 3 to 5 bullet lines describing what shipped. `
          + `One clause each, past tense, no bullets characters, no preamble: ${commits}`,
      });
      const bullets = sanitizeBullets(out, 5, 120);
      if (bullets.length >= 3) return bullets;
    }
    return cached?.engineeringLog ?? fb.engineeringLog;
  })();
```

and add `engineeringLog: logRaw,` to the `result` object.

- [ ] **Step 12: Register, place and wire**

In `generator/src/panels/index.ts`, add `logPanel` and `writingPanel` imports and place them in `PANELS`.

In `generator/src/render/markdown.ts`, insert `byId("log")` after `byId("featured")` and `byId("writing")` after `byId("how")`.

In `generator/src/main.ts`, add `getFeed(config)` to the `Promise.all` array, destructure `feed`, and set `feed,` in the `ctx` literal. Add `import { getFeed } from "./data/feed.js";`.

- [ ] **Step 13: Update the golden marker order**

In `generator/src/__tests__/markdown-golden.test.ts`:

```ts
    expect(order).toEqual([
      "hero", "currently", "telemetry", "featured", "cases", "roadmap",
      "engine-room", "numbers", "how", "connect", "coda",
    ]);
```

`log` and `writing` are absent from `FIXTURE` — the log is empty and there is no feed. Add a test proving the log appears when it has content:

```ts
  it("inserts the engineering log directly after Featured when it has entries", () => {
    const md = renderReadme({ ...FIXTURE,
      fields: { ...FIXTURE.fields, engineeringLog: ["Shipped the telemetry canvas"] } });
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order[order.indexOf("featured") + 1]).toBe("log");
  });
```

- [ ] **Step 14: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 15: Commit**

```bash
git add generator/src/data/feed.ts generator/src/panels generator/src/llm/prompts.ts generator/src/types.ts generator/src/content.ts generator/src/render/markdown.ts generator/src/main.ts generator/src/__tests__
git commit -m "feat(generator): derive featured, engine room, log and writing from live data"
```

---

## Task 14: Sync stamp and hardened validation

The hero gains a sync stamp that reports when the *data* was fetched, not when the job ran — so a cache-served build cannot claim to be fresh. Validation gains the checks that stop a malformed page reaching GitHub.

**Files:**
- Modify: `generator/src/render/svg-hero.ts`, `generator/src/assemble.ts`
- Test: `generator/src/__tests__/svg-hero.test.ts`, `generator/src/__tests__/assemble.test.ts`

**Interfaces:**
- Consumes: `Snapshot.syncedAt` (Task 1), `Snapshot.github.fetchedAt` (Task 4).
- Produces: `renderHeroSvg(theme, tagline, syncedAt)` — third parameter added; `formatSyncStamp(iso: string): string`; `validateReadme` unchanged in signature, stricter in behaviour.

- [ ] **Step 1: Write the failing hero test**

Replace the contents of `generator/src/__tests__/svg-hero.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHeroSvg, formatSyncStamp } from "../render/svg-hero.js";

describe("formatSyncStamp", () => {
  it("renders an IST date and time", () => {
    expect(formatSyncStamp("2026-09-06T13:44:00.000Z")).toBe("06 Sep 2026 · 19:14 IST");
  });

  it("returns an em dash for an unparseable timestamp rather than 'Invalid Date'", () => {
    expect(formatSyncStamp("not a date")).toBe("—");
  });
});

describe("renderHeroSvg", () => {
  const svg = renderHeroSvg("dark", "ships production AI systems", "2026-09-06T13:44:00.000Z");

  it("is a single svg root", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
  });

  it("shows the sync stamp", () => {
    expect(svg).toContain("06 Sep 2026 · 19:14 IST");
  });

  it("escapes a tagline containing markup characters", () => {
    expect(renderHeroSvg("dark", 'a < b & "c"', "2026-09-06T13:44:00.000Z")).toContain("a &lt; b &amp;");
  });

  it("renders light and dark differently", () => {
    expect(renderHeroSvg("light", "t", "2026-09-06T13:44:00.000Z")).not.toBe(svg);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/svg-hero.test.ts`
Expected: FAIL — `formatSyncStamp` is not exported and `renderHeroSvg` takes two arguments.

- [ ] **Step 3: Add the stamp to the hero**

In `generator/src/render/svg-hero.ts`, add the helper above `renderHeroSvg`:

```ts
/** "06 Sep 2026 · 19:14 IST". Returns an em dash rather than printing "Invalid Date". */
export function formatSyncStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year} · ${p.hour}:${p.minute} IST`;
}
```

Change the signature and add the stamp line. Replace the function declaration:

```ts
export function renderHeroSvg(theme: "dark" | "light", tagline: string, syncedAt: string): string {
```

and insert this immediately before the closing `</svg>` of the returned template, replacing the existing `<line .../>` element:

```ts
<line x1="${W / 2 - 120}" y1="238" x2="${W / 2 + 120}" y2="238" stroke="${t.accent}" stroke-opacity="0.35"/>
<circle cx="${W / 2 - 96}" cy="${H - 14}" r="3.5" fill="${t.accent}"/>
<text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" letter-spacing="1" fill="${t.mut}">SYNCED ${escapeXml(formatSyncStamp(syncedAt))}</text>
```

Raise the canvas height so the stamp has room — change `const W = 900, H = 260;` to `const W = 900, H = 288;`.

- [ ] **Step 4: Pass the stamp through assemble**

In `generator/src/assemble.ts`, update both hero calls:

```ts
    "hero-dark.svg": renderHeroSvg("dark", ctx.fields.tagline, ctx.syncedAt),
    "hero-light.svg": renderHeroSvg("light", ctx.fields.tagline, ctx.syncedAt),
```

`main.ts` already sets `syncedAt: github.fetchedAt`, and `getGithubSnapshot` returns the *cached* `fetchedAt` when it falls back to cache — so a cache-served build stamps the original fetch time. That is the whole mechanism; no extra code.

- [ ] **Step 5: Run the hero test**

Run: `npx vitest run src/__tests__/svg-hero.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing validation tests**

Append to `generator/src/__tests__/assemble.test.ts`:

```ts
import { validateReadme } from "../assemble.js";

describe("validateReadme", () => {
  const good = [
    "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
    "<!-- section:engine-room -->", "<!-- section:numbers -->",
    "<!-- section:connect -->", "<!-- section:coda -->",
  ].join("\n") + "\n" + "x".repeat(500);

  it("accepts a complete page", () => {
    expect(validateReadme(good)).toEqual({ ok: true });
  });

  it("rejects a page that is too short", () => {
    expect(validateReadme("<!-- section:hero -->")).toMatchObject({ ok: false });
  });

  it("rejects a page missing a required marker", () => {
    expect(validateReadme(good.replace("<!-- section:coda -->", ""))).toMatchObject({
      ok: false, reason: expect.stringContaining("coda"),
    });
  });

  it("rejects an unresolved template token", () => {
    expect(validateReadme(`${good}\n{{tagline}}`)).toMatchObject({ ok: false });
  });

  it("rejects a leaked NaN", () => {
    expect(validateReadme(`${good}\nstreak: NaN days`)).toMatchObject({
      ok: false, reason: expect.stringContaining("NaN"),
    });
  });

  it("rejects a leaked undefined", () => {
    expect(validateReadme(`${good}\nlanguage: undefined`)).toMatchObject({ ok: false });
  });

  it("rejects a leaked Infinity", () => {
    expect(validateReadme(`${good}\nscore: Infinity`)).toMatchObject({ ok: false });
  });

  it("rejects a leaked [object Object]", () => {
    expect(validateReadme(`${good}\n[object Object]`)).toMatchObject({ ok: false });
  });

  it("does not reject the word undefined inside a normal sentence", () => {
    expect(validateReadme(`${good}\nBehaviour here is well defined.`)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/__tests__/assemble.test.ts`
Expected: FAIL — the NaN, undefined, Infinity and `[object Object]` cases pass validation today.

- [ ] **Step 8: Harden the validator**

In `generator/src/assemble.ts`, replace `validateReadme`:

```ts
const MIN_BYTES = 400;

/** Values that mean a renderer produced garbage. Word-bounded so ordinary prose survives. */
const LEAKS: Array<[RegExp, string]> = [
  [/\bNaN\b/, "NaN"],
  [/\bundefined\b/, "undefined"],
  [/\bInfinity\b/, "Infinity"],
  [/\[object Object\]/, "[object Object]"],
  [/\{\{/, "unresolved token"],
];

export function validateReadme(md: string): { ok: true } | { ok: false; reason: string } {
  if (Buffer.byteLength(md, "utf8") < MIN_BYTES) return { ok: false, reason: "too short" };
  for (const m of SECTION_MARKERS) if (!md.includes(m)) return { ok: false, reason: `missing ${m}` };
  for (const [re, name] of LEAKS) if (re.test(md)) return { ok: false, reason: `leaked ${name}` };
  return { ok: true };
}
```

`\bundefined\b` matches the bare word but not "well defined", which the last test pins.

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add generator/src/render/svg-hero.ts generator/src/assemble.ts generator/src/__tests__/svg-hero.test.ts generator/src/__tests__/assemble.test.ts
git commit -m "feat(generator): stamp data freshness and harden readme validation"
```

---

## Task 15: Rename the LLM client to a gateway

Task 8 already made the base URL configurable. This finishes the job: the file stops being named after one provider.

**Files:**
- Rename: `generator/src/llm/openrouter.ts` → `generator/src/llm/gateway.ts`
- Modify: `generator/src/llm/prompts.ts`
- Test: `generator/src/__tests__/gateway.test.ts`

**Interfaces:**
- Produces: `chat(args: ChatArgs): Promise<string | null>` where `ChatArgs` is `{ baseUrl, key, model, system, user, fetchImpl? }`. Behaviour unchanged: never throws, returns `null` on any failure.

- [ ] **Step 1: Move the file**

```bash
git mv generator/src/llm/openrouter.ts generator/src/llm/gateway.ts
```

Update the import in `generator/src/llm/prompts.ts`:

```ts
import { chat } from "./gateway.js";
```

- [ ] **Step 2: Write the gateway test**

Create `generator/src/__tests__/gateway.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { chat } from "../llm/gateway.js";

const args = { baseUrl: "http://127.0.0.1:20128/v1", key: "k", model: "m", system: "s", user: "u" };
const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "content-type": "application/json" } });

describe("chat", () => {
  it("posts to the configured base url", async () => {
    const fake = vi.fn().mockResolvedValue(ok("hello"));
    await chat({ ...args, fetchImpl: fake as unknown as typeof fetch });
    expect(String(fake.mock.calls[0]![0])).toBe("http://127.0.0.1:20128/v1/chat/completions");
  });

  it("returns the trimmed reply", async () => {
    const fake = vi.fn().mockResolvedValue(ok("  hello  "));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBe("hello");
  });

  it("returns null on a non-200 response", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("no", { status: 429 }));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBeNull();
  });

  it("never throws when the gateway is unreachable", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBeNull();
  });

  it("returns null when the response has no message content", async () => {
    const fake = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBeNull();
  });

  it("sends the key as a bearer token", async () => {
    const fake = vi.fn().mockResolvedValue(ok("x"));
    await chat({ ...args, fetchImpl: fake as unknown as typeof fetch });
    expect((fake.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      authorization: "Bearer k",
    });
  });
});
```

- [ ] **Step 3: Run the gateway test**

Run: `npx vitest run src/__tests__/gateway.test.ts`
Expected: PASS, 6 tests. The implementation already satisfies these after Task 8 step 4; if any fail, the base-URL change from that step was not applied.

- [ ] **Step 4: Confirm no stale references**

```bash
grep -rn "openrouter.js\|OPENROUTER_MODEL\b" generator/src
```

Expected: no hits in `src/` outside `config.ts`, where `OPENROUTER_API_KEY` and `OPENROUTER_MODELS` remain valid fallback inputs.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add generator/src/llm generator/src/__tests__/gateway.test.ts
git commit -m "refactor(generator): rename the llm client to a provider-neutral gateway"
```

---

## Task 16: Self-hosted runner and workflow

OmniRoute listens on `0.0.0.0:20128` on the OCI box, but that host's firewall accepts only port 22:

```
-A INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT
-A INPUT -j REJECT --reject-with icmp-host-prohibited
```

A GitHub-hosted runner therefore cannot reach it. A self-hosted runner solves this without opening any inbound port — the runner polls outbound and reaches OmniRoute over `127.0.0.1:20128`. `GITHUB_TOKEN` is still auto-provisioned, so no personal access token is involved.

**Files:**
- Modify: `.github/workflows/readme.yml`

**Interfaces:**
- Consumes: every environment variable defined in `config.ts` (Task 8).

### Security gate — do this before registering the runner

A self-hosted runner attached to a **public** repository will execute code from fork pull requests. Without the setting below, anyone who opens a PR against `ReaperOAK/ReaperOAK` can run arbitrary commands on the OCI box — the same box that holds the bounty-tracker crons and OmniRoute's provider keys.

- [ ] **Step 1: Require approval for fork PR workflows**

In the browser: `github.com/ReaperOAK/ReaperOAK` → **Settings** → **Actions** → **General** → **Fork pull request workflows from outside collaborators** → select **Require approval for all outside collaborators** → **Save**.

Verify from the CLI:

```bash
gh api repos/ReaperOAK/ReaperOAK/actions/permissions/workflow
```

Confirm the response before continuing. Do not register the runner until this is set.

- [ ] **Step 2: Add the repository secrets**

```bash
gh secret set WAKATIME_API_KEY --repo ReaperOAK/ReaperOAK
gh secret set LLM_API_KEY --repo ReaperOAK/ReaperOAK
```

Each command prompts for the value on stdin, so nothing is written to shell history.

**Rotate the WakaTime key first.** The current key was shared in plaintext during design and should be treated as burned: wakatime.com → Settings → API Key → Reset, then paste the *new* key at the prompt above.

`OPENROUTER_API_KEY` already exists and stays as the LLM fallback.

- [ ] **Step 3: Register the runner on the OCI box**

```bash
ssh openclaw
```

Then, on that host — take the download URL and token from `github.com/ReaperOAK/ReaperOAK` → Settings → Actions → Runners → New self-hosted runner (Linux x64):

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L <URL from the runner setup page>
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/ReaperOAK/ReaperOAK --token <TOKEN from that page> --labels oci --unattended
sudo ./svc.sh install && sudo ./svc.sh start
sudo ./svc.sh status
```

Expected: the service reports `active (running)`, and the runner shows **Idle** in the repo's Runners list.

- [ ] **Step 4: Confirm OmniRoute is reachable from the runner's own host**

Still on the OCI box:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128/v1/models
```

Expected: `200` (or `401` if `REQUIRE_API_KEY` is on — either proves it is listening). A connection refused here means OmniRoute is not running; start it before continuing.

- [ ] **Step 5: Rewrite the workflow**

Replace the whole of `.github/workflows/readme.yml`:

```yaml
name: Generate README
on:
  schedule:
    - cron: "0 1 * * *"   # ~06:30 IST daily
  push:
    branches: [main]
    paths: ["generator/**", ".github/workflows/readme.yml"]
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: readme
  cancel-in-progress: true
jobs:
  build:
    # Self-hosted so the job can reach OmniRoute on 127.0.0.1:20128 without
    # exposing port 20128 to the internet. Requires fork-PR approval to be enabled.
    runs-on: [self-hosted, oci]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - name: Install
        working-directory: generator
        run: npm ci || npm install
      - name: Test
        working-directory: generator
        run: npm test
      - name: Typecheck
        working-directory: generator
        run: npm run typecheck
      - name: Generate
        working-directory: generator
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_LOGIN: ReaperOAK
          LLM_BASE_URL: http://127.0.0.1:20128/v1
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          WAKATIME_API_KEY: ${{ secrets.WAKATIME_API_KEY }}
          LEETCODE_HANDLE: oaak78692
          UPTIME_TARGETS: "todayeggrates=https://todayeggrates.com/,portfolio=https://reaperoak.web.app/"
        run: npm run build
      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add README.md assets/ generator/.cache/ || true
          if git diff --cached --quiet; then
            echo "No changes."
          else
            git commit -m "chore: refresh profile README [skip ci]"
            git push
          fi
```

`FEED_URL` is deliberately absent — that is what keeps the Writing section inert. Add it here the day blogging starts; no code change is needed.

- [ ] **Step 6: Trigger a run and watch it**

```bash
git add .github/workflows/readme.yml
git commit -m "ci: run the readme generator on the self-hosted oci runner"
git push
gh workflow run "Generate README" --repo ReaperOAK/ReaperOAK
gh run watch --repo ReaperOAK/ReaperOAK
```

Expected: the job picks up on the `oci` runner and every step is green.

- [ ] **Step 7: Verify the generated page**

```bash
git pull --rebase
grep -o '<!-- section:[a-z-]* -->' README.md
ls -la assets/
```

Expected sections, in order: `hero`, `currently`, `telemetry`, `craft`, `arena`, `featured`, `log`, `cases`, `roadmap`, `engine-room`, `numbers`, `how`, `connect`, `coda`.
Expected assets: `hero-{dark,light}.svg`, `telemetry-{dark,light}.svg`, `craft-{dark,light}.svg`, `arena-{dark,light}.svg`. No `stats-*.svg`.

A missing `craft` means WakaTime returned nothing *and* no repo had languages. A missing `arena` means all three of LeetCode, NeetCode and uptime failed. Both are the null-omission rule working correctly — check the run log before treating either as a bug.

- [ ] **Step 8: Verify both themes render on GitHub**

Open `github.com/ReaperOAK` in the browser, then toggle GitHub's appearance setting between Light and Dark. Both variants of all four canvases must be legible, with no black-on-black text and no missing font.

- [ ] **Step 9: Commit any fixes**

```bash
git add assets README.md
git commit -m "chore: refresh profile README [skip ci]"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Panel registry, `select() → null` omission | 1 |
| Composite SVG canvases | 3 |
| Images carry shape, markdown carries meaning | 3 (split rule), 12, 13 (links stay markdown) |
| Expanded GitHub query — calendar, counters, repos, languages | 4 |
| Language mix per-repo normalisation | 5 |
| Featured ranking with pins and blocks | 6 |
| Telemetry canvas — heatmap + counters | 7 |
| Craft canvas — language mix + WakaTime | 8, 9 |
| NeetCode live progress | 10, 12 |
| LeetCode adapter | 10 |
| Uptime / system status | 11 |
| Arena canvas | 11 |
| Case studies ×5 | 12 |
| Roadmap — NeetCode live, system design config-driven | 12 |
| How I work | 12 |
| Engineering log from real commits | 13 |
| Blog feed built but inert | 13 |
| Sync stamp never lies | 14 |
| Hardened validation, README untouched on failure | 14 |
| OmniRoute primary, OpenRouter fallback | 8 (config), 15 (rename) |
| Self-hosted OCI runner + fork-PR hardening | 16 |
| Delete superseded `stats-*` assets | 7 |

Coverage gap found and fixed inline: Task 12 originally carried four case studies against the spec's five. Creator Marketplace has been added to Task 12 step 4, between GenAI Media Platform and todayeggrates. `casesPanel` counts blocks against `content.caseStudies.length`, so its test needs no change.

**Placeholder scan.** No `TBD` or `implement later`. Two empty `outcome` strings are intentional data, covered by a test asserting the line is omitted rather than faked.

**Type consistency.** `Snapshot` field names (`languages`, `featured`, `waka`, `leetcode`, `neetcode`, `uptime`, `feed`, `syncedAt`, `fields`, `github`) are identical across Tasks 1, 7–14. Panel ids used in `composeCanvas` calls (`heatmap`, `signal`, `languages`, `waka`, `leetcode`, `roadmap-gauge`, `status`) match the `id` fields declared in each panel file. `Config` drops `wakatimeEnabled`/`openRouter` and gains `wakatimeKey`/`llm` in Task 8, with the repair of every existing `Config` literal called out as an explicit step.

**Known ordering constraint.** Tasks 1 → 2 → 3 must run in order; the rest depend on 1–3 but Tasks 5, 6, 10 and 11's adapters are independent of each other and could be built in any order.
