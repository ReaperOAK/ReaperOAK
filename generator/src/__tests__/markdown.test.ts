import { describe, it, expect } from "vitest";
import { renderReadme, SECTION_MARKERS } from "../render/markdown.js";
import { content } from "../content.js";

const fields = { ...content.fallback };
const snap = { recentCommitMessages: [], totalContributions: 100, currentStreakDays: 3 };

describe("renderReadme", () => {
  it("contains all 8 section markers", () => {
    const md = renderReadme(fields, snap);
    for (const m of SECTION_MARKERS) expect(md).toContain(m);
  });
  it("references dual-theme hero assets via <picture>", () => {
    const md = renderReadme(fields, snap);
    expect(md).toContain("assets/hero-dark.svg");
    expect(md).toContain("assets/hero-light.svg");
    expect(md).toContain("prefers-color-scheme");
  });
  it("lists live featured items with outward links and repos", () => {
    const md = renderReadme(fields, snap);
    expect(md).toContain("https://pindow.ai");
    expect(md).toContain("ForgeOS");
  });
  it("renders the real numbers and the human coda", () => {
    const md = renderReadme(fields, snap);
    expect(md).toContain("1.2M+");
    expect(md).toContain("throttle open");
  });
  it("leaves no unresolved template tokens", () => {
    expect(renderReadme(fields, snap)).not.toContain("{{");
  });
});
