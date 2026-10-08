import type { SvgPanel } from "../types.js";
import type { WakaSnapshot } from "../../types.js";
import { bar, frame } from "../../render/svg/primitives.js";
import { escapeXml } from "../../render/svg-util.js";

const ROW_H = 30;

/** 27120 → "7h 32m"; 600 → "10m". Never prints a bare second count. */
export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const wakaPanel: SvgPanel<WakaSnapshot> = {
  id: "waka",
  kind: "svg",
  size: { w: 420, h: 220 },
  select: (ctx) => ctx.waka,
  render: (w, t, box) => {
    const rows = w.languages.map((l, i) => {
      const y = box.y + 46 + i * ROW_H;
      return `<text x="${box.x + 16}" y="${y}" font-family="ui-monospace,monospace" font-size="12" fill="${t.ink}">${escapeXml(l.name)}</text>
<text x="${box.x + box.w - 16}" y="${y}" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="${t.mut}">${formatDuration(l.seconds)}</text>
${bar({ x: box.x + 16, y: y + 6, w: box.w - 32, h: 6 }, l.pct, t)}`;
    }).join("\n");
    return `${frame(box, t, `wakatime · ${w.range}`)}\n${rows}`;
  },
};
