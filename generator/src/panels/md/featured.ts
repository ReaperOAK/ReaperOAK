import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { RankedRepo } from "../../types.js";

/** The curated static list, used when GitHub answered with nothing rankable. */
function fromStatic(): RankedRepo[] {
  return content.featured.map((f) => ({
    name: f.title, url: f.url, description: f.problem, stack: f.stack, score: 0,
  }));
}

/** Unreleased products aren't GitHub repos, so rankRepos never sees them — reordering a
 *  ranked list alone would silently drop both. Curated live projects go first, then ranked
 *  repos. No de-duplication is needed: curated titles contain spaces and a GitHub repo name
 *  cannot. */
function curatedLive(): RankedRepo[] {
  return content.featured
    .filter((f) => f.live)
    .map((f) => ({ name: f.title, url: f.url, description: f.problem, stack: f.stack, score: 0 }));
}

/** A repo description is free text from GitHub and lands in a table cell: a `|` would start a
 *  new column and a newline would end the row. */
function cell(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
}

const MAX_ROWS = 6;

export const featuredPanel: MarkdownPanel<RankedRepo[]> = {
  id: "featured",
  kind: "markdown",
  select: (ctx) => {
    if (ctx.featured && ctx.featured.length) return [...curatedLive(), ...ctx.featured].slice(0, MAX_ROWS);
    return content.featured.length ? fromStatic() : null;
  },
  render: (repos, ctx) => {
    const rows = repos.map((r) => {
      // Own-property lookup only: a repo named `constructor` must not resolve to Object.prototype's.
      const own = Object.hasOwn(ctx.fields.featuredBlurbs, r.name) ? ctx.fields.featuredBlurbs[r.name] : undefined;
      const blurb = cell(own ?? r.description);
      const name = r.url ? `**[${r.name}](${r.url})**` : `**${r.name}**`;
      const stack = r.stack ? `\`${r.stack}\`` : "";
      return `| ${name} | ${blurb} | ${stack} |`;
    }).join("\n");
    return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
  },
};
