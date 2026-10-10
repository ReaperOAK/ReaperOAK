import { describe, it, expect } from "vitest";
import { leetcodePanel } from "../panels/svg/leetcode.js";
import { roadmapGaugePanel } from "../panels/svg/roadmapGauge.js";
import { statusPanel } from "../panels/svg/status.js";
import { arenaPanel } from "../panels/md/arena.js";
import { composeCanvas } from "../render/compose.js";
import { THEME } from "../render/svg-util.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";

const t = THEME.dark;
const box = { x: 0, y: 0, w: 280, h: 190 };

const withLeet: Snapshot = { ...FIXTURE, leetcode: {
  handle: "oaak78692", total: 214, easy: 96, medium: 101, hard: 17, ranking: 184203 } };
const withNeet: Snapshot = { ...FIXTURE, neetcode: { solved: 51, target: 150 } };
const withStatus: Snapshot = { ...FIXTURE, uptime: [
  { label: "app.example.com", url: "https://app.example.com", status: 200, ms: 143 },
  { label: "shop", url: "https://shop.example.com/", status: null, ms: null },
] };

describe("leetcodePanel", () => {
  it("omits itself when leetcode returned nothing", () => {
    expect(leetcodePanel.select({ ...FIXTURE, leetcode: null })).toBeNull();
  });

  it("shows the total and the per-difficulty split, and never the global rank", () => {
    const out = leetcodePanel.render(leetcodePanel.select(withLeet)!, t, box);
    expect(out).toContain(">214<");
    expect(out).toContain(">96<");
    expect(out).toContain(">17<");
    expect(out).not.toContain("184,203");
    expect(out).not.toContain("rank");
  });

  it("splits the difficulty bar in proportion to the solved counts", () => {
    const out = leetcodePanel.render(leetcodePanel.select(withLeet)!, t, box);
    const widths = [...out.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="8"/g)].map((m) => Number(m[1]));
    expect(widths).toHaveLength(3);
    // easy 96, medium 101, hard 17 of 214: medium is the widest, hard the narrowest
    expect(widths[1]!).toBeGreaterThan(widths[0]!);
    expect(widths[2]!).toBeLessThan(widths[0]!);
  });

  it("escapes the handle from config/API in the frame label (frame's own escaping, not double-escaped)", () => {
    const hostile: Snapshot = { ...withLeet, leetcode: { ...withLeet.leetcode!, handle: '<script>&"\'' } };
    const out = leetcodePanel.render(leetcodePanel.select(hostile)!, t, box);
    expect(out).not.toContain("<script>");
    // frame() upper-cases its label before escaping, and escapes exactly once: "&amp;lt;"
    // would mean the handle was pre-escaped by the panel and then escaped again by frame.
    expect(out).toContain("&lt;SCRIPT&gt;");
    expect(out).not.toContain("&amp;lt;");
  });

  it("omits the ranking line rather than crashing or printing null when ranking is absent", () => {
    const noRank: Snapshot = { ...withLeet, leetcode: { ...withLeet.leetcode!, ranking: null } };
    const out = leetcodePanel.render(leetcodePanel.select(noRank)!, t, box);
    expect(out).not.toContain("rank");
    expect(out).not.toContain("null");
  });
});

describe("roadmapGaugePanel", () => {
  it("omits itself when there is no neetcode data", () => {
    expect(roadmapGaugePanel.select({ ...FIXTURE, neetcode: null })).toBeNull();
  });

  it("renders solved against the target", () => {
    const out = roadmapGaugePanel.render(roadmapGaugePanel.select(withNeet)!, t, box);
    expect(out).toContain("51");
    expect(out).toContain("150");
  });

  it("never renders NaN% or Infinity% when target is zero", () => {
    const zeroTarget: Snapshot = { ...FIXTURE, neetcode: { solved: 5, target: 0 } };
    const out = roadmapGaugePanel.render(roadmapGaugePanel.select(zeroTarget)!, t, box);
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("Infinity");
  });
});

