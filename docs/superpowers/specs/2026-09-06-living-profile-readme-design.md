# Living Profile README — Design

**Date:** 2026-09-06
**Repo:** `ReaperOAK/ReaperOAK` (GitHub profile repo)
**Supersedes:** parts of `2026-07-23-profile-readme-design.md` (that design stays valid; this extends it)

---

## Context

A working generator already exists at [`generator/`](../../../generator): ~1050 lines of TypeScript,
11 test files, a daily GitHub Actions cron. It fetches a GitHub snapshot, refreshes four
LLM-written fields, renders two dual-theme SVGs, assembles a README, and validates before
overwriting.

It is a good foundation and is **not** being thrown away. Its weakness is reach, not quality:

| Gap | Current state |
|---|---|
| Telemetry depth | two numbers (contributions, streak) |
| Language mix | hardcoded list in `content.ts` |
| Featured projects | hardcoded, no ranking |
| Activity feed | commit messages fetched, never rendered |
| Contribution graph | none |
| WakaTime | stub returning `null` |
| PR / review / release data | not fetched |
| Last-sync stamp | none |

## Goals

1. A dashboard that reads in ~8 seconds and is driven by real data, not decoration.
2. Narrative below it that rewards scrolling and proves engineering judgement.
3. Every widget either shows true data or is absent. No zeroed counters, no empty frames.
4. A broken build never damages the live page.
5. Adding the next panel costs one file.

## Non-goals

- Third-party badge/stat services (shields.io, capsule-render, github-readme-stats). The custom
  SVG pipeline already beats them and keeps the palette coherent.
- Animation for its own sake.
- Any paid API. Cost stays at zero.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Visual identity | Maximalist — command-center dashboard **and** long-form narrative | User selection |
| Palette | Unchanged: amber `#E8A13A` on ink, Sora embedded, dual-theme `<picture>` | Already distinctive; cyan would be generic |
| Build approach | Panel registry + composite SVG canvases | Scales with panel count; keeps text accessible |
| External sources | WakaTime, LeetCode, deploy status. Blog built but inert | User selection |
| Narrative sections | Case studies, engineering log, roadmap, how-I-work | User selection |
| LLM path | OmniRoute (self-hosted gateway) with OpenRouter as fallback | Same wire protocol; better free-tier stacking |
| Execution host | Self-hosted GitHub Actions runner on the OCI box | Only way to reach OmniRoute without exposing it |

### Why a panel registry

`render/markdown.ts` is already 92 lines of hand-written section functions. The target page has
~16 sections. Hand-written, that becomes a wall where every new panel edits four files.

### Why composite SVGs rather than one file per panel

Twelve small SVGs means twelve requests and no control over how panels align side by side.
Four composite canvases give precise layout and let two panels share a row.

### The split rule

**Images carry shape. Markdown carries meaning.**

Heatmaps, bars, gauges, the wordmark → SVG.
Every project name, repo link, commit message, case study → real markdown.

A link baked into an SVG is invisible to search, to screen readers, and to clicks. This is the
specific cost of the badge-wall approach and the reason it is rejected.

---

## Architecture

```
generator/src/
  config.ts            # + wakatimeKey, leetcodeHandle, uptimeTargets[], feedUrl, llm{baseUrl,key,models}
  types.ts
  cache.ts             # unchanged: last-good-value store
  data/
    github.ts          # one expanded GraphQL query
    neetcode.ts        # counts distinct problem dirs in ReaperOAK/neetcode-submissions
    wakatime.ts        # real fetch, replaces the stub
    leetcode.ts        # public GraphQL, no key
    uptime.ts          # HEAD checks, 5s timeout
    feed.ts            # RSS/Atom — written now, inert until FEED_URL is set
  panels/
    types.ts
    index.ts           # the registry: ordered array of panels
    svg/       identity signal heatmap languages waka leetcode roadmapGauge status
    md/        currently featured log cases roadmap stack how writing connect coda
  render/
    svg/               # primitives: frame, counter, bar, heatgrid, sparkline, gauge
    compose.ts         # packs svg panels into composite canvases
    markdown.ts        # assembles markdown panels in registry order
  llm/
    gateway.ts         # OpenAI-compatible client; OmniRoute primary, OpenRouter fallback
    prompts.ts
  assemble.ts
  main.ts
```

### Panel contract

The single abstraction everything hangs off:

```ts
interface Panel<D> {
  id: string;
  kind: "svg" | "markdown";
  /** null → this panel is omitted entirely. The whole failure story lives here. */
  select(ctx: Snapshot): D | null;
  renderSvg?(d: D, theme: Theme, box: Box): string;   // draws inside a box it is given
  renderMarkdown?(d: D, fields: DynamicFields): string;
  size?: { w: number; h: number };                     // preferred cell size
}
```

`select() → null` means: no data, no panel. WakaTime before the plugin is installed, LeetCode if
the endpoint errors, the blog before anything is written — all simply absent. A panel never
renders a frame around nothing.

### Adding a panel

One new file in `panels/`, one line in `panels/index.ts`. Nothing else changes.

---

## Data layer

One GitHub GraphQL request replaces today's thinner one.

