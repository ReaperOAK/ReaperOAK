import type { SvgPanel } from "../types.js";
import type { LanguageShare } from "../../types.js";
import { bar, frame } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

const ROW_H = 30;

export const languagesPanel: SvgPanel<LanguageShare[]> = {
  id: "languages",
  kind: "svg",
  size: { w: 420, h: 220 },
  select: (ctx) => (ctx.languages && ctx.languages.length ? ctx.languages : null),
  render: (shares, t, box) => {
    const rows = shares.map((s, i) => {
      const y = box.y + 46 + i * ROW_H;
      return `<text x="${box.x + 16}" y="${y}" font-family="ui-monospace,monospace" font-size="12" fill="${t.ink}">${escapeXml(s.name)}</text>
<text x="${box.x + box.w - 16}" y="${y}" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="${t.mut}">${s.pct.toFixed(1)}%</text>
${bar({ x: box.x + 16, y: y + 6, w: box.w - 32, h: 6 }, s.pct, t, s.color)}`;
    }).join("\n");
    return `${frame(box, t, "language mix · weighted by recency")}\n${rows}`;
  },
};
