import { THEME, fontFaceStyle } from "./svg-util.js";
import { activeSvgPanels, PANELS } from "../panels/index.js";
import type { ResolvedSvg } from "../panels/index.js";
import type { Box, Panel, Snapshot } from "../panels/types.js";

const CANVAS_W = 900;
const PAD = 16;
const INNER_W = CANVAS_W - PAD * 2;

/**
 * Greedily wraps active panels into rows by their preferred width: a row fills with
 * panels in order while size.w (plus the inter-panel gap) still fits the inner width;
 * a panel that does not fit starts a new row. Minimal by design — no layout engine.
 */
function packRows(active: ResolvedSvg[]): ResolvedSvg[][] {
  const rows: ResolvedSvg[][] = [];
  let row: ResolvedSvg[] = [];
  let rowW = 0;
  for (const p of active) {
    const nextW = rowW === 0 ? p.panel.size.w : rowW + PAD + p.panel.size.w;
    if (rowW > 0 && nextW > INNER_W) {
      rows.push(row);
      row = [p];
      rowW = p.panel.size.w;
    } else {
      row.push(p);
      rowW = nextW;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/**
 * Packs the named panels into one dual-theme canvas, wrapping into rows by preferred
 * width (see packRows). Active panels within a row still share that row's width
 * equally, so a canvas whose row-mate dropped out widens the survivor rather than
 * leaving a hole. Canvas height is the sum of row heights (each row's height is its
 * tallest panel) plus padding between and around rows.
 * Returns null when nothing is active — the caller then writes no file.
 */
export function composeCanvas(
  name: string,
  ctx: Snapshot,
  theme: "dark" | "light",
  panelIds: string[],
  registry: Panel[] = PANELS,
): string | null {
  const wanted = new Set(panelIds);
  const active = activeSvgPanels(ctx, registry).filter((p) => wanted.has(p.id));
  if (active.length === 0) return null;

  const t = THEME[theme];
  const rows = packRows(active);
  const rowHeights = rows.map((row) => Math.max(...row.map((p) => p.panel.size.h)));
  const height = PAD * (rows.length + 1) + rowHeights.reduce((a, b) => a + b, 0);

  let y = PAD;
  const body = rows.map((row, ri) => {
    const rowH = rowHeights[ri]!;
    const each = (INNER_W - PAD * (row.length - 1)) / row.length;
    const rowBody = row.map((p, i) => {
      const box: Box = { x: PAD + i * (each + PAD), y, w: each, h: rowH };
      return p.panel.render(p.data, t, box);
    }).join("\n");
    y += rowH + PAD;
    return rowBody;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${height}" viewBox="0 0 ${CANVAS_W} ${height}" role="img" aria-label="${name}">
${fontFaceStyle()}
<rect width="${CANVAS_W}" height="${height}" fill="${t.bg}"/>
${body}
</svg>`;
}
