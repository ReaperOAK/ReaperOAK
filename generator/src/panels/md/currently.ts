import type { MarkdownPanel } from "../types.js";
import type { DynamicFields } from "../../types.js";

export const currentlyPanel: MarkdownPanel<DynamicFields> = {
  id: "currently",
  kind: "markdown",
  select: (ctx) => ctx.fields,
  render: (f) => `<!-- section:currently -->
### Currently

- **Focusing on** distributed systems, autonomous AI agents, and backend infrastructure.
- **This cycle** — ${f.recentWork}
- **Thinking about** — ${f.thinkingAbout}`,
};
