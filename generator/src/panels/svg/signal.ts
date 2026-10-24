import type { SvgPanel } from "../types.js";
import { frame } from "../../render/svg/primitives.js";

interface Signal { commits: number; prs: number; reviews: number; issues: number; streak: number; }

/** One sentence of numbers, read left to right, rather than five big-number tiles: the counts
 *  support the heatmap above them, they don't compete with it. Zero counts are dropped so the
 *  line never brags about "0 reviews". */
export const signalPanel: SvgPanel<Signal> = {
  id: "signal",
  kind: "svg",
  size: { w: 860, h: 58 },
  select: (ctx) => {
    const s: Signal = {
      commits: ctx.github.commits, prs: ctx.github.prs, reviews: ctx.github.reviews,
      issues: ctx.github.issues, streak: ctx.github.currentStreakDays,
    };
    const any = s.commits || s.prs || s.reviews || s.issues || s.streak;
    return any ? s : null;
  },
  render: (s, t, box) => {
    const parts: Array<[number, string]> = [
      [s.commits, "commits"], [s.prs, "pull requests"], [s.reviews, "reviews"],
      [s.issues, "issues"], [s.streak, "day streak"],
    ];
    const spans = parts
      .filter(([v]) => Number.isFinite(v) && v > 0)
      .map(([v, label], i) => `${i ? `<tspan fill="${t.accent}" dx="14">·</tspan><tspan dx="14"` : "<tspan"} font-family="OakDisplay,sans-serif" font-weight="800" font-size="20" fill="${t.ink}">${v.toLocaleString("en-US")}</tspan><tspan dx="6" fill="${t.mut}">${label}</tspan>`)
      .join("");
    return `${frame(box, t)}
<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2 + 7}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" letter-spacing="0.5">${spans}</text>`;
  },
};
