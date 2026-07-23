import { content } from "../content.js";
import type { DynamicFields, GithubSnapshot, FeaturedItem } from "../types.js";

export const SECTION_MARKERS = [
  "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
  "<!-- section:engine-room -->", "<!-- section:numbers -->", "<!-- section:stats -->",
  "<!-- section:connect -->", "<!-- section:coda -->",
];

function hero(fields: DynamicFields): string {
  return `<!-- section:hero -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/hero-light.svg">
  <img alt="ReaperOAK — ${content.fullName}" src="assets/hero-dark.svg" width="900">
</picture>
</div>`;
}

function currently(fields: DynamicFields): string {
  return `<!-- section:currently -->
### Currently

- **Building** [Pindow](https://pindow.ai) and [Crosbird](https://www.crosbird.com/) at Cornflakes Media.
- **This cycle** — ${fields.recentWork}
- **Thinking about** — ${fields.thinkingAbout}`;
}

function blurb(f: FeaturedItem, fields: DynamicFields): string {
  return fields.featuredBlurbs[f.title] ?? f.problem;
}

function featured(fields: DynamicFields): string {
  const rows = content.featured.map((f) => {
    const name = f.live ? `**[${f.title} ↗](${f.url})**` : `**[${f.title}](${f.url})**`;
    return `| ${name} | ${blurb(f, fields)} | \`${f.stack}\` |`;
  }).join("\n");
  return `<!-- section:featured -->
### Featured

| Project | What it solves | Stack |
|---------|----------------|-------|
${rows}`;
}

function engineRoom(): string {
  const lines = content.stackGroups.map((g) => `- **${g.heading}** — ${g.items.join(" · ")}`).join("\n");
  return `<!-- section:engine-room -->
### The Engine Room

${lines}`;
}

function numbers(): string {
  const cells = content.numbers.map((n) => `\`${n.value}\` ${n.label}`).join("  ·  ");
  return `<!-- section:numbers -->
### Selected numbers

${cells}`;
}

function stats(): string {
  return `<!-- section:stats -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/stats-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/stats-light.svg">
  <img alt="GitHub activity" src="assets/stats-dark.svg" width="900">
</picture>
</div>`;
}

function connect(): string {
  const links = content.contacts.map((c) => `[${c.label}](${c.url})`).join(" • ");
  return `<!-- section:connect -->
### Connect

${links}`;
}

function coda(): string {
  return `<!-- section:coda -->
<div align="center"><sub>${content.humanLine}</sub></div>`;
}

export function renderReadme(fields: DynamicFields, snap: GithubSnapshot): string {
  return [
    hero(fields), currently(fields), featured(fields), engineRoom(),
    numbers(), stats(), connect(), coda(),
  ].join("\n\n---\n\n") + "\n";
}
