import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { RankedRepo } from "../../types.js";
import { escapeMd } from "../../render/escape.js";
import { LEAK_PATTERN } from "../../render/leaks.js";

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

/** Ranked repos carry GitHub text (name, description, languages) that is printed verbatim, so a
 *  repo described as "NaN-safe math utilities" would put a leak in the README. A leaking name,
 *  url or stack cannot be shown honestly, so the repo is dropped and the next-ranked one takes
 *  its row. A leaking description is blanked instead: the row stays, with the empty "What it
 *  solves" cell a repo with no description already gets, rather than silently removing a
 *  project (possibly a pinned one) over one word. */
function usable(r: RankedRepo): RankedRepo | null {
  if (LEAK_PATTERN.test(`${r.name}\n${r.url}\n${r.stack}`)) return null;
  return LEAK_PATTERN.test(r.description) ? { ...r, description: "" } : r;
}

const MAX_ROWS = 6;

export const featuredPanel: MarkdownPanel<RankedRepo[]> = {
  id: "featured",
  kind: "markdown",
  select: (ctx) => {
    const ranked = (ctx.featured ?? []).flatMap((r) => usable(r) ?? []);
    if (ranked.length) return [...curatedLive(), ...ranked].slice(0, MAX_ROWS);
    return content.featured.length ? fromStatic() : null;
  },
  render: (repos, ctx) => {
    const rows = repos.map((r) => {
      // Own-property lookup only: a repo named `constructor` must not resolve to Object.prototype's.
      const own = Object.hasOwn(ctx.fields.featuredBlurbs, r.name) ? ctx.fields.featuredBlurbs[r.name] : undefined;
      const blurb = escapeMd(own ?? r.description);
      const name = r.url ? `**[${escapeMd(r.name)}](${r.url})**` : `**${escapeMd(r.name)}**`;
      const stack = r.stack ? `\`${escapeMd(r.stack)}\`` : "";
      return `| ${name} | ${blurb} | ${stack} |`;
    }).join("\n");
    return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
  },
};
