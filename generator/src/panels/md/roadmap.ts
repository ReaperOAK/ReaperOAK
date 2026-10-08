import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { RoadmapTopic } from "../../types.js";

/** Ten-cell text bar. Markdown, not an image, so it stays readable and copyable.
 *  Guards non-finite input (NaN, Infinity) to 0 — a bad percentage renders as an
 *  empty bar, never a crash from `"█".repeat(NaN)` or a printed "NaN%"/"Infinity%". */
function textBar(pct: number): string {
  const safe = Number.isFinite(pct) ? pct : 0;
  const filled = Math.round(Math.min(100, Math.max(0, safe)) / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** No honest percentage yet → "ongoing", not an invented number. */
function progressCell(progress: number | undefined): string {
  if (progress === undefined) return "ongoing";
  const safe = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0; // label matches the clamped bar
  return `\`${textBar(safe)}\` ${Math.round(safe)}%`;
}

export const roadmapPanel: MarkdownPanel<RoadmapTopic[]> = {
  id: "roadmap",
  kind: "markdown",
  select: () => (content.roadmapTopics.length ? content.roadmapTopics : null),
  render: (topics, ctx) => {
    const rows = topics.map((t) =>
      `| **${t.name}** | ${t.detail} | ${progressCell(t.progress)} |`).join("\n");

    // Live row, derived from the submissions repo. Absent when that read failed —
    // better no row than a stale count presented as current.
    const neetcode = ctx.neetcode;
    let neetRow = "";
    if (neetcode) {
      // target 0 or otherwise non-finite → textBar's own guard renders an empty bar;
      // solved/target below are the raw numbers, never derived from this ratio.
      const pct = (neetcode.solved / neetcode.target) * 100;
      neetRow = `\n| **NeetCode 150** | Pattern coverage, one directory per problem | \`${textBar(pct)}\` ${neetcode.solved} / ${neetcode.target} |`;
    }

    return `<!-- section:roadmap -->
### Deliberate practice

| Track | What that means | Progress |
|---|---|---|
${rows}${neetRow}`;
  },
};
