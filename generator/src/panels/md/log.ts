import type { MarkdownPanel } from "../types.js";

export const logPanel: MarkdownPanel<string[]> = {
  id: "log",
  kind: "markdown",
  // No LLM, no cache, no log. An invented changelog is worse than no section.
  select: (ctx) => (ctx.fields.engineeringLog.length ? ctx.fields.engineeringLog : null),
  render: (lines) => `<!-- section:log -->
### Engineering log

${lines.map((l) => `- ${l}`).join("\n")}`,
};
