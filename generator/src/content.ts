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
    tagline: "I architect and ship production AI platforms — prompts into image, video, and audio.",
    recentWork: "Currently hardening billing ledgers, scaling multi-AZ infra, and shipping generative-AI media tooling.",
    thinkingAbout: "Fail-closed systems: how to make every external dependency optional without the product ever looking broken.",
    featuredBlurbs: {}, // empty → renderer uses each FeaturedItem.problem
  },
};
