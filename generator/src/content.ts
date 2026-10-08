import type { StaticContent } from "./types.js";

export const content: StaticContent = {
  eyebrow: "Senior Developer · Backend & Infrastructure",
  wordmark: { reaper: "Reaper", oak: "OAK" },
  fullName: "Owais Ahmed Khan",
  humanLine: "125R, throttle open  ·  writes poetry  ·  optimizes the economy before attacking",
  featured: [
    { title: "GenAI Media Platform", url: "", live: true,
      problem: "Generative-AI media platform orchestrating foundation models for image, video, and audio.",
      stack: "FastAPI · NestJS · Java · React · AWS" },
    { title: "Creator Marketplace", url: "", live: true,
      problem: "Cross-platform creator marketplace for web, iOS, and Android.",
      stack: "Expo · React Native · NestJS" },
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
  /** Repos forced to the top of Featured regardless of score. */
  featuredPins: [],
  /** Repos never shown. */
  featuredBlocks: ["ai-trader-lab", "App", "neetcode-submissions", "ReaperOAK"],
  stackGroups: [
    { heading: "Languages", items: ["TypeScript", "JavaScript", "Python", "PHP", "Java"] },
    { heading: "Frontend", items: ["React", "React Native", "Next.js", "Expo", "Tailwind / NativeWind"] },
    { heading: "Backend", items: ["NestJS", "FastAPI", "Node.js", "Express", "Socket.io", "BullMQ"] },
    { heading: "Generative AI", items: ["Claude / GPT / Gemini", "Prompt engineering", "fal.ai", "ElevenLabs", "Multimodal"] },
    { heading: "Cloud & DevOps", items: ["AWS (EC2/RDS/ElastiCache/S3/Lambda)", "Docker", "Kubernetes", "GitHub Actions"] },
    { heading: "Data & Payments", items: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "OpenSearch", "Stripe", "Razorpay", "Cashfree"] },
  ],
  numbers: [
    { value: "3 yrs", label: "shipping production systems" },
    { value: "4", label: "engineers led" },
    { value: "7M+", label: "search impressions served" },
    { value: "~90%", label: "DB load cut by caching" },
    { value: "<100ms", label: "API responses" },
  ],
  contacts: [
    { label: "Portfolio", url: "https://reaperoak.web.app/" },
    { label: "LinkedIn", url: "https://linkedin.com/in/owaistech" },
    { label: "Email", url: "mailto:oaak78692@gmail.com" },
  ],
  fallback: {
    tagline: "I architect and ship production AI platforms — prompts into image, video, and audio.",
    recentWork: "Currently deep in backend reliability: load-shedding, idempotency, and capacity planning.",
    thinkingAbout: "Fail-closed systems: how to make every external dependency optional without the product ever looking broken.",
    // An invented changelog is worse than no section — empty is deliberate.
    engineeringLog: [],
    featuredBlurbs: {}, // empty → renderer uses each FeaturedItem.problem
  },
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
    { name: "System design", detail: "Distributed scheduling, consensus, failure detectors" },
  ],
  principles: [
    "Every external dependency is optional. If a provider is down the product degrades, it does not break.",
    "A number without a method behind it is decoration. Publish the correction, not just the result.",
    "Tests describe behaviour, not implementation. A refactor that breaks the suite means the suite was wrong.",
    "Ship the smallest thing that can be measured, then measure it.",
  ],
};
