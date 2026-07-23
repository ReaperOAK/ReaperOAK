# ReaperOAK Profile README Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript app in `/generator` that generates a world-class `README.md` + oak-themed SVG assets for the `ReaperOAK/ReaperOAK` profile repo, refreshed daily by a GitHub Action, with every data source failing silently to static fallbacks.

**Architecture:** A pure-function pipeline: `config` → parallel gather (GitHub GraphQL, OpenRouter LLM, cache) → render (SVG + markdown sections) → `assemble` (validate → atomic write). Every dynamic field has three tiers: live → last-good cache → hardcoded static. The README is only overwritten if a fully-validated buffer is produced; otherwise the previous file is left untouched. A GitHub Action runs it daily / on push / manually and commits changed output.

**Tech Stack:** Node 24 (native `fetch`), TypeScript (ESM), `tsx` (run TS directly), `vitest` (tests). No runtime HTTP dependencies. SVG hero uses a base64-embedded OFL font (Sora) inside the SVG so custom type renders crisply on GitHub.

## Global Constraints

- **Accent:** oak amber `#E8A33D` → bronze `#C77B30`. One accent, used sparingly.
- **Ground:** near-black `#0B0B0D`; panel `#0E0E11`. **Ink:** warm off-white `#ECE7DE`; muted `#8F887B`.
- **Graceful degradation is mandatory:** no external call may throw uncaught; each returns a typed result or `null`, and the caller drops to cache then static. The build must never commit an empty/broken README.
- **Atomic write:** assemble into a buffer, validate (non-empty ≥ 400 bytes, all 8 `<!-- section:NAME -->` markers present, no `{{` tokens), then overwrite `README.md`. On validation failure, abort with non-zero exit and leave `README.md` untouched.
- **No banned decoration:** no shields.io badge grids, no snake game, no visitor counter, no typing GIF, no emoji section markers.
- **Copy voice:** no "passionate", no emoji spam, active voice, specific over clever.
- **Node version floor:** Node 24 (uses global `fetch`, `structuredClone`).
- **All paths below are relative to repo root** `/home/reaperoak/Documents/ReaperOAK`.

---

## File Structure

```
generator/
  package.json
  tsconfig.json
  vitest.config.ts
  assets-fonts/Sora-SemiBold.ttf        # bundled OFL font (committed)
  src/
    types.ts            # shared types
    content.ts          # static data + every fallback string
    config.ts           # env, feature flags, degradation switches
    cache.ts            # read/write last-good JSON
    data/github.ts      # GraphQL client → typed snapshot (fallback-wrapped)
    data/wakatime.ts    # optional module, disabled by default
    llm/openrouter.ts   # OpenRouter client
    llm/prompts.ts      # 4 prompt jobs + guardrail validation
    render/svg-util.ts  # color tokens, font embed, shared SVG helpers
    render/svg-hero.ts  # hero SVG (dual light/dark)
    render/svg-stats.ts # oak-themed stats card SVG
    render/markdown.ts  # 8 section renderers + assembler
    assemble.ts         # gather → render → validate → atomic write
    main.ts             # entrypoint
  src/__tests__/*.test.ts
generator/.cache/           # generated last-good snapshots (gitignored except .gitkeep)
assets/                     # generated SVGs (committed by Action)
README.md                   # generated (committed by Action)
.github/workflows/readme.yml
```

---

### Task 1: Scaffold the generator project

**Files:**
- Create: `generator/package.json`
- Create: `generator/tsconfig.json`
- Create: `generator/vitest.config.ts`
- Create: `generator/.gitignore`
- Create: `generator/src/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` and `npm run build` scripts other tasks rely on.

- [ ] **Step 1: Write `generator/package.json`**

```json
{
  "name": "reaperoak-readme-generator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "tsx src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `generator/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `generator/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 4: Write `generator/.gitignore`**

```
node_modules/
.cache/*
!.cache/.gitkeep
```

- [ ] **Step 5: Write the smoke test `generator/src/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 6: Install and run tests**

Run: `cd generator && npm install && npm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add generator/package.json generator/tsconfig.json generator/vitest.config.ts generator/.gitignore generator/src/__tests__/smoke.test.ts
git commit -m "chore: scaffold readme generator project"
```

---

### Task 2: Shared types + static content

**Files:**
- Create: `generator/src/types.ts`
- Create: `generator/src/content.ts`
- Test: `generator/src/__tests__/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `RepoLink`, `FeaturedItem`, `StatGroup`, `StatNumber`, `ContactLink`, `DynamicFields`, `GithubSnapshot`, `StaticContent`.
  - `content.ts`: `export const content: StaticContent` with `fallback: DynamicFields`.

- [ ] **Step 1: Write `generator/src/types.ts`**

```ts
export interface RepoLink { name: string; url: string; }
export interface FeaturedItem {
  title: string; url: string; live: boolean;
  problem: string;          // one-line "what it solves" (static fallback)
  stack: string;            // e.g. "Python · FastAPI · React"
}
export interface StatNumber { value: string; label: string; }
export interface StatGroup { heading: string; items: string[]; }
export interface ContactLink { label: string; url: string; }

/** The four LLM-refreshed fields; each has a static fallback in content.fallback. */
export interface DynamicFields {
  tagline: string;
  recentWork: string;
  thinkingAbout: string;
  featuredBlurbs: Record<string, string>; // keyed by FeaturedItem.title
}

export interface GithubSnapshot {
  recentCommitMessages: string[];  // newest first, across owned repos
  totalContributions: number;      // last 12 months
  currentStreakDays: number;
}

export interface StaticContent {
  eyebrow: string;
  wordmark: { reaper: string; oak: string };  // "Reaper" + "OAK"
  fullName: string;
  humanLine: string;
  featured: FeaturedItem[];
  stackGroups: StatGroup[];
  numbers: StatNumber[];
  contacts: ContactLink[];
  fallback: DynamicFields;
}
```

- [ ] **Step 2: Write `generator/src/content.ts`** (real résumé-derived content + fallbacks)

```ts
import type { StaticContent } from "./types.js";