| Pulled | Feeds |
|---|---|
| `contributionCalendar.weeks[]` (full grid) | heatmap |
| `totalCommit / PullRequest / Review / IssueContributions` | signal counters |
| `repositories(first:100)` + `languages(first:10){size, node{name,color}}` | real language mix |
| stars, forks, `pushedAt`, description, `homepageUrl`, latest release | Featured ranking |
| recent commit messages (already fetched, never shown) | engineering-log input |

Other sources:

| Source | Endpoint | Auth |
|---|---|---|
| NeetCode progress | `repos/ReaperOAK/neetcode-submissions/git/trees/HEAD?recursive=1` | `GITHUB_TOKEN` |
| LeetCode | `https://leetcode.com/graphql`, `matchedUser(username:"oaak78692")` | none |
| WakaTime | `/api/v1/users/current/stats/last_7_days` | `WAKATIME_API_KEY`, Basic |
| Uptime | HEAD on genai-platform, creator-marketplace, todayeggrates.com, reaperoak.web.app | none |
| Blog | `FEED_URL` (RSS/Atom) | none — unset, so inert |

### Language mix: per-repo normalisation

Raw byte totals would let one large repo decide the whole chart — `todayeggrates` alone carries
802K bytes of JavaScript. That measures repo size, not what its author works in.

Instead: compute each repo's own language *shares*, then sum those shares across repos weighted by
recency decay `exp(-days_since_push / 180)`. Top 6 languages, normalised to 100%. This answers
"what does he work in now", which is the question a reader is actually asking.

### Featured ranking

Every repo owned has 0–1 stars, so star-weighted ranking is dead on arrival. Score:

```
score = 0.40 * exp(-days_since_push / 90)      # recency
      + 0.25 * norm(log1p(commits_last_year))  # sustained effort
      + 0.20 * completeness                    # description + homepage + readme, 0..1
      + 0.15 * norm(log1p(stars + forks))      # reach — ~0 today, kept for later
isFork or isArchived → score = 0
```

`norm(x)` scales to 0..1 across the candidate set being ranked, so the weights stay comparable
regardless of absolute magnitudes.

The engineering log is the only activity surface — there is no separate raw commit feed. Two
sections rendering the same commits, one summarised and one not, would read as padding.

`config.featuredPins` force-includes (GenAI Media Platform and Creator Marketplace are not on this GitHub account and must
never drop off). `config.featuredBlocks` force-excludes.

---

## The page

```
┌─ HERO ──────────────────────────── svg 900×280 ─┐
│  SOFTWARE ENGINEER · BUILDER · SYSTEMS          │
│  Reaper OAK           ← wordmark, amber on ink  │
│  Owais Ahmed Khan                               │
│  <LLM tagline, refreshed daily>                 │
│  ● live   SYNCED 06 Sep 2026 · 19:14 IST        │
└─────────────────────────────────────────────────┘

Currently                                markdown · LLM

┌─ TELEMETRY ─────────────────────── svg 900×300 ─┐
│  53×7 contribution heatmap, 5-step amber ramp   │
│  commits   PRs   reviews   issues   streak      │
└─────────────────────────────────────────────────┘

┌─ CRAFT ─────────────────────────── svg 900×260 ─┐
│  LANGUAGE MIX ·real bytes │ WAKATIME ·real hrs  │
│  ▓▓▓▓▓▓▓▓░░ TypeScript 41 │ ▓▓▓▓▓░ TS  7h32m    │
└─────────────────────────────────────────────────┘

┌─ ARENA ─────────────────────────── svg 900×220 ─┐
│  LEETCODE oaak78692       │ SYSTEM STATUS        │
│  solved · rating          │ ● genai-platform     200  │
│  NEETCODE 150 ▓▓▓░░ 51    │ ● creator-marketplace  200  │
└─────────────────────────────────────────────────┘

Featured           markdown table · auto-ranked, pins honoured
Engineering log    markdown · LLM over real commits + releases
Case studies       <details> ×5
Roadmap            markdown · NeetCode live, system design config-driven
Engine room        markdown · real language data + static tooling
How I work         markdown · static, opinionated
Writing            inert until FEED_URL
Connect · coda
```

Assets produced: `hero`, `telemetry`, `craft`, `arena` × `{dark, light}` = 8 SVGs.
`stats-dark.svg` / `stats-light.svg` are removed, superseded by `telemetry`.

### Case studies

Five `<details>` blocks. Each states: the problem, the architecture decision, the tradeoff, the
number it moved.

| # | Project | The line it makes |
|---|---|---|
| 1 | **ai-trader-lab** | Measured its own bias and published the correction against itself: momentum Sharpe ~1.5 → ~1.0 corrected; ensemble + regime-cash halves drawdown (−38% → ~−18%), called "insurance, not free alpha"; intraday dip-buying reported as dead. The only project here that publishes what *didn't* work. |
| 4 | **todayeggrates** | Live two years, still pushed today. Sustained ownership — nothing else in the set shows it. |
| 5 | **ForgeOS** | 2.2M lines TS + 697K Python. Agent-orchestrated SDLC engine. |

