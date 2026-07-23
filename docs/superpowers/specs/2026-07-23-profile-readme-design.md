# ReaperOAK Profile README — Design Spec

**Date:** 2026-07-23
**Repo:** `ReaperOAK/ReaperOAK` (GitHub profile README repo)
**Owner:** Owais Ahmed Khan (ReaperOAK)

---

## 1. Goal & success criteria

Build a world-class GitHub profile README that makes any strong engineer, founder, or
recruiter respect Owais on sight, while keeping every audience option open ("look elite,
keep options open"). The output whispers; the engineering behind it is maximal.

**Success looks like:**

- Above the fold reads as an independent builder, not a student profile.
- First click after the README never lands on a bare, context-free repo.
- The profile visibly refreshes itself (recent work, a rotating thought) without manual edits.
- It never renders broken, stale-looking, or empty — even when every external service is down.

**Design tension we hold on purpose:** *maximal machinery, minimal noise.* Generator app +
live data + LLM + custom SVG behind the scenes; a restrained, disciplined page in front.
Linear's engineering is enormous and their homepage whispers — that is the target.

---

## 2. Identity & visual system (locked)

- **Name treatment:** `ReaperOAK` wordmark where **OAK** is accented, resolving to
  **O**wais **A**hmed **K**han — the handle "clicks" into the real name. This reveal is the
  signature element.
- **Accent:** Oak amber → bronze, `#E8A33D → #C77B30`. One accent, used sparingly.
- **Ground:** near-black `#0B0B0D`, panel `#0E0E11`.
- **Ink:** warm off-white `#ECE7DE`; muted warm grey `#8F887B`.
- **Rationale:** warm amber ties to the OAK in the name and is rare among dev profiles
  (which cluster on purple/cyan). Reads premium, not "gamer."
- **Typography:** hero wordmark ships as an **SVG with embedded font paths** (sharp, no
  webfont dependency). Body copy uses GitHub's native markdown type. Mono is used for
  eyebrows, chips, and the human coda.
- **Human anchor (coda):** motorcycles (125R, throttle open) · poetry · chess/strategy.
  Reframed as vitality — the current live README line about dying is dropped.

---

## 3. Repo topology & runtime

- **Single repo.** Generator source and generated output both live in `ReaperOAK/ReaperOAK`.
  The app source itself is proof of engineering.
- **`/generator`** — Node + TypeScript application.
- **`/assets`** — generated SVGs (hero, stats card, dividers), committed.
- **`/generator/.cache`** — committed last-good JSON snapshots (data + LLM outputs) so the
  fallback survives across runs and cold environments.
- **`README.md`** at repo root — generated output, committed.
- **`.github/workflows/readme.yml`** — GitHub Action:
  - **Triggers:** daily schedule (~06:30 IST / `0 1 * * *` UTC), push to `main`, manual `workflow_dispatch`.
  - **Steps:** checkout → setup Node → install → `npm run build` (runs generator) →
    commit `README.md` + `/assets` + `/generator/.cache` **only if changed**.
  - **Secrets/env:** built-in `GITHUB_TOKEN`; `OPENROUTER_API_KEY` (optional).

---

## 4. Core architectural law — graceful degradation

Every data source is **optional** and **fails silent**. This is a hard requirement, not a
nice-to-have (explicit user constraint: "if OpenRouter doesn't work, the app shouldn't break").

Rules:

1. **Three-tier fallback per dynamic field:** live fetch → committed last-good cache →
   hardcoded static string. A failure logs a warning and drops one tier down.
2. **Atomic write.** The README is assembled in an in-memory buffer, then **validated**
   before it is allowed to overwrite `README.md`:
   - non-empty and above a minimum byte threshold,
   - contains every required `<!-- section:NAME -->` sentinel marker,
   - no unresolved template tokens.
   If validation fails, the build **aborts and leaves the previous `README.md` untouched.**
   Atomic or nothing.
3. **No partial commits.** If a section can't render, it uses its fallback and the build
   still completes — the profile never shows a hole or an error string.
4. **Cache is source-of-truth for "last good."** Successful live fetches update the cache;
   failed fetches read from it.

---

## 5. Components (isolated, single-purpose units)

Each unit: one clear job, well-defined interface, independently testable.

| Unit | Job | Depends on |
|------|-----|-----------|
| `config` | Load env/secrets, feature flags (LLM on/off, WakaTime off). Single source of truth. | env |
| `content` | Typed static data: real numbers, featured items, stack groups, contact links, **and every static fallback string**. | — |
| `cache` | Read/write last-good JSON in `/generator/.cache`. | fs |
| `data/github` | GraphQL client → typed snapshots (contribution stats, recent commits, repo metadata). Wrapped in try/fallback. | `GITHUB_TOKEN`, `cache` |
| `data/wakatime` | Optional coding-stats module. **Disabled by default** (off unless key present). | `cache` |
| `llm/openrouter` | Client + 4 prompt fns. Each returns `string \| null`; `null` on any failure. | `OPENROUTER_API_KEY`, `cache` |
| `render/svg` | Pure fns: data → SVG string (hero dual-theme, stats card, dividers). | `content` |
| `render/markdown` | Pure section renderers: data → markdown between sentinel markers. | `content` |
| `assemble` | Orchestrate gather → render → validate → atomic write of `README.md` + assets. | all render + data units |
| `main` | Entrypoint: wire `config` → gather → `assemble`. | above |

**Data flow:** `main` → `config` → parallel gather (`data/github`, `llm/*`, `cache`) →
`render/svg` + `render/markdown` → `assemble` (validate) → write files → Action commits.

---

## 6. README structure (story arc: where I started → what I build → what's next)

Ordered as a landing page, not documentation. Each `<!-- section:X -->` marker is required
for validation.

1. **`hero`** — hero SVG: eyebrow (`Founding Engineer · Generative AI`), ReaperOAK → O·A·K
   reveal, tagline\*, human line. Dual light/dark via `<picture>` + `prefers-color-scheme`.
2. **`currently`** — building Pindow + Crosbird · recent-work line\* · "thinking about" note\*.
3. **`featured`** — **Pindow** + **Crosbird** (live, outward links) then **ForgeOS** /
   **CodebaseRAG** / **survivorship-free-backtester** (repo links). Each: one-line problem
   it solves + stack.
4. **`engine-room`** — curated stack, grouped, minimal single-color presentation
   (no shields.io soup):
   - Languages: TypeScript, JavaScript, Python, PHP, Java
   - Frontend: React, React Native, Next.js, Expo, Tailwind / NativeWind
   - Backend: NestJS, FastAPI, Node.js, Express, Socket.io, BullMQ
   - Generative AI: Claude / GPT / Gemini integration, prompt engineering, fal.ai, ElevenLabs, multimodal
   - Cloud & DevOps: AWS (EC2, RDS, ElastiCache, S3, Lambda), Docker, Kubernetes, GitHub Actions
   - Data & Payments: PostgreSQL, MySQL, MongoDB, Redis, OpenSearch · Stripe, Razorpay, Cashfree
5. **`numbers`** — real proof (from résumé): 1.2M+ clicks · 28K+ MAU · 15+ foundation models ·
   ~95% test coverage · sub-100ms APIs · National Finalist (19,000+ participants).
6. **`stats`** — one tasteful oak-themed contribution/streak SVG card. **Top-languages hidden**
   (reflects repo makeup, not skill).
7. **`connect`** — Portfolio (`reaperoak.web.app`) · LinkedIn (`owaistech`) · email
   (`oaak78692@gmail.com`). No X/Twitter.
8. **`coda`** — human line: 125R throttle · poetry · chess.

\* = refreshed daily by the LLM layer, each with a static fallback.

---

## 7. The daily LLM layer (OpenRouter — 4 jobs, each fails silent)

Model: a cheap, fast OpenRouter model. Each job is a pure prompt fn with tight voice
guardrails; on any failure returns `null` → caller uses last-good cache → static string.

1. **Narrate recent work** — reads last N commits/pushes across repos, writes 1–2 tight
   sentences ("This week: hardened the billing ledger against replayed webhooks…").
2. **Rotating "currently thinking about"** — a fresh short systems-design note daily.
3. **Dynamic tagline** — subtly rewrites the hero mission line so it never feels frozen.
4. **Auto-summarize featured repos** — regenerates each featured project's one-line
   "what problem this solves" blurb from its metadata, so blurbs stay accurate.

Guardrails: max length caps, banned-phrase list (no "passionate", no emoji spam), voice
anchored to a short style sample. Output validated (length + no markdown-breaking chars)
before use; invalid → fallback.

---

## 8. Repo-polish scope (part of this build)

So click-through from **Featured** never hits a bare repo, add **README + description +
topics** to:

- **ForgeOS**
- **CodebaseRAG**
- **survivorship-free-backtester**

Each README: what it is, the problem it solves, quickstart (run in ~30s), stack. Minimal,
honest, matching the profile's restraint.

---

## 9. Error handling & testing

**Error handling** — see §4. Every external call is wrapped; the only unrecoverable error is
"validated README could not be produced," which aborts without touching the committed file.

**Testing (vitest):**

- **Renderers** (pure): snapshot tests for each markdown/SVG section.
- **Fallback logic:** simulate each source failing (GitHub, OpenRouter, cache-miss) →
  assert the correct lower tier is used and output is still well-formed.
- **Validation:** reject empty output, missing sentinel markers, unresolved tokens →
  assert previous README is preserved.
- **LLM guardrails:** over-length / banned-phrase / markdown-breaking output → assert fallback.
- **Assembly integration:** full run with all sources mocked → assert a valid README with all
  8 section markers.

---

## 10. Out of scope (explicit)

- **Portfolio migration Firebase → GitHub Pages.** Separate follow-up project; a lateral move,
  not an upgrade (Firebase Hosting is better for SPAs; Pages needs a `404.html` redirect hack).
  The README links to whatever the portfolio URL is, so this is fully decoupled — change one
  line if migrated later.
- **WakaTime widget** — module exists but stays disabled (no account).
- **Snake game, visitor counters, typing GIFs, badge collections** — deliberately excluded.

---

## 11. Assumptions

- Daily run at ~06:30 IST is acceptable.
- `OPENROUTER_API_KEY` will be added as a GitHub Actions secret; until then the LLM layer is
  simply off and static fallbacks render (still a complete, polished profile).
- Real numbers in §6 come from the résumé and are accurate to cite.
