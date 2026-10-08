import type { MarkdownPanel } from "../types.js";
import type { FeedItem } from "../../types.js";

const ESCAPES: Record<string, string> = {
  "<": "&lt;", ">": "&gt;", "[": "\\[", "]": "\\]", "\\": "\\\\",
};

/** Feed text is untrusted and reaches the README through here whether it was just parsed or
 *  read back from the cache. `<`/`>` stop it injecting HTML; `[`, `]` and `\` stop it closing
 *  `[title](url)` early (an unescaped backslash would defeat the bracket escapes). */
function escapeMd(s: string): string {
  return s.replace(/[<>[\]\\]/g, (c) => ESCAPES[c] ?? c);
}

/** Inert until FEED_URL is configured. Links stay markdown so they are clickable and indexed. */
export const writingPanel: MarkdownPanel<FeedItem[]> = {
  id: "writing",
  kind: "markdown",
  select: (ctx) => (ctx.feed && ctx.feed.length ? ctx.feed : null),
  render: (items) => `<!-- section:writing -->
### Writing

${items.map((i) => `- [${escapeMd(i.title)}](${i.url})${i.date ? ` — <sub>${escapeMd(i.date)}</sub>` : ""}`).join("\n")}`,
};