Blurbs are LLM-refreshed; the structure and numbers are static and human-authored.

### Roadmap

- **NeetCode 150** — live. Distinct problem directories in `ReaperOAK/neetcode-submissions`
  counted against a target of 150. Currently 51. Updates itself on every solution pushed.
- **System design** — config-driven topic list with progress, bumped by hand.

---

## Failure model

Every source follows one shape:

```
fetch → writeCache on success → readCache on failure → null on miss
```

`null` reaches `select()`, the panel disappears. Concrete consequences:

| Failure | Result |
|---|---|
| WakaTime key absent or invalid | CRAFT renders language mix alone, at full width |
| LeetCode errors | ARENA shows system status alone |
| GitHub API down | Page rebuilds from last-good cache, stamped with the **cached** sync time |
| OmniRoute unreachable | Falls back to OpenRouter free chain |
| Both LLM paths fail | LLM fields fall to cache, then to the static strings in `content.ts` |
| Uptime check times out | That row shows `—`, not a fake `200` |

The sync stamp never lies. If the data came from cache, the stamp shows when that data was
fetched, not when the job ran.

### Write safety

`validateReadme` already gates the write. Extended to also reject `NaN`, `undefined`, `null` and
`Infinity` appearing in output, and to require the marker of every registered markdown panel.

On failure: throw → the Action exits non-zero → **README on disk is untouched**. A broken build
leaves yesterday's good page live. Assets are written before the README, and the README is written
last, only after validation passes.

---

## Testing

Same discipline as the existing 11 test files (vitest).

- Per panel: `select()` returns `null` on empty input; renderer output contains no unresolved
  tokens and parses as SVG where applicable.
- Ranking score: pure-function tests, in the style of the existing `computeStreak` tests —
  fork and archived score 0, pins win, recency dominates over stars.
- Language normalisation: a repo with 10× the bytes of another does not dominate the chart.
- One golden-file test over the fully composed page.
- Validation: each rejection reason has a failing-input test.

---

## Execution

Self-hosted GitHub Actions runner on the OCI box (`150.230.237.59`).

OmniRoute runs there on `0.0.0.0:20128`, but the host firewall accepts only port 22
(`-A INPUT -j REJECT --reject-with icmp-host-prohibited`), so a GitHub-hosted runner cannot reach
it. A self-hosted runner solves this without opening any inbound port — the runner polls outbound
and reaches OmniRoute over `127.0.0.1:20128`. `GITHUB_TOKEN` is still auto-provisioned, so no
personal access token is needed.

**Required hardening.** A self-hosted runner on a public repository will execute code from fork
pull requests. Before the runner is registered, set
`Settings → Actions → General → Fork pull request workflows` to require approval. This is not
optional; without it, anyone can run arbitrary code on the OCI box by opening a PR.

Environment:

| Variable | Value |
|---|---|
| `LLM_BASE_URL` | `http://127.0.0.1:20128/v1` |
| `LLM_API_KEY` | OmniRoute key (repo secret) |
| `LLM_MODELS` | ordered fallback chain |
| `OPENROUTER_API_KEY` | retained as fallback |
| `WAKATIME_API_KEY` | repo secret — **rotate before use**, the current key was pasted in plaintext |
| `LEETCODE_HANDLE` | `oaak78692` |
| `GITHUB_TOKEN` | auto-provisioned |

Schedule unchanged: daily cron, plus `workflow_dispatch`, plus push-on-`generator/**`.

---

## Rollout

1. ~~Reconcile the diverged `main`~~ — done 2026-09-06, rebased clean (0 behind, 3 ahead).
2. Panel registry + composite renderer. Existing panels ported, tests green, **page output
   unchanged**. This step is a refactor with no visible result, and that is the point.
3. Expanded GitHub query → heatmap, real language mix, auto-ranked Featured.
4. External adapters: NeetCode, LeetCode, uptime, WakaTime. `feed.ts` written but inert.
5. Narrative sections: case studies, engineering log, roadmap, how-I-work.
6. LLM gateway swap: OmniRoute primary, OpenRouter fallback.
7. Runner: harden fork-PR setting, register the OCI runner, switch `runs-on`, add secrets.

Each step ends green and shippable.

---

## Open items

**Duplicate repositories.** `ReaperOAK/survivorship-free-backtester` and `ReaperOAK/ai-trader-lab`
hold byte-identical content — 46 files each, same push date. Two public URLs for one project split
traffic and make a reader wonder which is real. One should become canonical and the other archived
or redirected. `ai-trader-lab` is the honest name; `survivorship-free-backtester` is the better
search name. Pending user decision; the README currently links the latter and will keep doing so
until told otherwise.

**WakaTime key rotation.** The current key was shared in plaintext and should be reset. The user
has acknowledged this and deferred it. The generator reads `process.env.WAKATIME_API_KEY` and
never hardcodes a key, so rotation is a settings change with no code impact.

**System-design roadmap progress** has no automatic source and is bumped by hand. If it goes stale
it will quietly misrepresent current focus. Accepted for now; a future option is deriving it from
a notes directory the way NeetCode progress is derived from a submissions repo.
