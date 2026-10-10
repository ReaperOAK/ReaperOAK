import type { SvgPanel } from "../types.js";
import type { NeetcodeSnapshot } from "../../types.js";
import { bar, frame } from "../../render/svg/primitives.js";

/** Same anatomy as the LeetCode panel beside it — display headline, one bar, one mono line —
 *  so the arena row reads as a set rather than three unrelated widgets. */
export const roadmapGaugePanel: SvgPanel<NeetcodeSnapshot> = {
  id: "roadmap-gauge",
  kind: "svg",
  size: { w: 278, h: 190 }, // see leetcode.ts: sized so all three arena panels share one row
  select: (ctx) => ctx.neetcode,
  render: (n, t, box) => {
    const x = box.x + 16, w = box.w - 32;
    const target = n.target > 0 ? n.target : 1;
    const solved = Math.min(target, Math.max(0, Number.isFinite(n.solved) ? n.solved : 0));
    // Math.max(1, ...) via `target` guards a target of 0: without it solved/0 is Infinity, and
    // Math.round(Infinity * 100) renders the literal string "Infinity% complete".
    const pct = Math.min(100, Math.round((solved / target) * 100)); // matches the clamped bar
    return `${frame(box, t, "neetcode 150")}
<text x="${x}" y="${box.y + 86}" font-family="OakDisplay,sans-serif" font-weight="800" font-size="48" fill="${t.accent}">${solved}<tspan dx="8" font-family="ui-monospace,monospace" font-weight="400" font-size="12" fill="${t.mut}">/ ${target}</tspan></text>
${bar({ x, y: box.y + 104, w, h: 8 }, pct, t)}
<text x="${x}" y="${box.y + 146}" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}"><tspan fill="${t.ink}">${pct}%</tspan> complete</text>`;
  },
};
