import { describe, it, expect } from "vitest";
import { renderStatsSvg } from "../render/svg-stats.js";

describe("renderStatsSvg", () => {
  it("renders the two metrics with formatted numbers", () => {
    const svg = renderStatsSvg("dark", { recentCommitMessages: [], totalContributions: 1234, currentStreakDays: 7 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("1,234");
    expect(svg).toContain("7");
    expect(svg).toContain("Contributions");
    expect(svg.toLowerCase()).not.toContain("language");
  });
});
