import type { Tokens } from "../svg-util.js";
import { escapeXml } from "../svg-util.js";
import type { Box } from "../../panels/types.js";

/** A titled panel frame. The label is optional; omit it for a bare container. */
export function frame(box: Box, t: Tokens, label?: string): string {
  const title = label
    ? `<text x="${box.x + 16}" y="${box.y + 24}" font-family="ui-monospace,monospace" font-size="11" letter-spacing="2" fill="${t.mut}">${escapeXml(label.toUpperCase())}</text>`
    : "";
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="14" fill="${t.panel}" stroke="${t.line}"/>${title}`;
}

/** A big number over a small caption, centred on x. */
export function counter(x: number, y: number, value: string, label: string, t: Tokens): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="34" fill="${t.accent}">${escapeXml(value)}</text>
<text x="${x}" y="${y + 22}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" letter-spacing="1" fill="${t.mut}">${escapeXml(label)}</text>`;
}

/** A horizontal progress bar. pct is clamped to 0..100. */
export function bar(box: Box, pct: number, t: Tokens, color?: string): string {
  const safe = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const w = (box.w * safe) / 100;
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.h / 2}" fill="${t.line}"/>
<rect x="${box.x}" y="${box.y}" width="${w}" height="${box.h}" rx="${box.h / 2}" fill="${escapeXml(color ?? t.accent)}" class="bar-fill"/>`;
}

/** Five-step amber ramp from panel background to full accent. Steps 1-4 always land
 *  in range, since count > 0 here and the ratio is clamped to at most 4. `!(count > 0)`
 *  (rather than `count <= 0`) also catches NaN, which a corrupted cache entry can produce. */
const HEAT_OPACITY = [0, 0.25, 0.45, 0.7, 1];
function heatColor(count: number, max: number, t: Tokens): string {
  // An empty day is a faint cell, not a hole: the grid's rhythm is what makes the year readable.
  if (!(count > 0)) return t.line;
  const step = Math.min(4, Math.ceil((count / Math.max(1, max)) * 4));
  const opacity = HEAT_OPACITY[step]!;
  return `${t.accent}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
}

/** GitHub-style contribution grid, laid out in columns of seven. */
export function heatGrid(box: Box, days: Array<{ date: string; count: number }>, t: Tokens): string {
  if (days.length === 0) return "";
  const cols = Math.ceil(days.length / 7);
  const gap = 3;
  // Fill the panel's width (capped so a short calendar doesn't balloon), then centre the grid.
  const cell = Math.max(0, Math.min(14, Math.floor((box.w - (cols - 1) * gap) / Math.max(1, cols))));
  const left = box.x + Math.max(0, (box.w - (cols * (cell + gap) - gap)) / 2);
  // A non-finite count on any one day must not poison the ratio for every other day's cell.
  const max = Math.max(0, ...days.map((d) => (Number.isFinite(d.count) ? d.count : 0)));
  return days.map((d, i) => {
    const x = left + Math.floor(i / 7) * (cell + gap);
    const y = box.y + (i % 7) * (cell + gap);
    // The tooltip renders this count as text, so it needs the same non-finite guard as the fill.
    const safeCount = Number.isFinite(d.count) ? d.count : 0;
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${heatColor(d.count, max, t)}"><title>${escapeXml(d.date)}: ${safeCount}</title></rect>`;
  }).join("");
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month names above the heat grid, placed on the column where each month starts. Uses the
 *  same geometry as heatGrid so labels and cells always line up. Skips a label that would
 *  crowd the previous one (the first partial month usually). */
export function heatMonths(box: Box, days: Array<{ date: string; count: number }>, t: Tokens): string {
  if (days.length === 0) return "";
  const cols = Math.ceil(days.length / 7);
  const gap = 3;
  const cell = Math.max(0, Math.min(14, Math.floor((box.w - (cols - 1) * gap) / Math.max(1, cols))));
  const left = box.x + Math.max(0, (box.w - (cols * (cell + gap) - gap)) / 2);
  const out: string[] = [];
  let lastMonth = -1, lastX = -Infinity;
  for (let c = 0; c < cols; c++) {
    const m = Number((days[c * 7]?.date ?? "").slice(5, 7)) - 1;
    if (!(m >= 0 && m < 12) || m === lastMonth) continue;
    lastMonth = m;
    const x = left + c * (cell + gap);
    if (x - lastX < 3 * (cell + gap)) continue;
    lastX = x;
    out.push(`<text x="${x}" y="${box.y}" font-family="ui-monospace,monospace" font-size="10" fill="${t.mut}">${MONTH_ABBR[m]}</text>`);
  }
  return out.join("");
}

/** A labelled progress readout: "51 / 150" over a bar. value is clamped to target. */
export function gauge(box: Box, value: number, target: number, t: Tokens): string {
  const safeTarget = target > 0 ? target : 1;
  const safeValue = Math.min(safeTarget, Math.max(0, Number.isFinite(value) ? value : 0));
  const pct = (safeValue / safeTarget) * 100;
  return `<text x="${box.x}" y="${box.y + 14}" font-family="OakDisplay,sans-serif" font-weight="800" font-size="20" fill="${t.ink}">${safeValue}<tspan fill="${t.mut}" font-size="13"> / ${safeTarget}</tspan></text>
${bar({ x: box.x, y: box.y + 26, w: box.w, h: 8 }, pct, t)}`;
}

/** Filled dot for up, hollow ring for down. */
export function statusDot(x: number, y: number, ok: boolean, t: Tokens): string {
  return ok
    ? `<circle cx="${x}" cy="${y}" r="4" fill="${t.accent}"/>`
    : `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${t.mut}" stroke-width="1.5"/>`;
}
