export interface RepoLink { name: string; url: string; }
export interface FeaturedItem {
  title: string; url: string; live: boolean;
  problem: string;          // one-line "what it solves" (static fallback)
  stack: string;            // e.g. "Python · FastAPI · React"
}
export interface StatNumber { value: string; label: string; }
export interface StatGroup { heading: string; items: string[]; }
export interface ContactLink { label: string; url: string; }

/** The LLM-refreshed fields; each has a static fallback in content.fallback. */
export interface DynamicFields {
  tagline: string;
  recentWork: string;
  thinkingAbout: string;
  /** Three to five lines summarising what actually shipped. Empty array = section omitted. */
  engineeringLog: string[];
  featuredBlurbs: Record<string, string>; // keyed by FeaturedItem.title
}

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

/** progress is omitted when there is no honest percentage to give — the renderer
 *  shows "ongoing" rather than inventing a number. */
export interface RoadmapTopic { name: string; detail: string; progress?: number; }

export interface StaticContent {
  eyebrow: string;
  wordmark: { reaper: string; oak: string };  // "Reaper" + "OAK"
  fullName: string;
  humanLine: string;
  featured: FeaturedItem[];
  featuredPins: string[];
  featuredBlocks: string[];
  stackGroups: StatGroup[];
  numbers: StatNumber[];
  contacts: ContactLink[];
  fallback: DynamicFields;
  caseStudies: CaseStudy[];
  roadmapTopics: RoadmapTopic[];
  principles: string[];
}

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
