import type { SvgPanel } from "../types.js";
import type { UptimeResult } from "../../types.js";
import { frame, statusDot } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

const ROW_H = 26;
const MAX_ROWS = 4; // the panel is a fixed 190px tall; more rows than this would overflow it

export const statusPanel: SvgPanel<UptimeResult[]> = {
  id: "status",
  kind: "svg",
  size: { w: 278, h: 190 }, // see leetcode.ts: sized so all three arena panels share one row
  select: (ctx) => (ctx.uptime && ctx.uptime.length ? ctx.uptime : null),
  render: (rows, t, box) => {
    const body = rows.slice(0, MAX_ROWS).map((r, i) => {
      const y = box.y + 52 + i * ROW_H;
      const ok = r.status !== null && r.status < 400;
      // An unreachable target prints an em dash. Never a fabricated status code.
      const reading = r.status === null ? "—" : String(r.status);
      return `${statusDot(box.x + 22, y - 4, ok, t)}
<text x="${box.x + 36}" y="${y}" font-family="ui-monospace,monospace" font-size="11" fill="${t.ink}">${escapeXml(r.label)}</text>
<text x="${box.x + box.w - 16}" y="${y}" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${t.mut}">${reading}</text>`;
    }).join("\n");
    return `${frame(box, t, "system status")}\n${body}`;
  },
};
