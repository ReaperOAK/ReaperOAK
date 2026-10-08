import type { SvgPanel } from "../types.js";
import type { LeetcodeSnapshot } from "../../types.js";
import { counter, frame } from "../../render/svg/primitives.js";

export const leetcodePanel: SvgPanel<LeetcodeSnapshot> = {
  id: "leetcode",
  kind: "svg",
  // 278, not the naive 280: three of these plus two 16px gaps (3*278 + 2*16 = 866) fit the
  // composer's 868px inner width in one row; 280 would push the third panel onto its own row.
  size: { w: 278, h: 190 },
  select: (ctx) => ctx.leetcode,
  render: (l, t, box) => {
    const split: Array<[number, string]> = [[l.easy, "easy"], [l.medium, "med"], [l.hard, "hard"]];
    const step = box.w / split.length;
    const cells = split.map(([v, label], i) =>
      counter(box.x + step * (i + 0.5), box.y + 148, String(v), label, t)).join("\n");
    // ranking is decorative and may be absent (getLeetcode degrades it to null rather than
    // fabricating a number) -- omit the line entirely instead of printing "rank null".
    const rank = l.ranking !== null
      ? `<text x="${box.x + box.w / 2}" y="${box.y + 100}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}">rank ${l.ranking.toLocaleString("en-US")}</text>`
      : "";
    // frame() escapes its label itself -- passing an already-escaped handle here would
    // double-escape it (e.g. "&amp;lt;" instead of "&lt;"), so the raw handle goes straight in.
    return `${frame(box, t, `leetcode · ${l.handle}`)}
<text x="${box.x + box.w / 2}" y="${box.y + 80}" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="44" fill="${t.accent}">${l.total}</text>
${rank}
${cells}`;
  },
};