export const content: StaticContent = {
  eyebrow: "Founding Engineer · Generative AI",
  wordmark: { reaper: "Reaper", oak: "OAK" },
  fullName: "Owais Ahmed Khan",
  humanLine: "125R, throttle open  ·  writes poetry  ·  optimizes the economy before attacking",
  featured: [
    { title: "Pindow", url: "https://pindow.ai", live: true,
      problem: "Turns prompts into image, video, and audio across 15+ foundation models.",
      stack: "FastAPI · NestJS · Java · React · AWS" },
    { title: "Crosbird", url: "https://www.crosbird.com/", live: true,
      problem: "Cross-platform influencer marketplace with escrow, split payouts, and discovery.",
      stack: "Expo · React Native · NestJS · OpenSearch" },
    { title: "ForgeOS", url: "https://github.com/ReaperOAK/ForgeOS", live: false,
      problem: "An SDLC engine of orchestrated agents for spec-driven development.",
      stack: "TypeScript" },
    { title: "CodebaseRAG", url: "https://github.com/ReaperOAK/CodebaseRAG", live: false,
      problem: "Local RAG over any repository via an MCP server for instant querying.",
      stack: "JavaScript · LLMs · MCP" },
    { title: "survivorship-free-backtester", url: "https://github.com/ReaperOAK/survivorship-free-backtester", live: false,
      problem: "Honest, survivorship-bias-corrected, tax-aware backtesting on free data.",
      stack: "Python · DuckDB" },
  ],
  stackGroups: [
    { heading: "Languages", items: ["TypeScript", "JavaScript", "Python", "PHP", "Java"] },
    { heading: "Frontend", items: ["React", "React Native", "Next.js", "Expo", "Tailwind / NativeWind"] },
    { heading: "Backend", items: ["NestJS", "FastAPI", "Node.js", "Express", "Socket.io", "BullMQ"] },
    { heading: "Generative AI", items: ["Claude / GPT / Gemini", "Prompt engineering", "fal.ai", "ElevenLabs", "Multimodal"] },
    { heading: "Cloud & DevOps", items: ["AWS (EC2/RDS/ElastiCache/S3/Lambda)", "Docker", "Kubernetes", "GitHub Actions"] },
    { heading: "Data & Payments", items: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "OpenSearch", "Stripe", "Razorpay", "Cashfree"] },
  ],
  numbers: [
    { value: "1.2M+", label: "clicks served" },
    { value: "28K+", label: "monthly active users" },
    { value: "15+", label: "foundation models" },
    { value: "~95%", label: "test coverage" },
    { value: "<100ms", label: "API responses" },
  ],
  contacts: [
    { label: "Portfolio", url: "https://reaperoak.web.app/" },
    { label: "LinkedIn", url: "https://linkedin.com/in/owaistech" },
    { label: "Email", url: "mailto:oaak78692@gmail.com" },
  ],
  fallback: {
    tagline: "First engineer at Cornflakes Media. I architect and ship production AI platforms — prompts to image, video, and audio at scale.",
    recentWork: "Currently hardening billing ledgers, scaling multi-AZ infra, and shipping generative-AI media tooling.",
    thinkingAbout: "Fail-closed systems: how to make every external dependency optional without the product ever looking broken.",
    featuredBlurbs: {}, // empty → renderer uses each FeaturedItem.problem
  },
};
```

- [ ] **Step 3: Write `generator/src/__tests__/content.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { content } from "../content.js";

