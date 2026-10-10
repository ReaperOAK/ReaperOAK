import type { SvgPanel } from "../types.js";
import type { LeetcodeSnapshot } from "../../types.js";
import { frame } from "../../render/svg/primitives.js";

/** Total solved as the headline, then one bar split by difficulty — the mix says more than
 *  three separate big numbers would. Global rank is deliberately not shown: a seven-digit
 *  rank reads as weakness, not signal. */
export const leetcodePanel: SvgPanel<LeetcodeSnapshot> = {
  id: "leetcode",
  kind: "svg",
  // 278, not the naive 280: three of these plus two 16px gaps (3*278 + 2*16 = 866) fit the
  // composer's 868px inner width in one row; 280 would push the third panel onto its own row.
  size: { w: 278, h: 190 },
  select: (ctx) => ctx.leetcode,
  render: (l, t, box) => {
    const x = box.x + 16, w = box.w - 32;
    const split: Array<[number, string, number]> = [
      [l.easy, "easy", 0.35], [l.medium, "medium", 0.7], [l.hard, "hard", 1],
    ];
    const sum = split.reduce((a, [v]) => a + (Number.isFinite(v) && v > 0 ? v : 0), 0);
    let cursor = x;
    const segments = sum > 0 ? split.map(([v, , op]) => {
      const sw = (w * (Number.isFinite(v) && v > 0 ? v : 0)) / sum;
      const r = `<rect x="${cursor}" y="${box.y + 104}" width="${Math.max(0, sw - 2)}" height="8" rx="2" fill="${t.accent}" fill-opacity="${op}"/>`;
      cursor += sw;
      return r;
    }).join("") : "";
    const legend = split.map(([v, label], i) =>
      `${i ? `<tspan fill="${t.mut}" dx="10">·</tspan><tspan dx="10"` : "<tspan"} fill="${t.ink}">${v}</tspan><tspan dx="5" fill="${t.mut}">${label}</tspan>`).join("");
    // frame() escapes its label itself -- passing an already-escaped handle here would
    // double-escape it (e.g. "&amp;lt;" instead of "&lt;"), so the raw handle goes straight in.
    return `${frame(box, t, `leetcode · ${l.handle}`)}
<text x="${x}" y="${box.y + 86}" font-family="OakDisplay,sans-serif" font-weight="800" font-size="48" fill="${t.accent}">${l.total}<tspan dx="10" font-family="ui-monospace,monospace" font-weight="400" font-size="12" fill="${t.mut}">solved</tspan></text>
${segments}
<text x="${x}" y="${box.y + 146}" font-family="ui-monospace,monospace" font-size="11">${legend}</text>`;
  },
};
