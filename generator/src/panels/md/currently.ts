import type { MarkdownPanel } from "../types.js";
import type { DynamicFields } from "../../types.js";

export const currentlyPanel: MarkdownPanel<DynamicFields> = {
  id: "currently",
  kind: "markdown",
  select: (ctx) => ctx.fields,
  render: (f) => `<!-- section:currently -->
### Currently

- **Building** a GenAI Media Platform and a Creator Marketplace at Cornflakes Media.
- **This cycle** — ${f.recentWork}
- **Thinking about** — ${f.thinkingAbout}`,
};
