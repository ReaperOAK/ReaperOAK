import type { MarkdownPanel } from "../types.js";
import type { FeedItem } from "../../types.js";

/** Inert until FEED_URL is configured. Links stay markdown so they are clickable and indexed. */
export const writingPanel: MarkdownPanel<FeedItem[]> = {
  id: "writing",
  kind: "markdown",
  select: (ctx) => (ctx.feed && ctx.feed.length ? ctx.feed : null),
  render: (items) => `<!-- section:writing -->
### Writing

${items.map((i) => `- [${i.title}](${i.url})${i.date ? ` — <sub>${i.date}</sub>` : ""}`).join("\n")}`,
};
