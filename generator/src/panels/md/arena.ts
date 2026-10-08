import type { MarkdownPanel } from "../types.js";
import { leetcodePanel } from "../svg/leetcode.js";
import { roadmapGaugePanel } from "../svg/roadmapGauge.js";
import { statusPanel } from "../svg/status.js";

export const arenaPanel: MarkdownPanel<true> = {
  id: "arena",
  kind: "markdown",
  select: (ctx) =>
    leetcodePanel.select(ctx) !== null
    || roadmapGaugePanel.select(ctx) !== null
    || statusPanel.select(ctx) !== null
      ? true : null,
  render: () => `<!-- section:arena -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/arena-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/arena-light.svg">
  <img alt="Problem solving progress and deploy status" src="assets/arena-dark.svg" width="900">
</picture>
</div>`,
};
