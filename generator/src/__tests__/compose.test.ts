import { describe, it, expect } from "vitest";
import { composeCanvas } from "../render/compose.js";
import type { Panel, Snapshot } from "../panels/types.js";
import { FIXTURE } from "./fixtures.js";

const live: Panel = {
  id: "live", kind: "svg", size: { w: 400, h: 100 },
  select: () => ({ n: 1 }), render: () => `<text>LIVE</text>`,
};
const dark: Panel = {
  id: "dark", kind: "svg", size: { w: 400, h: 100 },
  select: () => null, render: () => `<text>NEVER</text>`,
};

describe("composeCanvas", () => {
  it("returns null when every requested panel is inactive", () => {
    expect(composeCanvas("arena", FIXTURE, "dark", ["dark"], [dark])).toBeNull();
  });

  it("emits a single svg root containing the active panel", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["live"], [live, dark])!;
    expect(out.startsWith("<svg")).toBe(true);
    expect((out.match(/<svg/g) ?? []).length).toBe(1);
    expect(out).toContain("LIVE");
    expect(out).not.toContain("NEVER");
  });

  it("gives the sole active panel the full canvas width", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["live", "dark"], [live, dark])!;
    expect(out).toContain('width="900"');
  });

  it("renders light and dark differently", () => {
    const d = composeCanvas("arena", FIXTURE, "dark", ["live"], [live])!;
    const l = composeCanvas("arena", FIXTURE, "light", ["live"], [live])!;
    expect(d).not.toBe(l);
  });
});

describe("composeCanvas row wrapping", () => {
  const full1: Panel = {
    id: "full1", kind: "svg", size: { w: 860, h: 130 },
    select: () => true, render: (_d, _t, box) => `<rect data-id="full1" width="${box.w}" height="${box.h}" y="${box.y}"/>`,
  };
  const full2: Panel = {
    id: "full2", kind: "svg", size: { w: 860, h: 110 },
    select: () => true, render: (_d, _t, box) => `<rect data-id="full2" width="${box.w}" height="${box.h}" y="${box.y}"/>`,
  };
  const half1: Panel = {
    id: "half1", kind: "svg", size: { w: 420, h: 100 },
    select: () => true, render: (_d, _t, box) => `<rect data-id="half1" width="${box.w}"/>`,
  };
  const half2: Panel = {
    id: "half2", kind: "svg", size: { w: 420, h: 90 },
    select: () => true, render: (_d, _t, box) => `<rect data-id="half2" width="${box.w}"/>`,
  };
  const half2Off: Panel = {
    id: "half2-off", kind: "svg", size: { w: 420, h: 90 },
    select: () => null, render: () => `<rect data-id="half2-off"/>`,
  };

  it("stacks two full-width panels into two rows, each getting the full row width", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["full1", "full2"], [full1, full2])!;
    // height = PAD*(rows+1) + sum(rowHeights) = 16*3 + 130 + 110 = 288
    expect(out).toContain('height="288"');
    expect(out).toContain('data-id="full1" width="868"');
    expect(out).toContain('data-id="full2" width="868"');
    // second row starts below the first: y = PAD + row1H + PAD = 16 + 130 + 16 = 162
    expect(out).toContain('data-id="full2" width="868" height="110" y="162"');
  });

  it("puts two half-width panels in one shared row", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["half1", "half2"], [half1, half2])!;
    // one row: height = PAD*2 + max(100, 90) = 132
    expect(out).toContain('height="132"');
    expect(out).toContain('data-id="half1" width="426"');
    expect(out).toContain('data-id="half2" width="426"');
  });

  it("widens the survivor when its row-mate drops out", () => {
    const out = composeCanvas("arena", FIXTURE, "dark", ["half1", "half2-off"], [half1, half2Off])!;
    expect(out).toContain('data-id="half1" width="868"');
    expect(out).not.toContain("half2-off");
  });
});
