import type { SvgPanel } from "../types.js";
import { frame, heatGrid } from "../../render/svg/primitives.js";

type Day = { date: string; count: number };

export const heatmapPanel: SvgPanel<Day[]> = {
  id: "heatmap",
  kind: "svg",
  size: { w: 860, h: 130 },
  select: (ctx) => (ctx.github.calendar.length ? ctx.github.calendar : null),
  render: (days, t, box) => `${frame(box, t, "contributions · last 12 months")}
${heatGrid({ x: box.x + 16, y: box.y + 38, w: box.w - 32, h: box.h - 54 }, days, t)}`,
};
