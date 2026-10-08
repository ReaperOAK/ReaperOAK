import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";

export const codaPanel: MarkdownPanel<string> = {
  id: "coda",
  kind: "markdown",
  select: () => content.humanLine || null,
  render: (line) => `<!-- section:coda -->
<div align="center"><sub>${line}</sub></div>`,
};