describe("statusPanel", () => {
  it("omits itself when there are no checks", () => {
    expect(statusPanel.select({ ...FIXTURE, uptime: null })).toBeNull();
    expect(statusPanel.select({ ...FIXTURE, uptime: [] })).toBeNull();
  });

  it("prints an em dash for an unreachable target instead of a status code", () => {
    const out = statusPanel.render(statusPanel.select(withStatus)!, t, box);
    expect(out).toContain("200");
    expect(out).toContain("—");
  });

  it("labels each target", () => {
    const out = statusPanel.render(statusPanel.select(withStatus)!, t, box);
    expect(out).toContain("app.example.com");
    expect(out).toContain("shop");
  });

  it("escapes a hostile label instead of injecting raw markup", () => {
    const hostile: Snapshot = { ...FIXTURE, uptime: [
      { label: '<script>&"\'', url: "https://x", status: 200, ms: 1 },
    ] };
    const out = statusPanel.render(statusPanel.select(hostile)!, t, box);
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("caps rendered rows at 4 even when there are more targets configured", () => {
    const many: Snapshot = { ...FIXTURE, uptime: [
      { label: "a", url: "https://a", status: 200, ms: 1 },
      { label: "b", url: "https://b", status: 200, ms: 1 },
      { label: "c", url: "https://c", status: 200, ms: 1 },
      { label: "d", url: "https://d", status: 200, ms: 1 },
      { label: "e", url: "https://e", status: 200, ms: 1 },
    ] };
    const out = statusPanel.render(statusPanel.select(many)!, t, box);
    expect(out).toContain(">a</text>");
    expect(out).toContain(">d</text>");
    expect(out).not.toContain(">e</text>");
  });
});

describe("arenaPanel", () => {
  it("omits itself when all three sources are empty", () => {
    expect(arenaPanel.select(FIXTURE)).toBeNull();
  });

  it("appears when only the neetcode gauge has data", () => {
    expect(arenaPanel.select(withNeet)).not.toBeNull();
  });

  it("emits a dual-theme picture block for the arena canvas", () => {
    const out = arenaPanel.render(arenaPanel.select(withNeet)!, withNeet);
    expect(out).toContain("<!-- section:arena -->");
    expect(out).toContain("assets/arena-dark.svg");
    expect(out).toContain("assets/arena-light.svg");
  });
});

describe("arena canvas row packing", () => {
  // All three arena panels are sized w:278 (3 * 278 + 2*16 = 866 <= 868 inner width) so a
  // full arena — leetcode + roadmap-gauge + status all active — must land in a single row.
  const full: Snapshot = { ...FIXTURE,
    leetcode: withLeet.leetcode, neetcode: withNeet.neetcode, uptime: withStatus.uptime };

  function frameRects(svg: string): Array<{ y: string; w: string }> {
    const rx = /<rect x="[\d.]+" y="([\d.]+)" width="([\d.]+)" height="190" rx="14"/g;
    const out: Array<{ y: string; w: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = rx.exec(svg))) out.push({ y: m[1]!, w: m[2]! });
    return out;
  }

  it("packs leetcode, roadmap-gauge and status into a single shared row", () => {
    const out = composeCanvas("arena", full, "dark", ["leetcode", "roadmap-gauge", "status"])!;
    const rects = frameRects(out);
    expect(rects).toHaveLength(3);
    // same y => one row, not three
    expect(new Set(rects.map((r) => r.y)).size).toBe(1);
    // canvas height = PAD*(1+1) + rowHeight(190) = one row only
    expect(out).toContain('height="222"');
  });

  it("widens the two surviving panels to share the row when one arena source is empty", () => {
    const out = composeCanvas("arena", { ...full, uptime: null }, "dark",
      ["leetcode", "roadmap-gauge", "status"])!;
    const rects = frameRects(out);
    expect(rects).toHaveLength(2);
    expect(new Set(rects.map((r) => r.y)).size).toBe(1); // still one row
    expect(rects.every((r) => r.w === "426")).toBe(true); // (868-16)/2, still one row
  });
});

describe("roadmapGaugePanel percentage", () => {
  it("never prints more than 100% even when solved exceeds the target", () => {
    const ctx: Snapshot = { ...FIXTURE, neetcode: { solved: 160, target: 150 } };
    const out = roadmapGaugePanel.render(roadmapGaugePanel.select(ctx)!, THEME.dark, { x: 0, y: 0, w: 278, h: 190 });
    expect(out).toContain(">100%</tspan> complete");
    expect(out).not.toContain("107%");
    // solved is clamped too, so the headline never claims 160 of 150
    expect(out).toContain(">150<tspan");
  });
});
