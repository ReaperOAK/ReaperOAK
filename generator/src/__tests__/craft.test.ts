import { describe, it, expect } from "vitest";
import { languagesPanel } from "../panels/svg/languages.js";
import { wakaPanel, formatDuration } from "../panels/svg/waka.js";
import { craftPanel } from "../panels/md/craft.js";
import { THEME } from "../render/svg-util.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const t = THEME.dark;
const box = { x: 0, y: 0, w: 420, h: 220 };

const withLangs: Snapshot = { ...FIXTURE, languages: [
  { name: "TypeScript", color: "#3178c6", pct: 41.2 },
  { name: "Python", color: "#3572A5", pct: 22.0 },
] };

const withWaka: Snapshot = { ...FIXTURE, waka: {
  range: "Last 7 Days", totalSeconds: 40000,
  languages: [{ name: "TypeScript", seconds: 27120, pct: 67.8 }],
} };

describe("languagesPanel", () => {
  it("omits itself when there are no shares", () => {
    expect(languagesPanel.select({ ...FIXTURE, languages: null })).toBeNull();
    expect(languagesPanel.select({ ...FIXTURE, languages: [] })).toBeNull();
  });

  it("renders one labelled bar per language", () => {
    const out = languagesPanel.render(languagesPanel.select(withLangs)!, t, box);
    expect(out).toContain("TypeScript");
    expect(out).toContain("Python");
    expect(out).toContain("41.2%");
  });

  it("colours each bar with the language colour, not the accent", () => {
    const out = languagesPanel.render(languagesPanel.select(withLangs)!, t, box);
    expect(out).toContain("#3178c6");
  });
});

describe("wakaPanel", () => {
  it("omits itself when wakatime returned nothing", () => {
    expect(wakaPanel.select({ ...FIXTURE, waka: null })).toBeNull();
  });

  it("renders hours and minutes, not raw seconds", () => {
    const out = wakaPanel.render(wakaPanel.select(withWaka)!, t, box);
    expect(out).toContain("7h 32m");
    expect(out).not.toContain("27120");
  });

  it("renders a sub-hour language as minutes only", () => {
    const ctx: Snapshot = { ...FIXTURE, waka: { range: "r", totalSeconds: 600,
      languages: [{ name: "Shell", seconds: 600, pct: 100 }] } };
    expect(wakaPanel.render(wakaPanel.select(ctx)!, t, box)).toContain("10m");
  });
});

describe("craftPanel", () => {
  it("omits itself when neither source has data", () => {
    expect(craftPanel.select({ ...FIXTURE, languages: null, waka: null })).toBeNull();
  });

  it("appears when only the language mix is available", () => {
    expect(craftPanel.select({ ...withLangs, waka: null })).not.toBeNull();
  });

  it("emits a dual-theme picture block for the craft canvas", () => {
    const out = craftPanel.render(craftPanel.select(withLangs)!, withLangs);
    expect(out).toContain("<!-- section:craft -->");
    expect(out).toContain("assets/craft-dark.svg");
    expect(out).toContain("assets/craft-light.svg");
  });
});

describe("formatDuration guards", () => {
  it("renders a non-finite duration as 0m, never NaNm", () => {
    expect(formatDuration(NaN)).toBe("0m");
    expect(formatDuration(Infinity)).toBe("0m");
  });
});
