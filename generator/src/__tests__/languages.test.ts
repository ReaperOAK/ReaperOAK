import { describe, it, expect } from "vitest";
import { computeLanguageShares } from "../data/languages.js";
import type { RepoNode } from "../types.js";

const repo = (over: Partial<RepoNode>): RepoNode => ({
  name: "r", url: "u", description: null, homepageUrl: null, stars: 0, forks: 0,
  pushedAt: "2026-09-06T00:00:00Z", isFork: false, isArchived: false,
  commitsLastYear: 10, languages: [], ...over,
});

const TODAY = "2026-09-06T00:00:00Z";

describe("computeLanguageShares", () => {
  it("returns an empty list when no repo has languages", () => {
    expect(computeLanguageShares([repo({})], TODAY)).toEqual([]);
  });

  it("does not let a 10x larger repo dominate the chart", () => {
    const shares = computeLanguageShares([
      repo({ name: "huge", languages: [{ name: "JavaScript", color: "#f1e05a", size: 800000 }] }),
      repo({ name: "small", languages: [{ name: "TypeScript", color: "#3178c6", size: 80000 }] }),
    ], TODAY);
    const js = shares.find((s) => s.name === "JavaScript")!.pct;
    const ts = shares.find((s) => s.name === "TypeScript")!.pct;
    expect(Math.abs(js - ts)).toBeLessThan(1);
  });

  it("weights a recently pushed repo above a stale one", () => {
    const shares = computeLanguageShares([
      repo({ name: "fresh", pushedAt: "2026-09-06T00:00:00Z",
        languages: [{ name: "Go", color: "#00ADD8", size: 1000 }] }),
      repo({ name: "stale", pushedAt: "2024-09-06T00:00:00Z",
        languages: [{ name: "PHP", color: "#4F5D95", size: 1000 }] }),
    ], TODAY);
    expect(shares[0]!.name).toBe("Go");
    expect(shares.find((s) => s.name === "Go")!.pct)
      .toBeGreaterThan(shares.find((s) => s.name === "PHP")!.pct);
  });

  it("excludes forks and archived repos", () => {
    const shares = computeLanguageShares([
      repo({ isFork: true, languages: [{ name: "Ruby", color: "#701516", size: 5000 }] }),
      repo({ isArchived: true, languages: [{ name: "Perl", color: "#0298c3", size: 5000 }] }),
      repo({ languages: [{ name: "Python", color: "#3572A5", size: 5000 }] }),
    ], TODAY);
    expect(shares.map((s) => s.name)).toEqual(["Python"]);
  });

  it("normalises percentages to sum to 100", () => {
    const shares = computeLanguageShares([
      repo({ languages: [
        { name: "TypeScript", color: "#3178c6", size: 600 },
        { name: "CSS", color: "#563d7c", size: 400 },
      ] }),
    ], TODAY);
    expect(Math.round(shares.reduce((a, s) => a + s.pct, 0))).toBe(100);
  });

  it("keeps only the top N languages", () => {
    const langs = ["A", "B", "C", "D", "E", "F", "G", "H"].map((n, i) => ({
      name: n, color: "#111111", size: 1000 - i * 10,
    }));
    expect(computeLanguageShares([repo({ languages: langs })], TODAY, 6)).toHaveLength(6);
  });

  it("substitutes a theme-neutral colour when GitHub reports none", () => {
    const shares = computeLanguageShares([
      repo({ languages: [{ name: "Move", color: null, size: 100 }] }),
    ], TODAY);
    expect(shares[0]!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("drops a repo whose pushedAt does not parse, rather than treating it as maximally recent", () => {
    const shares = computeLanguageShares([
      repo({ name: "good", pushedAt: "2026-09-06T00:00:00Z",
        languages: [{ name: "Go", color: "#00ADD8", size: 1000 }] }),
      repo({ name: "bad-date", pushedAt: "not-a-date",
        languages: [{ name: "Rust", color: "#dea584", size: 1000 }] }),
    ], TODAY);
    // If the bad repo were treated as maximally recent (recency = 1, same as "good"),
    // Rust would appear alongside Go. It must be absent entirely.
    expect(shares.map((s) => s.name)).toEqual(["Go"]);
  });

  it("drops an entire repo when one language has a non-finite size, including its otherwise-valid languages", () => {
    const shares = computeLanguageShares([
      repo({ name: "mixed", languages: [
        { name: "TypeScript", color: "#3178c6", size: 600 },
        { name: "CSS", color: "#563d7c", size: NaN },
      ] }),
      repo({ name: "clean", languages: [{ name: "Python", color: "#3572A5", size: 500 }] }),
    ], TODAY);
    // TypeScript had a perfectly valid size but shares a repo (and a poisoned `total`)
    // with the bad CSS entry — the conservative guard drops the repo, not just CSS.
    expect(shares.map((s) => s.name)).toEqual(["Python"]);
  });

  it("returns an empty list for an unparseable todayISO instead of computing unweighted", () => {
    const shares = computeLanguageShares([
      repo({ languages: [{ name: "Python", color: "#3572A5", size: 1000 }] }),
    ], "not-a-date");
    expect(shares).toEqual([]);
  });
});
