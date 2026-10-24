import type { MarkdownPanel, Panel, Snapshot, SvgPanel } from "./types.js";
import { currentlyPanel } from "./md/currently.js";
import { featuredPanel } from "./md/featured.js";
import { casesPanel } from "./md/cases.js";
import { roadmapPanel } from "./md/roadmap.js";
import { howPanel } from "./md/how.js";
import { logPanel } from "./md/log.js";
import { writingPanel } from "./md/writing.js";
import { stackPanel } from "./md/stack.js";
import { numbersPanel } from "./md/numbers.js";
import { connectPanel } from "./md/connect.js";
import { codaPanel } from "./md/coda.js";
import { telemetryPanel } from "./md/telemetry.js";
import { heatmapPanel } from "./svg/heatmap.js";
import { signalPanel } from "./svg/signal.js";
import { craftPanel } from "./md/craft.js";
import { languagesPanel } from "./svg/languages.js";
import { wakaPanel } from "./svg/waka.js";
import { arenaPanel } from "./md/arena.js";
import { leetcodePanel } from "./svg/leetcode.js";
import { roadmapGaugePanel } from "./svg/roadmapGauge.js";
import { statusPanel } from "./svg/status.js";

/** The registry. Order here is the order on the page. */
export const PANELS: Panel[] = [
  currentlyPanel,
  telemetryPanel,
  craftPanel,
  arenaPanel,
  featuredPanel,
  logPanel,
  casesPanel,
  roadmapPanel,
  howPanel,
  writingPanel,
  stackPanel,
  numbersPanel,
  connectPanel,
  codaPanel,
  heatmapPanel,
  signalPanel,
  languagesPanel,
  wakaPanel,
  leetcodePanel,
  roadmapGaugePanel,
  statusPanel,
];

export interface RenderedMarkdown { id: string; body: string; }
export interface ResolvedSvg { id: string; data: unknown; panel: SvgPanel<unknown>; }

/** Runs select() on each markdown panel and drops the ones with nothing to say. */
export function activeMarkdownPanels(
  ctx: Snapshot,
  panels: Panel[] = PANELS,
): RenderedMarkdown[] {
  const out: RenderedMarkdown[] = [];
  for (const p of panels) {
    if (p.kind !== "markdown") continue;
    const panel = p as MarkdownPanel<unknown>;
    const data = panel.select(ctx);
    if (data === null || data === undefined) continue;
    out.push({ id: panel.id, body: panel.render(data, ctx) });
  }
  return out;
}

/** Resolves svg panels to (panel, data) pairs, dropping the ones with nothing to say. */
export function activeSvgPanels(ctx: Snapshot, panels: Panel[] = PANELS): ResolvedSvg[] {
  const out: ResolvedSvg[] = [];
  for (const p of panels) {
    if (p.kind !== "svg") continue;
    const panel = p as SvgPanel<unknown>;
    const data = panel.select(ctx);
    if (data === null || data === undefined) continue;
    out.push({ id: panel.id, data, panel });
  }
  return out;
}