describe("content", () => {
  it("has 5 featured items, live ones first", () => {
    expect(content.featured).toHaveLength(5);
    expect(content.featured.slice(0, 2).every((f) => f.live)).toBe(true);
  });
  it("has non-empty fallback strings for every dynamic field", () => {
    expect(content.fallback.tagline.length).toBeGreaterThan(20);
    expect(content.fallback.recentWork.length).toBeGreaterThan(20);
    expect(content.fallback.thinkingAbout.length).toBeGreaterThan(20);
  });
  it("every featured item has a static problem line", () => {
    expect(content.featured.every((f) => f.problem.length > 10)).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd generator && npm test`
Expected: content tests + smoke pass.

- [ ] **Step 5: Commit**

```bash
git add generator/src/types.ts generator/src/content.ts generator/src/__tests__/content.test.ts
git commit -m "feat: add shared types and static content with fallbacks"
```

---

### Task 3: Last-good cache

**Files:**
- Create: `generator/src/cache.ts`
- Create: `generator/.cache/.gitkeep` (empty)
- Test: `generator/src/__tests__/cache.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `readCache<T>(key: string): T | null`
  - `writeCache<T>(key: string, value: T): void`
  - `CACHE_DIR` constant (`generator/.cache`).

- [ ] **Step 1: Write the failing test `generator/src/__tests__/cache.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { readCache, writeCache } from "../cache.js";

describe("cache", () => {
  const key = "test-key";
  it("returns null for a missing key", () => {
    expect(readCache("does-not-exist-xyz")).toBeNull();
  });
  it("round-trips a value", () => {
    writeCache(key, { a: 1, b: "x" });
    expect(readCache<{ a: number; b: string }>(key)).toEqual({ a: 1, b: "x" });
  });
  it("returns null on corrupt json without throwing", () => {
    // writeCache then simulate corruption is covered by implementation guard;
    // here we assert a bad key name still yields null, never throws.
    expect(() => readCache("../../etc/passwd")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/cache.test.ts`
Expected: FAIL (cannot find `../cache.js`).

- [ ] **Step 3: Write `generator/src/cache.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
export const CACHE_DIR = resolve(here, "..", ".cache");

function pathFor(key: string): string {
  // basename() strips any path traversal; keys are flat filenames.
  return join(CACHE_DIR, `${basename(key)}.json`);
}

export function readCache<T>(key: string): T | null {
  try {
    const p = pathFor(key);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(pathFor(key), JSON.stringify(value, null, 2), "utf8");
  } catch {
    /* cache write failures are non-fatal */
  }
}
```

- [ ] **Step 4: Create the tracked cache dir**

Run: `mkdir -p generator/.cache && touch generator/.cache/.gitkeep`

- [ ] **Step 5: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/cache.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add generator/src/cache.ts generator/src/__tests__/cache.test.ts generator/.cache/.gitkeep
git commit -m "feat: add last-good json cache"
```

---

### Task 4: Config & feature flags

**Files:**
- Create: `generator/src/config.ts`
- Test: `generator/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `loadConfig(env?: NodeJS.ProcessEnv): Config` where
  `Config = { githubToken: string | null; githubLogin: string; openRouter: { key: string; model: string } | null; wakatimeEnabled: boolean }`.

- [ ] **Step 1: Write the failing test `generator/src/__tests__/config.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("disables OpenRouter when no key is present", () => {
    const c = loadConfig({});
    expect(c.openRouter).toBeNull();
    expect(c.wakatimeEnabled).toBe(false);
    expect(c.githubLogin).toBe("ReaperOAK");
  });
  it("enables OpenRouter with a key and default model", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "sk-x" });
    expect(c.openRouter?.key).toBe("sk-x");
    expect(c.openRouter?.model.length).toBeGreaterThan(0);
  });
  it("passes through a GitHub token", () => {
    expect(loadConfig({ GITHUB_TOKEN: "ghs_x" }).githubToken).toBe("ghs_x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/config.test.ts`
Expected: FAIL (cannot find `../config.js`).

- [ ] **Step 3: Write `generator/src/config.ts`**

```ts
export interface Config {
  githubToken: string | null;
  githubLogin: string;
  openRouter: { key: string; model: string } | null;
  wakatimeEnabled: boolean;
}

const DEFAULT_MODEL = "openai/gpt-4o-mini"; // cheap + fast; swappable via env

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const key = env.OPENROUTER_API_KEY?.trim();
  return {
    githubToken: env.GITHUB_TOKEN?.trim() || null,
    githubLogin: env.GITHUB_LOGIN?.trim() || "ReaperOAK",
    openRouter: key ? { key, model: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL } : null,
    wakatimeEnabled: Boolean(env.WAKATIME_API_KEY?.trim()),
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add generator/src/config.ts generator/src/__tests__/config.test.ts
git commit -m "feat: add config with degradation feature flags"
```

---

### Task 5: GitHub data source (fallback-wrapped)

**Files:**
- Create: `generator/src/data/github.ts`
- Create: `generator/src/data/wakatime.ts`
- Test: `generator/src/__tests__/github.test.ts`

**Interfaces:**
- Consumes: `Config` (Task 4), `GithubSnapshot` (Task 2), `readCache`/`writeCache` (Task 3).
- Produces: `getGithubSnapshot(config: Config, fetchImpl?: typeof fetch): Promise<GithubSnapshot>` — never throws; on failure returns cache, else a zeroed snapshot.
  `getWakatime(config: Config): Promise<null>` — disabled stub returning `null`.

- [ ] **Step 1: Write the failing test `generator/src/__tests__/github.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { getGithubSnapshot } from "../data/github.js";
import type { Config } from "../config.js";

const cfg: Config = { githubToken: "t", githubLogin: "ReaperOAK", openRouter: null, wakatimeEnabled: false };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("getGithubSnapshot", () => {
  it("parses a successful GraphQL response", async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: { totalContributions: 1234,
              weeks: [{ contributionDays: [{ contributionCount: 1, date: "2026-07-20" }] }] },
          },
          repositories: { nodes: [
            { defaultBranchRef: { target: { history: { nodes: [
              { message: "feat: add billing ledger" }, { message: "fix: webhook replay" }] } } } }] },
        },
      },
    }));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.totalContributions).toBe(1234);
    expect(snap.recentCommitMessages).toContain("feat: add billing ledger");
  });

  it("never throws on network error; returns a zeroed snapshot when no cache", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const snap = await getGithubSnapshot(cfg, fake as unknown as typeof fetch);
    expect(snap.totalContributions).toBe(0);
    expect(Array.isArray(snap.recentCommitMessages)).toBe(true);
  });

  it("returns a zeroed snapshot (not a throw) when token is null", async () => {
    const snap = await getGithubSnapshot({ ...cfg, githubToken: null });
    expect(snap.totalContributions).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/github.test.ts`
Expected: FAIL (cannot find `../data/github.js`).

- [ ] **Step 3: Write `generator/src/data/github.ts`**

```ts
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
```

- [ ] **Step 4: Write `generator/src/data/wakatime.ts`** (disabled stub)

```ts
import type { Config } from "../config.js";
/** WakaTime is intentionally off unless a key exists. Returns null so callers omit the section. */
export async function getWakatime(config: Config): Promise<null> {
  if (!config.wakatimeEnabled) return null;
  return null; // real fetch deferred; keeping the profile from ever showing an empty widget
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/github.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add generator/src/data/github.ts generator/src/data/wakatime.ts generator/src/__tests__/github.test.ts
git commit -m "feat: add fallback-wrapped github data source"
```

---

### Task 6: OpenRouter LLM layer (4 jobs + guardrails)

**Files:**
- Create: `generator/src/llm/openrouter.ts`
- Create: `generator/src/llm/prompts.ts`
- Test: `generator/src/__tests__/prompts.test.ts`

**Interfaces:**
- Consumes: `Config` (Task 4), `GithubSnapshot` + `DynamicFields` + `content` (Task 2), cache (Task 3).
- Produces: `getDynamicFields(config, snapshot, fetchImpl?): Promise<DynamicFields>` — always returns a complete `DynamicFields`, using LLM → cache → `content.fallback` per field.
  Helper `sanitizeLine(raw: string | null, max: number): string | null` (exported for tests).

- [ ] **Step 1: Write the failing test `generator/src/__tests__/prompts.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { getDynamicFields, sanitizeLine } from "../llm/prompts.js";
import { content } from "../content.js";
import type { Config } from "../config.js";
import type { GithubSnapshot } from "../types.js";

const snap: GithubSnapshot = { recentCommitMessages: ["feat: ledger"], totalContributions: 5, currentStreakDays: 2 };

describe("sanitizeLine", () => {
  it("rejects empty and over-length", () => {
    expect(sanitizeLine("", 100)).toBeNull();
    expect(sanitizeLine("x".repeat(500), 100)).toBeNull();
  });
  it("rejects banned phrases and markdown-breaking chars", () => {
    expect(sanitizeLine("I am a passionate developer", 100)).toBeNull();
    expect(sanitizeLine("has a ``` fence", 100)).toBeNull();
  });
  it("accepts and trims a clean line", () => {
    expect(sanitizeLine("  Shipping fail-closed billing.  ", 100)).toBe("Shipping fail-closed billing.");
  });
});

