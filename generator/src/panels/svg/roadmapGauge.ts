import type { SvgPanel } from "../types.js";
import type { NeetcodeSnapshot } from "../../types.js";
import { frame, gauge } from "../../render/svg/primitives.js";

export const roadmapGaugePanel: SvgPanel<NeetcodeSnapshot> = {
  id: "roadmap-gauge",
  kind: "svg",
  size: { w: 278, h: 190 }, // see leetcode.ts: sized so all three arena panels share one row
  select: (ctx) => ctx.neetcode,
  render: (n, t, box) => {
    // Math.max(1, ...) guards a target of 0: without it solved/0 is Infinity, and
    // Math.round(Infinity * 100) renders the literal string "Infinity% complete".
    const pct = Math.min(100, Math.round((n.solved / Math.max(1, n.target)) * 100)); // matches gauge()'s clamped bar
    return `${frame(box, t, "neetcode 150")}
${gauge({ x: box.x + 16, y: box.y + 70, w: box.w - 32, h: 34 }, n.solved, n.target, t)}
<text x="${box.x + 16}" y="${box.y + 140}" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}">${pct}% complete</text>`;
  },
};
