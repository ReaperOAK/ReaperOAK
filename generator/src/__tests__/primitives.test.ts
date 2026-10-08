import { describe, it, expect } from "vitest";
import { frame, counter, bar, heatGrid, gauge, statusDot } from "../render/svg/primitives.js";
import { THEME } from "../render/svg-util.js";

const t = THEME.dark;
const box = { x: 0, y: 0, w: 200, h: 100 };

describe("primitives", () => {
  it("frame draws a rounded rect using only theme tokens", () => {
    const out = frame(box, t, "SIGNAL");
    expect(out).toContain("<rect");
    expect(out).toContain(t.panel);
    expect(out).toContain("SIGNAL");
    expect(out).not.toMatch(/#(?!0E0E11|8F887B|E8A33D|ECE7DE|0B0B0D|C77B30)[0-9A-Fa-f]{6}/);
  });

  it("counter escapes its label", () => {
    expect(counter(10, 20, "5", "a & b", t)).toContain("a &amp; b");
  });

  it("bar clamps a percentage above 100", () => {
    const out = bar(box, 250, t);
    const width = Number(/width="([\d.]+)"[^>]*class="bar-fill"/.exec(out)?.[1] ?? -1);
    expect(width).toBeLessThanOrEqual(box.w);
  });

  it("bar clamps a negative percentage to zero", () => {
    const out = bar(box, -20, t);
    const width = Number(/width="([\d.]+)"[^>]*class="bar-fill"/.exec(out)?.[1] ?? -1);
    expect(width).toBe(0);
  });

  it("heatGrid emits one cell per day", () => {
    const days = Array.from({ length: 14 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, count: i }));
    const out = heatGrid(box, days, t);
    expect((out.match(/<rect/g) ?? []).length).toBe(14);
  });

  it("heatGrid gives a zero-count day the panel colour, not the accent", () => {
    const out = heatGrid(box, [{ date: "2026-08-01", count: 0 }], t);
    expect(out).toContain(t.panel);
    expect(out).not.toContain(t.accent);
  });

  it("heatGrid gives a NaN-count day the panel colour, not a malformed fill", () => {
    const out = heatGrid(box, [{ date: "2026-08-01", count: NaN }], t);
    expect(out).not.toContain("NaN");
    expect(out).toContain(`fill="${t.panel}"`);
  });

  it("heatGrid never emits a negative cell size", () => {
    const tinyBox = { x: 0, y: 0, w: 4, h: 100 };
    const days = Array.from({ length: 21 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, count: i }));
    const out = heatGrid(tinyBox, days, t);
    expect(out).not.toMatch(/width="-/);
    expect(out).not.toMatch(/height="-/);
  });

  it("heatGrid does not let one NaN-count day poison a sibling day's colour", () => {
    const out = heatGrid(box, [{ date: "2026-08-01", count: NaN }, { date: "2026-08-02", count: 5 }], t);
    expect(out).not.toContain("NaN");
  });

  it("gauge reports the fraction as a clamped ratio", () => {
    expect(gauge(box, 51, 150, t)).toContain("51");
    expect(gauge(box, 200, 150, t)).toContain("150");
  });

  it("gauge treats a NaN value as zero rather than rendering literal NaN", () => {
    const out = gauge(box, NaN, 150, t);
    expect(out).not.toContain("NaN");
    expect(out).toContain(">0<");
  });

  it("statusDot distinguishes ok from down", () => {
    expect(statusDot(0, 0, true, t)).not.toBe(statusDot(0, 0, false, t));
  });
});

describe("bar colour escaping", () => {
  it("escapes an externally sourced colour before it reaches the fill attribute", () => {
    const out = bar({ x: 0, y: 0, w: 100, h: 6 }, 50, THEME.dark, '#fff" onload="x');
    expect(out).not.toContain('onload="x"');
    expect(out).toContain("&quot;");
  });
});