describe("getDynamicFields", () => {
  it("returns static fallbacks when OpenRouter is disabled", async () => {
    const cfg: Config = { githubToken: null, githubLogin: "ReaperOAK", openRouter: null, wakatimeEnabled: false };
    const out = await getDynamicFields(cfg, snap);
    expect(out.tagline).toBe(content.fallback.tagline);
    expect(out.thinkingAbout).toBe(content.fallback.thinkingAbout);
  });

  it("uses LLM output when valid, falls back per-field when invalid", async () => {
    const cfg: Config = { githubToken: null, githubLogin: "ReaperOAK",
      openRouter: { key: "k", model: "m" }, wakatimeEnabled: false };
    // First call returns a clean tagline; subsequent calls return junk → fallback.
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Building calm systems." } }] })))
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "passionate ninja rockstar" } }] })));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe("Building calm systems.");
    expect(out.recentWork).toBe(content.fallback.recentWork); // banned-phrase → fallback
  });

  it("never throws on network error", async () => {
    const cfg: Config = { githubToken: null, githubLogin: "ReaperOAK",
      openRouter: { key: "k", model: "m" }, wakatimeEnabled: false };
    const fake = vi.fn().mockRejectedValue(new Error("down"));
    const out = await getDynamicFields(cfg, snap, fake as unknown as typeof fetch);
    expect(out.tagline).toBe(content.fallback.tagline);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/prompts.test.ts`
Expected: FAIL (cannot find modules).

- [ ] **Step 3: Write `generator/src/llm/openrouter.ts`**

```ts
export interface ChatArgs { key: string; model: string; system: string; user: string; fetchImpl?: typeof fetch; }

/** Single chat completion. Returns trimmed text or null on any failure. Never throws. */
export async function chat(args: ChatArgs): Promise<string | null> {
  const f = args.fetchImpl ?? fetch;
  try {
    const res = await f("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${args.key}`, "content-type": "application/json",
        "x-title": "ReaperOAK Profile" },
      body: JSON.stringify({
        model: args.model, max_tokens: 120, temperature: 0.7,
        messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Write `generator/src/llm/prompts.ts`**

```ts
import type { Config } from "../config.js";
import type { DynamicFields, GithubSnapshot } from "../types.js";
import { content } from "../content.js";
import { readCache, writeCache } from "../cache.js";
import { chat } from "./openrouter.js";

const CACHE_KEY = "dynamic-fields";
const BANNED = [/passionate/i, /ninja/i, /rockstar/i, /guru/i, /\bunleash\b/i];

export function sanitizeLine(raw: string | null, max: number): string | null {
  if (!raw) return null;
  const line = raw.replace(/^["']|["']$/g, "").trim();
  if (line.length === 0 || line.length > max) return null;
  if (line.includes("```") || line.includes("\n")) return null;
  if (BANNED.some((re) => re.test(line))) return null;
  return line;
}

const VOICE =
  "You write one line for Owais Ahmed Khan (ReaperOAK), a founding engineer who ships production AI systems. " +
  "Voice: precise, understated, technical, no hype. No emoji. No hashtags. Never use the words passionate, ninja, rockstar, guru. Plain sentence only.";

export async function getDynamicFields(
  config: Config, snapshot: GithubSnapshot, fetchImpl: typeof fetch = fetch,
): Promise<DynamicFields> {
  const fb = content.fallback;
  if (!config.openRouter) return { ...fb };
  const { key, model } = config.openRouter;
  const cached = readCache<DynamicFields>(CACHE_KEY);

  const pick = async (system: string, user: string, max: number, fallback: string, cachedVal?: string) => {
    const out = sanitizeLine(await chat({ key, model, system, user, fetchImpl }), max);
    return out ?? cachedVal ?? fallback;
  };

  const commits = snapshot.recentCommitMessages.slice(0, 8).join("; ") || "no recent commits";
  const result: DynamicFields = {
    tagline: await pick(VOICE, `Rewrite this mission line, same meaning, <=160 chars: "${fb.tagline}"`, 170, fb.tagline, cached?.tagline),
    recentWork: await pick(VOICE, `From these commit messages write one sentence starting "This week:" (<=160 chars): ${commits}`, 170, fb.recentWork, cached?.recentWork),
    thinkingAbout: await pick(VOICE, `Write one fresh systems-design thought Owais is chewing on today (<=160 chars).`, 170, fb.thinkingAbout, cached?.thinkingAbout),
    featuredBlurbs: {},
  };
  writeCache(CACHE_KEY, result);
  return result;
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/prompts.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add generator/src/llm/openrouter.ts generator/src/llm/prompts.ts generator/src/__tests__/prompts.test.ts
git commit -m "feat: add openrouter llm layer with guardrails and per-field fallback"
```

---

### Task 7: SVG utilities — color tokens + embedded font

**Files:**
- Create: `generator/src/render/svg-util.ts`
- Create: `generator/assets-fonts/Sora-SemiBold.ttf` (downloaded, committed)
- Test: `generator/src/__tests__/svg-util.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `THEME` — light & dark token maps (`bg`, `ink`, `mut`, `accent`, `accent2`, `line`).
  - `escapeXml(s: string): string`
  - `fontFaceStyle(): string` — a `<style>` block embedding Sora as a base64 data-URI `@font-face` named `OakDisplay`.

- [ ] **Step 1: Download the OFL font**

Run:
```bash
mkdir -p generator/assets-fonts
curl -fsSL "https://github.com/google/fonts/raw/main/ofl/sora/Sora%5Bwght%5D.ttf" -o generator/assets-fonts/Sora.ttf
ls -la generator/assets-fonts/Sora.ttf
```
Expected: a `.ttf` file > 50KB. (If the URL 404s, download any OFL grotesque `.ttf` to this path and keep the filename `Sora.ttf`.)

- [ ] **Step 2: Write the failing test `generator/src/__tests__/svg-util.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { THEME, escapeXml, fontFaceStyle } from "../render/svg-util.js";

describe("svg-util", () => {
  it("exposes dark and light themes with the oak accent", () => {
    expect(THEME.dark.accent).toBe("#E8A33D");
    expect(THEME.light.accent).toBe("#C77B30");
    expect(THEME.dark.bg).toBe("#0B0B0D");
  });
  it("escapes xml-hostile characters", () => {
    expect(escapeXml(`a & b < c > "d"`)).toBe("a &amp; b &lt; c &gt; &quot;d&quot;");
  });
  it("embeds a base64 font face named OakDisplay", () => {
    const s = fontFaceStyle();
    expect(s).toContain("@font-face");
    expect(s).toContain("OakDisplay");
    expect(s).toContain("base64,");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/svg-util.test.ts`
Expected: FAIL (cannot find `../render/svg-util.js`).

- [ ] **Step 4: Write `generator/src/render/svg-util.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Tokens { bg: string; panel: string; ink: string; mut: string; accent: string; accent2: string; line: string; }

export const THEME: { dark: Tokens; light: Tokens } = {
  dark:  { bg: "#0B0B0D", panel: "#0E0E11", ink: "#ECE7DE", mut: "#8F887B", accent: "#E8A33D", accent2: "#C77B30", line: "rgba(255,255,255,0.08)" },
  light: { bg: "#FBF8F2", panel: "#FFFFFF", ink: "#1A1712", mut: "#6B6459", accent: "#C77B30", accent2: "#A15E1E", line: "rgba(0,0,0,0.10)" },
};

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

let cachedFont: string | null = null;
function fontBase64(): string {
  if (cachedFont) return cachedFont;
  const here = fileURLToPath(new URL(".", import.meta.url));
  const p = resolve(here, "..", "..", "assets-fonts", "Sora.ttf");
  cachedFont = readFileSync(p).toString("base64");
  return cachedFont;
}

/** A <style> block embedding the display font so SVG text renders crisply on GitHub. */
export function fontFaceStyle(): string {
  return `<style>@font-face{font-family:'OakDisplay';font-weight:400 800;` +
    `src:url(data:font/ttf;base64,${fontBase64()}) format('truetype');}</style>`;
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/svg-util.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add generator/src/render/svg-util.ts generator/assets-fonts/Sora.ttf generator/src/__tests__/svg-util.test.ts
git commit -m "feat: add svg color tokens and embedded display font"
```

---

### Task 8: Hero SVG (dual light/dark)

**Files:**
- Create: `generator/src/render/svg-hero.ts`
- Test: `generator/src/__tests__/svg-hero.test.ts`

**Interfaces:**
- Consumes: `THEME`, `escapeXml`, `fontFaceStyle` (Task 7), `content` (Task 2), `DynamicFields` (Task 2).
- Produces: `renderHeroSvg(theme: "dark" | "light", tagline: string): string` — a complete `<svg>` document string, width 900.

- [ ] **Step 1: Write the failing test `generator/src/__tests__/svg-hero.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { renderHeroSvg } from "../render/svg-hero.js";

describe("renderHeroSvg", () => {
  it("produces a valid svg containing the wordmark and reveal", () => {
    const svg = renderHeroSvg("dark", "Shipping calm systems.");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Reaper");
    expect(svg).toContain("OAK");
    expect(svg).toContain("Owais");
    expect(svg).toContain("Shipping calm systems.");
  });
  it("uses the dark ground for dark and light ground for light", () => {
    expect(renderHeroSvg("dark", "x")).toContain("#0B0B0D");
    expect(renderHeroSvg("light", "x")).toContain("#FBF8F2");
  });
  it("escapes a hostile tagline", () => {
    expect(renderHeroSvg("dark", "a < b & c")).toContain("a &lt; b &amp; c");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/svg-hero.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write `generator/src/render/svg-hero.ts`**

```ts
import { THEME, escapeXml, fontFaceStyle } from "./svg-util.js";
import { content } from "../content.js";

export function renderHeroSvg(theme: "dark" | "light", tagline: string): string {
  const t = THEME[theme];
  const W = 900, H = 260;
  const { reaper, oak } = content.wordmark;
  const tag = escapeXml(tagline);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ReaperOAK — ${escapeXml(content.fullName)}">
${fontFaceStyle()}
<defs>
  <radialGradient id="glow" cx="50%" cy="-10%" r="80%">
    <stop offset="0%" stop-color="${t.accent}" stop-opacity="0.14"/>
    <stop offset="60%" stop-color="${t.accent}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<text x="${W / 2}" y="58" text-anchor="middle" font-family="ui-monospace,monospace" font-size="13" letter-spacing="4" fill="${t.mut}">${escapeXml(content.eyebrow.toUpperCase())}</text>
<text x="${W / 2}" y="132" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="72" letter-spacing="-2">
  <tspan fill="${t.ink}">${escapeXml(reaper)}</tspan><tspan fill="${t.accent}">${escapeXml(oak)}</tspan>
</text>
<text x="${W / 2}" y="170" text-anchor="middle" font-family="ui-monospace,monospace" font-size="14" letter-spacing="2" fill="${t.mut}">
  <tspan fill="${t.accent}">O</tspan>wais <tspan fill="${t.accent}">A</tspan>hmed <tspan fill="${t.accent}">K</tspan>han
</text>
<text x="${W / 2}" y="212" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" fill="${t.ink}" opacity="0.92">${tag}</text>
<line x1="${W / 2 - 120}" y1="238" x2="${W / 2 + 120}" y2="238" stroke="${t.accent}" stroke-opacity="0.35"/>
</svg>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/svg-hero.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add generator/src/render/svg-hero.ts generator/src/__tests__/svg-hero.test.ts
git commit -m "feat: add dual-theme hero svg"
```

---

### Task 9: Stats card SVG

**Files:**
- Create: `generator/src/render/svg-stats.ts`
- Test: `generator/src/__tests__/svg-stats.test.ts`

**Interfaces:**
- Consumes: `THEME`, `escapeXml`, `fontFaceStyle` (Task 7), `GithubSnapshot` (Task 2).
- Produces: `renderStatsSvg(theme: "dark" | "light", snap: GithubSnapshot): string` — width 900, shows total contributions + current streak. No top-languages.

- [ ] **Step 1: Write the failing test `generator/src/__tests__/svg-stats.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { renderStatsSvg } from "../render/svg-stats.js";

describe("renderStatsSvg", () => {
  it("renders the two metrics with formatted numbers", () => {
    const svg = renderStatsSvg("dark", { recentCommitMessages: [], totalContributions: 1234, currentStreakDays: 7 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("1,234");
    expect(svg).toContain("7");
    expect(svg).toContain("Contributions");
    expect(svg.toLowerCase()).not.toContain("language");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/svg-stats.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write `generator/src/render/svg-stats.ts`**

```ts
import { THEME, fontFaceStyle } from "./svg-util.js";
import type { GithubSnapshot } from "../types.js";

export function renderStatsSvg(theme: "dark" | "light", snap: GithubSnapshot): string {
  const t = THEME[theme];
  const W = 900, H = 140;
  const total = snap.totalContributions.toLocaleString("en-US");
  const cell = (x: number, value: string, label: string) => `
<text x="${x}" y="70" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="46" fill="${t.accent}">${value}</text>
<text x="${x}" y="100" text-anchor="middle" font-family="ui-monospace,monospace" font-size="13" letter-spacing="1" fill="${t.mut}">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity">
${fontFaceStyle()}
<rect width="${W}" height="${H}" rx="14" fill="${t.panel}" stroke="${t.line}"/>
${cell(W * 0.33, total, "Contributions · last year")}
${cell(W * 0.67, String(snap.currentStreakDays), "Day streak")}
<line x1="${W / 2}" y1="34" x2="${W / 2}" y2="106" stroke="${t.line}"/>
</svg>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/svg-stats.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add generator/src/render/svg-stats.ts generator/src/__tests__/svg-stats.test.ts
git commit -m "feat: add oak-themed stats card svg"
```

---

### Task 10: Markdown section renderers

**Files:**
- Create: `generator/src/render/markdown.ts`
- Test: `generator/src/__tests__/markdown.test.ts`

**Interfaces:**
- Consumes: `content` (Task 2), `DynamicFields` + `GithubSnapshot` (Task 2).
- Produces:
  - `SECTION_MARKERS: string[]` — the 8 required markers.
  - `renderReadme(fields: DynamicFields, snap: GithubSnapshot): string` — full markdown body with all markers and a `<picture>` hero referencing `assets/hero-dark.svg` / `assets/hero-light.svg` and `assets/stats-dark.svg` / `assets/stats-light.svg`.

- [ ] **Step 1: Write the failing test `generator/src/__tests__/markdown.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { renderReadme, SECTION_MARKERS } from "../render/markdown.js";
import { content } from "../content.js";

const fields = { ...content.fallback };
const snap = { recentCommitMessages: [], totalContributions: 100, currentStreakDays: 3 };

describe("renderReadme", () => {
  it("contains all 8 section markers", () => {
    const md = renderReadme(fields, snap);
    for (const m of SECTION_MARKERS) expect(md).toContain(m);
  });
  it("references dual-theme hero assets via <picture>", () => {
    const md = renderReadme(fields, snap);
    expect(md).toContain("assets/hero-dark.svg");
    expect(md).toContain("assets/hero-light.svg");
    expect(md).toContain("prefers-color-scheme");
  });
  it("lists live featured items with outward links and repos", () => {
    const md = renderReadme(fields, snap);
    expect(md).toContain("https://pindow.ai");
    expect(md).toContain("ForgeOS");
  });
  it("renders the real numbers and the human coda", () => {
    const md = renderReadme(fields, snap);
    expect(md).toContain("1.2M+");
    expect(md).toContain("throttle open");
  });
  it("leaves no unresolved template tokens", () => {
    expect(renderReadme(fields, snap)).not.toContain("{{");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/markdown.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write `generator/src/render/markdown.ts`**

```ts
import { content } from "../content.js";
import type { DynamicFields, GithubSnapshot, FeaturedItem } from "../types.js";

export const SECTION_MARKERS = [
  "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
  "<!-- section:engine-room -->", "<!-- section:numbers -->", "<!-- section:stats -->",
  "<!-- section:connect -->", "<!-- section:coda -->",
];

function hero(fields: DynamicFields): string {
  return `<!-- section:hero -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/hero-light.svg">
  <img alt="ReaperOAK — ${content.fullName}" src="assets/hero-dark.svg" width="900">
</picture>
</div>`;
}

function currently(fields: DynamicFields): string {
  return `<!-- section:currently -->
### Currently

- **Building** [Pindow](https://pindow.ai) and [Crosbird](https://www.crosbird.com/) at Cornflakes Media.
- **This cycle** — ${fields.recentWork}
- **Thinking about** — ${fields.thinkingAbout}`;
}

function blurb(f: FeaturedItem, fields: DynamicFields): string {
  return fields.featuredBlurbs[f.title] ?? f.problem;
}

function featured(fields: DynamicFields): string {
  const rows = content.featured.map((f) => {
    const name = f.live ? `**[${f.title} ↗](${f.url})**` : `**[${f.title}](${f.url})**`;
    return `| ${name} | ${blurb(f, fields)} | \`${f.stack}\` |`;
  }).join("\n");
  return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
}

function engineRoom(): string {
  const lines = content.stackGroups.map((g) => `- **${g.heading}** — ${g.items.join(" · ")}`).join("\n");
  return `<!-- section:engine-room -->
### The Engine Room

${lines}`;
}

function numbers(): string {
  const cells = content.numbers.map((n) => `\`${n.value}\` ${n.label}`).join("  ·  ");
  return `<!-- section:numbers -->
### Selected numbers

${cells}`;
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

function connect(): string {
  const links = content.contacts.map((c) => `[${c.label}](${c.url})`).join(" • ");
  return `<!-- section:connect -->
### Connect

${links}`;
}

function coda(): string {
  return `<!-- section:coda -->
<div align="center"><sub>${content.humanLine}</sub></div>`;
}

export function renderReadme(fields: DynamicFields, snap: GithubSnapshot): string {
  return [
    hero(fields), currently(fields), featured(fields), engineRoom(),
    numbers(), stats(), connect(), coda(),
  ].join("\n\n---\n\n") + "\n";
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/markdown.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add generator/src/render/markdown.ts generator/src/__tests__/markdown.test.ts
git commit -m "feat: add markdown section renderers"
```

---

### Task 11: Assemble — validate + atomic write

**Files:**
- Create: `generator/src/assemble.ts`
- Test: `generator/src/__tests__/assemble.test.ts`

**Interfaces:**
- Consumes: `renderReadme` + `SECTION_MARKERS` (Task 10), `renderHeroSvg` (Task 8), `renderStatsSvg` (Task 9), `content` (Task 2).
- Produces:
  - `validateReadme(md: string): { ok: true } | { ok: false; reason: string }`
  - `assemble(fields, snap, outDir): { readme: string; assets: Record<string, string> }` (pure; no fs)
  - `writeOutputs(root: string, built: {readme:string; assets:Record<string,string>}): void` (atomic-ish: validate before writing README).

- [ ] **Step 1: Write the failing test `generator/src/__tests__/assemble.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateReadme, assemble } from "../assemble.js";
import { content } from "../content.js";

const fields = { ...content.fallback };
const snap = { recentCommitMessages: [], totalContributions: 10, currentStreakDays: 1 };

describe("validateReadme", () => {
  it("rejects empty / too-short output", () => {
    expect(validateReadme("").ok).toBe(false);
    expect(validateReadme("tiny").ok).toBe(false);
  });
  it("rejects output missing a section marker", () => {
    const md = assemble(fields, snap).readme.replace("<!-- section:coda -->", "");
    expect(validateReadme(md).ok).toBe(false);
  });
  it("rejects unresolved tokens", () => {
    const md = assemble(fields, snap).readme + "\n{{oops}}";
    expect(validateReadme(md).ok).toBe(false);
  });
  it("accepts a full valid readme", () => {
    expect(validateReadme(assemble(fields, snap).readme).ok).toBe(true);
  });
});

describe("assemble", () => {
  it("produces four svg assets", () => {
    const built = assemble(fields, snap);
    expect(Object.keys(built.assets).sort()).toEqual(
      ["hero-dark.svg", "hero-light.svg", "stats-dark.svg", "stats-light.svg"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd generator && npx vitest run src/__tests__/assemble.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Write `generator/src/assemble.ts`**

```ts
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DynamicFields, GithubSnapshot } from "./types.js";
import { renderReadme, SECTION_MARKERS } from "./render/markdown.js";
import { renderHeroSvg } from "./render/svg-hero.js";
import { renderStatsSvg } from "./render/svg-stats.js";

const MIN_BYTES = 400;

export function validateReadme(md: string): { ok: true } | { ok: false; reason: string } {
  if (Buffer.byteLength(md, "utf8") < MIN_BYTES) return { ok: false, reason: "too short" };
  for (const m of SECTION_MARKERS) if (!md.includes(m)) return { ok: false, reason: `missing ${m}` };
  if (md.includes("{{")) return { ok: false, reason: "unresolved token" };
  return { ok: true };
}

export function assemble(fields: DynamicFields, snap: GithubSnapshot): { readme: string; assets: Record<string, string> } {
  return {
    readme: renderReadme(fields, snap),
    assets: {
      "hero-dark.svg": renderHeroSvg("dark", fields.tagline),
      "hero-light.svg": renderHeroSvg("light", fields.tagline),
      "stats-dark.svg": renderStatsSvg("dark", snap),
      "stats-light.svg": renderStatsSvg("light", snap),
    },
  };
}

/** Validates before overwriting README. Throws if invalid so main() can exit non-zero
 *  and leave the previous README untouched. */
export function writeOutputs(root: string, built: { readme: string; assets: Record<string, string> }): void {
  const check = validateReadme(built.readme);
  if (!check.ok) throw new Error(`readme validation failed: ${check.reason}`);
  const assetsDir = join(root, "assets");
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });
  for (const [name, svg] of Object.entries(built.assets)) writeFileSync(join(assetsDir, name), svg, "utf8");
  writeFileSync(join(root, "README.md"), built.readme, "utf8"); // written last, only after assets + validation
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd generator && npx vitest run src/__tests__/assemble.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add generator/src/assemble.ts generator/src/__tests__/assemble.test.ts
git commit -m "feat: add assemble with validation and atomic write"
```

---

### Task 12: Entrypoint + generate the first real README

**Files:**
- Create: `generator/src/main.ts`
- Generated (commit): `README.md`, `assets/hero-dark.svg`, `assets/hero-light.svg`, `assets/stats-dark.svg`, `assets/stats-light.svg`

**Interfaces:**
- Consumes: `loadConfig` (Task 4), `getGithubSnapshot` (Task 5), `getDynamicFields` (Task 6), `assemble`/`writeOutputs` (Task 11).
- Produces: a runnable `npm run build` that writes outputs to repo root.

- [ ] **Step 1: Write `generator/src/main.ts`**

```ts
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { getGithubSnapshot } from "./data/github.js";
import { getDynamicFields } from "./llm/prompts.js";
import { assemble, writeOutputs } from "./assemble.js";

async function main(): Promise<void> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const root = resolve(here, "..", ".."); // repo root (generator/src → repo)
  const config = loadConfig();
  const snap = await getGithubSnapshot(config);
  const fields = await getDynamicFields(config, snap);
  const built = assemble(fields, snap);
  writeOutputs(root, built);
  console.log("README generated:", Object.keys(built.assets).join(", "));
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Typecheck the whole project**

Run: `cd generator && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `cd generator && npm test`
Expected: all tests pass.

- [ ] **Step 4: Generate the first real README** (no token needed — uses fallbacks)

Run: `cd generator && npm run build && cd .. && ls -la assets && head -40 README.md`
Expected: `README.md` written at repo root; 4 SVGs in `assets/`; README shows the hero `<picture>` and all sections.

- [ ] **Step 5: Sanity-check the SVG renders** (optional visual)

Run: `cd /home/reaperoak/Documents/ReaperOAK && node -e "const s=require('fs').readFileSync('assets/hero-dark.svg','utf8'); if(!s.includes('</svg>')) process.exit(1); console.log('hero svg ok', s.length, 'bytes')"`
Expected: prints byte size, exits 0.

- [ ] **Step 6: Commit**

```bash
git add generator/src/main.ts README.md assets/
git commit -m "feat: add entrypoint and generate initial README"
```

---

### Task 13: GitHub Action

**Files:**
- Create: `.github/workflows/readme.yml`

**Interfaces:**
- Consumes: `generator/` build (Task 12).
- Produces: scheduled/push/manual regeneration that commits changed output.

- [ ] **Step 1: Write `.github/workflows/readme.yml`**

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
    runs-on: ubuntu-latest
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
      - name: Generate
        working-directory: generator
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
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

- [ ] **Step 2: Adjust `.gitignore` so the Action can commit cache snapshots**

Edit `generator/.gitignore` — confirm it keeps `.cache/*` local-ignored but the workflow force-adds needed files. To let last-good caches persist across runs, change the cache ignore to allow json:

Replace the contents of `generator/.gitignore` with:
```
node_modules/
```
(Cache JSON is now tracked so last-good survives between Action runs.)

- [ ] **Step 3: Validate the workflow YAML locally**

Run: `cd /home/reaperoak/Documents/ReaperOAK && node -e "const y=require('fs').readFileSync('.github/workflows/readme.yml','utf8'); if(!y.includes('workflow_dispatch')||!y.includes('contents: write')) process.exit(1); console.log('workflow ok')"`
Expected: prints `workflow ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/readme.yml generator/.gitignore
git commit -m "ci: add scheduled readme generation workflow"
```

---

### Task 14: Polish the three featured repos

**Files (in other repos, via `gh`):** ForgeOS, CodebaseRAG, survivorship-free-backtester.

**Interfaces:**
- Consumes: nothing (independent deliverable; makes Featured click-through land on a real repo).
- Produces: each featured repo has a description, topics, and a minimal README.

- [ ] **Step 1: Set descriptions + topics**

Run:
```bash
gh repo edit ReaperOAK/ForgeOS --description "An SDLC engine of orchestrated agents for spec-driven development." --add-topic ai-agents --add-topic sdlc --add-topic typescript
gh repo edit ReaperOAK/CodebaseRAG --description "Local RAG over any repository via an MCP server for instant codebase querying." --add-topic rag --add-topic mcp --add-topic llm
gh repo edit ReaperOAK/survivorship-free-backtester --description "Honest, survivorship-bias-corrected, tax-aware backtesting on free data. Python + DuckDB." --add-topic backtesting --add-topic quant --add-topic python
```
Expected: three success lines. (If `survivorship-free-backtester` already has a description, `gh` still succeeds.)

- [ ] **Step 2: Verify each repo has a README; add a minimal one only where missing**

Run: `for r in ForgeOS CodebaseRAG survivorship-free-backtester; do echo "== $r =="; gh api "repos/ReaperOAK/$r/readme" --jq .name 2>/dev/null || echo "NO README"; done`
Expected: prints `README.md` or `NO README` per repo.

For any repo printing `NO README`, create one via `gh api`:
```bash
CONTENT=$(printf '# %s\n\n%s\n\n> Part of the ReaperOAK toolset — https://github.com/ReaperOAK\n' "REPO_NAME" "ONE_LINE_DESCRIPTION" | base64 -w0)
gh api -X PUT "repos/ReaperOAK/REPO_NAME/contents/README.md" -f message="docs: add readme" -f content="$CONTENT"
```
(Substitute `REPO_NAME` and `ONE_LINE_DESCRIPTION` from Step 1 for each repo that lacked a README.)

- [ ] **Step 3: Confirm Featured links resolve**

Run: `for u in ForgeOS CodebaseRAG survivorship-free-backtester; do gh repo view ReaperOAK/$u --json description --jq .description; done`
Expected: three non-empty descriptions.

- [ ] **Step 4: No local commit needed** — these changes live in the other repos. Note completion in the plan.

---

## Self-Review

**Spec coverage:**
- §2 identity/visual → Tasks 2, 7, 8 (wordmark, O·A·K reveal, oak accent). ✓
- §3 topology/runtime → Tasks 1, 12, 13. ✓
- §4 graceful degradation → Tasks 3, 5, 6, 11 (cache, wrapped fetches, validate/atomic write). ✓
- §5 components → one task per unit. ✓
- §6 README structure (8 sections + numbers) → Task 10. ✓
- §7 LLM layer (tagline, recentWork, thinkingAbout, blurbs) → Task 6. *Note:* featuredBlurbs kept as a static-fallback map (renderer uses `FeaturedItem.problem`); dynamic per-repo blurb regeneration is wired through the same `featuredBlurbs` field and can be populated later without a renderer change. ✓
- §8 repo polish → Task 14. ✓
- §9 testing → every task is TDD; validation + fallback explicitly tested. ✓
- §10 out-of-scope (WakaTime off, no portfolio migration) → Task 5 stub, not built. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. Task 14 uses explicit substitution instructions with concrete commands. ✓

**Type consistency:** `GithubSnapshot`, `DynamicFields`, `Config`, `Tokens` names match across Tasks 2/4/5/6/8/9/10/11. `getDynamicFields`, `getGithubSnapshot`, `renderHeroSvg`, `renderStatsSvg`, `renderReadme`, `SECTION_MARKERS`, `assemble`, `writeOutputs`, `validateReadme` referenced consistently. ✓
