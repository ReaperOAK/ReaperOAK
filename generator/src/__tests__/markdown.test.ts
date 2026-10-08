import { describe, it, expect } from "vitest";
import { renderReadme } from "../render/markdown.js";
import { SECTION_MARKERS } from "../assemble.js";
import { FIXTURE } from "./fixtures.js";

describe("renderReadme", () => {
  it("contains all 8 section markers", () => {
    const md = renderReadme(FIXTURE);
    for (const m of SECTION_MARKERS) expect(md).toContain(m);
  });
  it("references dual-theme hero assets via <picture>", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("assets/hero-dark.svg");
    expect(md).toContain("assets/hero-light.svg");
    expect(md).toContain("prefers-color-scheme");
  });
  it("lists live featured items with outward links and repos", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("GenAI Media Platform");
    expect(md).toContain("ForgeOS");
  });
  it("renders the real numbers and the human coda", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("7M+");
    expect(md).toContain("throttle open");
  });
  it("leaves no unresolved template tokens", () => {
    expect(renderReadme(FIXTURE)).not.toContain("{{");
  });
});
