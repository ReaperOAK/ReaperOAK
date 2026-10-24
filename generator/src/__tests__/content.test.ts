import { describe, it, expect } from "vitest";
import { content } from "../content.js";

describe("content", () => {
  it("has 3 featured items, none of them private employer work", () => {
    expect(content.featured).toHaveLength(3);
    expect(content.featured.every((f) => f.url.startsWith("https://github.com/"))).toBe(true);
  });
  it("has non-empty fallback strings for every dynamic field", () => {
    expect(content.fallback.tagline.length).toBeGreaterThan(20);
    expect(content.fallback.recentWork.length).toBeGreaterThan(20);
    expect(content.fallback.thinkingAbout.length).toBeGreaterThan(20);
  });
  it("every featured item has a static problem line", () => {
    expect(content.featured.every((f) => f.problem.length > 10)).toBe(true);
  });
});
