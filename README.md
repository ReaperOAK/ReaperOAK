<!-- section:hero -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/hero-light.svg">
  <img alt="ReaperOAK — Owais Ahmed Khan" src="assets/hero-dark.svg" width="900">
</picture>
</div>

---

<!-- section:currently -->
### Currently

- **Focusing on** distributed systems, autonomous AI agents, and backend infrastructure.
- **This cycle** — This week: integrated automated portfolio intelligence pipeline, synchronized multi-repo fact sheets, and hardened desktop preflight layout engines.
- **Thinking about** — Designing deterministic verification gates for agentic SDLC workflows to prevent speculative code drift.

---

<!-- section:craft -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/craft-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/craft-light.svg">
  <img alt="Language mix and coding time" src="assets/craft-dark.svg" width="900">
</picture>
</div>

---

<!-- section:arena -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/arena-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/arena-light.svg">
  <img alt="Problem solving progress and deploy status" src="assets/arena-dark.svg" width="900">
</picture>
</div>

---

<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
| **[survivorship-free-backtester](https://github.com/ReaperOAK/survivorship-free-backtester)** | An honest, survivorship-bias-corrected backtesting engine. Market-agnostic — Indian equities (Nifty 50/100/200/500) wired in out of the box, extensible to US/global via yfinance. Tax-aware, free data, Python + DuckDB. | `Python · Shell` |
| **[ForgeOS](https://github.com/ReaperOAK/ForgeOS)** | An SDLC engine of orchestrated agents for spec-driven development. | `TypeScript · Python · JavaScript` |
| **[id-card-maker](https://github.com/ReaperOAK/id-card-maker)** | Desktop preflight, layout, and print-imposition engine in Tauri, Rust, and TypeScript. | `TypeScript · CSS · Rust` |
| **[CodebaseRAG](https://github.com/ReaperOAK/CodebaseRAG)** | Local RAG over any repository via an MCP server for instant codebase querying. | `JavaScript` |
| **[KCAdashboard](https://github.com/ReaperOAK/KCAdashboard)** | student teacher dashboard for KCA | `JavaScript · PHP · HTML` |
| **[expensify-sniper](https://github.com/ReaperOAK/expensify-sniper)** |  | `Python · Shell` |

---

<!-- section:log -->
### Engineering log

- Built automated repository intelligence engine to extract benchmark metrics and architecture decisions.
- Shipped Tauri desktop preflight verification and PDF imposition engine in id-card-maker.
- Hardened MCP server integration in ForgeOS with strict contract enforcement.
- Synchronized portfolio evidence matrix across 52 audited repositories.
- Refactored portfolio Next.js 16 App Router architecture and MDX content pipeline.

---

<!-- section:cases -->
### Case studies

<details>
<summary><b>survivorship-free-backtester</b> — <code>Python · DuckDB · yfinance · NSE bhavcopy</code></summary>

**Problem** — Retail backtests test the past using today's winning stocks. The bias is invisible and it inflates every result.

**Decision** — Reconstructed point-in-time Nifty 100/200/500 membership from the Internet Archive, recovered delisted-loser prices, and re-ran every strategy against the honest universe. Lot-level FIFO on top, with real Indian tax (20% STCG / 12.5% LTCG).

**Tradeoff** — The correction destroyed the headline. Momentum's Sharpe fell from ~1.5 to ~1.0, and after tax the high-turnover strategies barely beat buy-and-hold. Publishing that was the point.

**Outcome** — Survivorship inflates momentum by +0.4 to +0.9 Sharpe. Ensemble + regime-cash roughly halves drawdown, −38% to ~−18% — insurance, not free alpha. Intraday dip-buying died under honest testing.

[Open survivorship-free-backtester ↗](https://github.com/ReaperOAK/survivorship-free-backtester)

</details>

<details>
<summary><b>todayeggrates</b> — <code>JavaScript · MDX · PHP</code></summary>

**Problem** — Daily commodity rates that people actually check, which means the site is worthless the day it goes stale.

**Decision** — Content as MDX so rates and long-form pages ship through the same pipeline, with SEO treated as a build-time concern rather than a plugin.

**Tradeoff** — MDX made the build heavier and the content model stricter than a CMS would have. Bought two years of uninterrupted daily updates without an editor UI to maintain.

**Outcome** — Scaled to 7M+ search impressions, 34.2K+ clicks, and 2K+ MAU. Redis caching cut database load by ~90% and delivered sub-100ms API response times with ~99.9% uptime.

[Open todayeggrates ↗](https://todayeggrates.com/)

</details>

<details>
<summary><b>ForgeOS</b> — <code>TypeScript · Python · PostgreSQL</code></summary>

**Problem** — Agents given a whole codebase and a vague goal produce plausible output and unreviewable diffs.

**Decision** — Split the SDLC into stage-specific agents with explicit handoffs and a ticket lifecycle, so each stage has one job and a reviewable artifact.

**Tradeoff** — Far more orchestration machinery than a single-agent loop, and every stage boundary is a place work can stall. Bought traceability from vision to diff.

**Outcome** — Deterministic stage gates and artifact handoffs eliminated uncontrolled code drifts, producing verified PR diffs and full traceability from specification to merged implementation.

[Open ForgeOS ↗](https://github.com/ReaperOAK/ForgeOS)

</details>

---

<!-- section:roadmap -->
### Deliberate practice

| Track | What that means | Progress |
|---|---|---|
| **System design** | Distributed scheduling, consensus, failure detectors | ongoing |
| **NeetCode 150** | Pattern coverage, one directory per problem | `███████░░░` 101 / 150 |

---

<!-- section:engine-room -->
### The Engine Room

- **Languages · measured** — Python 45% · TypeScript 16% · JavaScript 15% · Astro 7% · HTML 6% · EJS 3%
- **Frontend** — React · React Native · Next.js · Expo · Tailwind / NativeWind
- **Backend** — NestJS · FastAPI · Node.js · Express · Socket.io · BullMQ
- **Generative AI** — Claude / GPT / Gemini · Prompt engineering · Multimodal
- **Cloud & DevOps** — AWS (EC2/RDS/ElastiCache/S3/Lambda) · Docker · Kubernetes · GitHub Actions
- **Data** — PostgreSQL · MySQL · MongoDB · Redis · OpenSearch

---

<!-- section:numbers -->
### Selected numbers

`3 yrs` shipping production systems  ·  `7M+` search impressions served  ·  `~90%` DB load cut by caching  ·  `<100ms` API responses

---

<!-- section:how -->
### How I work

- Every external dependency is optional. If a provider is down the product degrades, it does not break.
- A number without a method behind it is decoration. Publish the correction, not just the result.
- Tests describe behaviour, not implementation. A refactor that breaks the suite means the suite was wrong.
- Ship the smallest thing that can be measured, then measure it.

---

<!-- section:connect -->
### Connect

[Portfolio](https://portfolio.owaiskhan.website/) • [LinkedIn](https://linkedin.com/in/owaistech) • [Email](mailto:oaak78692@gmail.com)

---

<!-- section:coda -->
<div align="center"><sub>125R, throttle open  ·  writes poetry  ·  optimizes the economy before attacking</sub></div>
