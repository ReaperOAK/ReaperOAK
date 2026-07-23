import { describe, it, expect } from "vitest";
import { content } from "../content.js";

describe("content", () => {
  it("has 5 featured items, live ones first", () => {
    expect(content.featured).toHaveLength(5);
    expect(content.featured.slice(0, 2).every((f) => f.live)).toBe(true);
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
