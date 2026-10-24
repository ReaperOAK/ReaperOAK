import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { CaseStudy } from "../../types.js";

function block(c: CaseStudy): string {
  const outcome = c.outcome ? `\n**Outcome** — ${c.outcome}\n` : "";
  return `<details>
<summary><b>${c.title}</b> — <code>${c.stack}</code></summary>

**Problem** — ${c.problem}

**Decision** — ${c.decision}

**Tradeoff** — ${c.tradeoff}
${outcome}
${c.url ? `[Open ${c.title} ↗](${c.url})\n` : ""}
</details>`;
}

export const casesPanel: MarkdownPanel<CaseStudy[]> = {
  id: "cases",
  kind: "markdown",
  select: () => (content.caseStudies.length ? content.caseStudies : null),
  render: (studies) => `<!-- section:cases -->
### Case studies

${studies.map(block).join("\n\n")}`,
};
