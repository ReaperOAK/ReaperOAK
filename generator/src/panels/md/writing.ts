import type { MarkdownPanel } from "../types.js";
import type { FeedItem } from "../../types.js";
import { escapeMd } from "../../render/escape.js";

/** Inert until FEED_URL is configured. Links stay markdown so they are clickable and indexed.
 *  Feed text is untrusted and reaches the README through here whether it was just parsed or
 *  read back from the cache, so title and date both go through escapeMd. */
export const writingPanel: MarkdownPanel<FeedItem[]> = {
  id: "writing",
  kind: "markdown",
  select: (ctx) => (ctx.feed && ctx.feed.length ? ctx.feed : null),
  render: (items) => `<!-- section:writing -->
### Writing

${items.map((i) => `- [${escapeMd(i.title)}](${i.url})${i.date ? ` — <sub>${escapeMd(i.date)}</sub>` : ""}`).join("\n")}`,
};
