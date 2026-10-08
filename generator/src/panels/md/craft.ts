import type { MarkdownPanel } from "../types.js";
import { languagesPanel } from "../svg/languages.js";
import { wakaPanel } from "../svg/waka.js";

export const craftPanel: MarkdownPanel<true> = {
  id: "craft",
  kind: "markdown",
  select: (ctx) =>
    languagesPanel.select(ctx) !== null || wakaPanel.select(ctx) !== null ? true : null,
  render: () => `<!-- section:craft -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/craft-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/craft-light.svg">
  <img alt="Language mix and coding time" src="assets/craft-dark.svg" width="900">
</picture>
</div>`,
};
