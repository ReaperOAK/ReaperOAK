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
    featuredBlurbs: {}, // empty → renderer uses each FeaturedItem.problem
  },
};
