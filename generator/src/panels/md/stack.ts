import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { StatGroup } from "../../types.js";

export const stackPanel: MarkdownPanel<StatGroup[]> = {
  id: "engine-room",
  kind: "markdown",
  select: (ctx) => {
    // Measured mix replaces the hand-written Languages row; every other row is curated.
    const rest = content.stackGroups.filter((g) => g.heading !== "Languages");
    if (ctx.languages && ctx.languages.length) {
      const measured: StatGroup = {
        heading: "Languages · measured",
        items: ctx.languages.map((l) => `${l.name} ${Math.round(l.pct)}%`),
      };
      return [measured, ...rest];
    }
    return content.stackGroups.length ? content.stackGroups : null;
  },
  render: (groups) => `<!-- section:engine-room -->
### The Engine Room

${groups.map((g) => `- **${g.heading}** — ${g.items.join(" · ")}`).join("\n")}`,
};
