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
