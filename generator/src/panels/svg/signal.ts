import type { SvgPanel } from "../types.js";
import { counter, frame } from "../../render/svg/primitives.js";

interface Signal { commits: number; prs: number; reviews: number; issues: number; streak: number; }

export const signalPanel: SvgPanel<Signal> = {
  id: "signal",
  kind: "svg",
  size: { w: 860, h: 110 },
  select: (ctx) => {
    const s: Signal = {
      commits: ctx.github.commits, prs: ctx.github.prs, reviews: ctx.github.reviews,
      issues: ctx.github.issues, streak: ctx.github.currentStreakDays,
    };
    const any = s.commits || s.prs || s.reviews || s.issues || s.streak;
    return any ? s : null;
  },
  render: (s, t, box) => {
    const cells: Array<[number, string]> = [
      [s.commits, "commits"], [s.prs, "PRs"], [s.reviews, "reviews"],
      [s.issues, "issues"], [s.streak, "streak"],
    ];
    const step = box.w / cells.length;
    const body = cells.map(([v, label], i) =>
      counter(box.x + step * (i + 0.5), box.y + 62, v.toLocaleString("en-US"), label, t),
    ).join("\n");
    return `${frame(box, t, "signal")}\n${body}`;
  },
};
