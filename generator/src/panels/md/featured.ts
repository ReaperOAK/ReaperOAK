import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { RankedRepo } from "../../types.js";

/** Ranked repos when GitHub answered; the curated static list otherwise. */
function fromStatic(ctx: { fields: { featuredBlurbs: Record<string, string> } }): RankedRepo[] {
  return content.featured.map((f) => ({
    name: f.title,
    url: f.url,
    description: ctx.fields.featuredBlurbs[f.title] ?? f.problem,
    stack: f.stack,
    score: 0,
  }));
}

/** Unreleased products aren't GitHub repos, so rankRepos never sees them — reordering a
 *  ranked list alone would silently drop both. Curated live projects go first, then ranked
 *  repos, skipping any ranked repo whose name already matches a curated title. */
function curatedLive(): RankedRepo[] {
  return content.featured
    .filter((f) => f.live)
    .map((f) => ({ name: f.title, url: f.url, description: f.problem, stack: f.stack, score: 0 }));
}

const MAX_ROWS = 6;

export const featuredPanel: MarkdownPanel<RankedRepo[]> = {
  id: "featured",
  kind: "markdown",
  select: (ctx) => {
    if (ctx.featured && ctx.featured.length) {
      const curated = curatedLive();
      const curatedNames = new Set(curated.map((c) => c.name.toLowerCase()));
      const rest = ctx.featured.filter((r) => !curatedNames.has(r.name.toLowerCase()));
      return [...curated, ...rest].slice(0, MAX_ROWS);
    }
    return content.featured.length ? fromStatic(ctx) : null;
  },
  render: (repos, ctx) => {
    const rows = repos.map((r) => {
      const blurb = ctx.fields.featuredBlurbs[r.name] ?? r.description;
      const name = r.url ? `**[${r.name}](${r.url})**` : `**${r.name}**`;
      return `| ${name} | ${blurb} | \`${r.stack}\` |`;
    }).join("\n");
    return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
  },
};
