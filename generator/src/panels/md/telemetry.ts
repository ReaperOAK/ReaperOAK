import type { MarkdownPanel } from "../types.js";
import { heatmapPanel } from "../svg/heatmap.js";
import { signalPanel } from "../svg/signal.js";

/**
 * Emits the <picture> block for the telemetry canvas. Omits itself when neither
 * of that canvas's svg panels has data, so the README never points at a file
 * assemble() did not write.
 */
export const telemetryPanel: MarkdownPanel<true> = {
  id: "telemetry",
  kind: "markdown",
  select: (ctx) =>
    heatmapPanel.select(ctx) !== null || signalPanel.select(ctx) !== null ? true : null,
  render: () => `<!-- section:telemetry -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/telemetry-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/telemetry-light.svg">
  <img alt="GitHub telemetry — contributions, pull requests, reviews, issues, streak" src="assets/telemetry-dark.svg" width="900">
</picture>
</div>`,
};
