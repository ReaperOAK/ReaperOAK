import { content } from "../content.js";
import { activeMarkdownPanels } from "../panels/index.js";
import type { Snapshot } from "../panels/types.js";

/** Hero is still hand-written here; the panel registry covers everything else. */
function hero(): string {
  return `<!-- section:hero -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/hero-light.svg">
  <img alt="ReaperOAK — ${content.fullName}" src="assets/hero-dark.svg" width="900">
</picture>
</div>`;
}

export function renderReadme(ctx: Snapshot): string {
  const panels = activeMarkdownPanels(ctx);
  const byId = (id: string) => panels.find((p) => p.id === id)?.body;
  const ordered = [
    hero(),
    byId("currently"),
    byId("telemetry"),
    byId("craft"),
    byId("arena"),
    byId("featured"),
    byId("log"),
    byId("cases"),
    byId("roadmap"),
    byId("engine-room"),
    byId("numbers"),
    byId("how"),
    byId("writing"),
    byId("connect"),
    byId("coda"),
  ].filter((s): s is string => Boolean(s));
  return ordered.join("\n\n---\n\n") + "\n";
}
