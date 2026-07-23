import { describe, it, expect } from "vitest";
import { renderHeroSvg } from "../render/svg-hero.js";

describe("renderHeroSvg", () => {
  it("produces a valid svg containing the wordmark and reveal", () => {
    const svg = renderHeroSvg("dark", "Shipping calm systems.");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Reaper");
    expect(svg).toContain("OAK");
    expect(svg).toContain("Owais");
    expect(svg).toContain("Shipping calm systems.");
  });
  it("uses the dark ground for dark and light ground for light", () => {
    expect(renderHeroSvg("dark", "x")).toContain("#0B0B0D");
    expect(renderHeroSvg("light", "x")).toContain("#FBF8F2");
  });
  it("escapes a hostile tagline", () => {
    expect(renderHeroSvg("dark", "a < b & c")).toContain("a &lt; b &amp; c");
  });
});
