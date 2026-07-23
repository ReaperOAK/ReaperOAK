import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DynamicFields, GithubSnapshot } from "./types.js";
import { renderReadme, SECTION_MARKERS } from "./render/markdown.js";
import { renderHeroSvg } from "./render/svg-hero.js";
import { renderStatsSvg } from "./render/svg-stats.js";

const MIN_BYTES = 400;

export function validateReadme(md: string): { ok: true } | { ok: false; reason: string } {
  if (Buffer.byteLength(md, "utf8") < MIN_BYTES) return { ok: false, reason: "too short" };
  for (const m of SECTION_MARKERS) if (!md.includes(m)) return { ok: false, reason: `missing ${m}` };
  if (md.includes("{{")) return { ok: false, reason: "unresolved token" };
  return { ok: true };
}

export function assemble(fields: DynamicFields, snap: GithubSnapshot): { readme: string; assets: Record<string, string> } {
  return {
    readme: renderReadme(fields, snap),
    assets: {
      "hero-dark.svg": renderHeroSvg("dark", fields.tagline),
      "hero-light.svg": renderHeroSvg("light", fields.tagline),
      "stats-dark.svg": renderStatsSvg("dark", snap),
      "stats-light.svg": renderStatsSvg("light", snap),
    },
  };
}

/** Validates before overwriting README. Throws if invalid so main() can exit non-zero
 *  and leave the previous README untouched. */
export function writeOutputs(root: string, built: { readme: string; assets: Record<string, string> }): void {
  const check = validateReadme(built.readme);
  if (!check.ok) throw new Error(`readme validation failed: ${check.reason}`);
  const assetsDir = join(root, "assets");
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });
  for (const [name, svg] of Object.entries(built.assets)) writeFileSync(join(assetsDir, name), svg, "utf8");
  writeFileSync(join(root, "README.md"), built.readme, "utf8"); // written last, only after assets + validation
}
