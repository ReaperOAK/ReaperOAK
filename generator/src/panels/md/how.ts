import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";

export const howPanel: MarkdownPanel<string[]> = {
  id: "how",
  kind: "markdown",
  select: () => (content.principles.length ? content.principles : null),
  render: (principles) => `<!-- section:how -->
### How I work

${principles.map((p) => `- ${p}`).join("\n")}`,
};
