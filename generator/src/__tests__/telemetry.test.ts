import { describe, it, expect } from "vitest";
import { heatmapPanel } from "../panels/svg/heatmap.js";
import { signalPanel } from "../panels/svg/signal.js";
import { telemetryPanel } from "../panels/md/telemetry.js";
import { THEME } from "../render/svg-util.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const box = { x: 0, y: 0, w: 860, h: 240 };
const t = THEME.dark;

const withCalendar = (days: Array<{ date: string; count: number }>): Snapshot =>
  ({ ...FIXTURE, github: { ...FIXTURE.github, calendar: days } });

describe("heatmapPanel", () => {
  it("omits itself when the calendar is empty", () => {
    expect(heatmapPanel.select(withCalendar([]))).toBeNull();
  });

  it("renders one cell per calendar day", () => {
    const ctx = withCalendar([
      { date: "2026-09-01", count: 3 }, { date: "2026-09-02", count: 0 },
    ]);
    const out = heatmapPanel.render(heatmapPanel.select(ctx)!, t, box);
    expect((out.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("heatmapPanel data rules", () => {
  it("omits itself when every day in the year is zero", () => {
    const zeros = Array.from({ length: 371 }, (_, i) => ({ date: `d${i}`, count: 0 }));
    expect(heatmapPanel.select(withCalendar(zeros))).toBeNull();
  });

  it("labels each month above the column where it starts", () => {
    const days = Array.from({ length: 70 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      return { date: d.toISOString().slice(0, 10), count: i % 3 };
    });
    const out = heatmapPanel.render(heatmapPanel.select(withCalendar(days))!, t, box);
    for (const m of ["Jan", "Feb", "Mar"]) expect(out).toContain(`>${m}</text>`);
  });
});

describe("signalPanel", () => {
  it("omits itself when every counter is zero", () => {
    const ctx: Snapshot = { ...FIXTURE, github: {
      ...FIXTURE.github, commits: 0, prs: 0, reviews: 0, issues: 0, currentStreakDays: 0 } };
    expect(signalPanel.select(ctx)).toBeNull();
  });

  it("renders all five counters when data exists", () => {
    const out = signalPanel.render(signalPanel.select(FIXTURE)!, t, box);
    for (const label of ["commits", "pull requests", "reviews", "issues", "day streak"]) {
      expect(out).toContain(label);
    }
  });

  it("drops a zero counter from the line instead of printing it", () => {
    const ctx: Snapshot = { ...FIXTURE, github: { ...FIXTURE.github, reviews: 0 } };
    const out = signalPanel.render(signalPanel.select(ctx)!, t, box);
    expect(out).not.toContain("reviews");
    expect(out).toContain("commits");
  });

  it("formats large numbers with separators", () => {
    const ctx: Snapshot = { ...FIXTURE, github: { ...FIXTURE.github, commits: 1284 } };
    expect(signalPanel.render(signalPanel.select(ctx)!, t, box)).toContain("1,284");
  });
});

describe("telemetryPanel", () => {
  it("omits itself when neither svg panel has data", () => {
    const ctx: Snapshot = { ...FIXTURE, github: { ...FIXTURE.github,
      calendar: [], commits: 0, prs: 0, reviews: 0, issues: 0, currentStreakDays: 0 } };
    expect(telemetryPanel.select(ctx)).toBeNull();
  });

  it("emits a dual-theme picture block referencing both assets", () => {
    const out = telemetryPanel.render(telemetryPanel.select(FIXTURE)!, FIXTURE);
    expect(out).toContain("<!-- section:telemetry -->");
    expect(out).toContain("assets/telemetry-dark.svg");
    expect(out).toContain("assets/telemetry-light.svg");
    expect(out).toContain("prefers-color-scheme: dark");
  });
});
