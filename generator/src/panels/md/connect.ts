import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { ContactLink } from "../../types.js";

export const connectPanel: MarkdownPanel<ContactLink[]> = {
  id: "connect",
  kind: "markdown",
  select: () => (content.contacts.length ? content.contacts : null),
  render: (links) => `<!-- section:connect -->
### Connect

${links.map((c) => `[${c.label}](${c.url})`).join(" • ")}`,
};
