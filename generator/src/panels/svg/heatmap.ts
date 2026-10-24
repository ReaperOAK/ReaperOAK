import type { SvgPanel } from "../types.js";
import { frame, heatGrid, heatMonths } from "../../render/svg/primitives.js";

type Day = { date: string; count: number };

export const heatmapPanel: SvgPanel<Day[]> = {
  id: "heatmap",
  kind: "svg",
  size: { w: 860, h: 182 },
  // A year of zeros is no data: an empty grid would read as "did nothing", which isn't what
  // the source said — it said nothing. Omit the panel instead.
  select: (ctx) => (ctx.github.calendar.some((d) => d.count > 0) ? ctx.github.calendar : null),
  render: (days, t, box) => {
    const inner = { x: box.x + 16, w: box.w - 32 };
    return `${frame(box, t, "contributions · last 12 months")}
${heatMonths({ ...inner, y: box.y + 50, h: 12 }, days, t)}
${heatGrid({ ...inner, y: box.y + 60, h: box.h - 76 }, days, t)}`;
  },
};
