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
- **This cycle** — This week: added Claude Code bridge for vibecoding, refactored event handling with stricter types, standardized Vercel and Next.js configs, and updated graphify scripts.
- **Thinking about** — Considering event-driven state sync with CRDTs to reduce latency in distributed model serving.

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
| **[ForgeOS](https://github.com/ReaperOAK/ForgeOS)** | An SDLC engine of orchestrated agents for spec-driven development. | `TypeScript · Python · JavaScript` |
| **[csefarewell2k25](https://github.com/ReaperOAK/csefarewell2k25)** |  | `TypeScript · Python · HTML` |
| **[portfolio](https://github.com/ReaperOAK/portfolio)** |  | `JavaScript · TypeScript · MDX` |
| **[vibecoding](https://github.com/ReaperOAK/vibecoding)** |  | `Python · HTML · Shell` |
| **[survivorship-free-backtester](https://github.com/ReaperOAK/survivorship-free-backtester)** | An honest, survivorship-bias-corrected backtesting engine. Market-agnostic — Indian equities (Nifty 50/100/200/500) wired in out of the box, extensible to US/global via yfinance. Tax-aware, free data, Python + DuckDB. | `Python · Shell` |
| **[id-card-maker](https://github.com/ReaperOAK/id-card-maker)** |  | `TypeScript · CSS · Rust` |

---

<!-- section:log -->
### Engineering log

- New skills were added.
- Script was updated.
- Graphify was added.
- A .claude bridge was added so Claude Code could fully operate the vibecoding system.
- License was switched from MIT to PolyForm Noncommercial 1.0.0.

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

[Open todayeggrates ↗](https://todayeggrates.com/)

</details>

<details>
<summary><b>ForgeOS</b> — <code>TypeScript · Python · PostgreSQL</code></summary>

**Problem** — Agents given a whole codebase and a vague goal produce plausible output and unreviewable diffs.

**Decision** — Split the SDLC into stage-specific agents with explicit handoffs and a ticket lifecycle, so each stage has one job and a reviewable artifact.

**Tradeoff** — Far more orchestration machinery than a single-agent loop, and every stage boundary is a place work can stall. Bought traceability from vision to diff.

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

- **Languages · measured** — Python 39% · TypeScript 29% · JavaScript 22% · HTML 5% · Shell 2% · CSS 2%
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
