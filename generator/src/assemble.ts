import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderReadme } from "./render/markdown.js";
import { renderHeroSvg } from "./render/svg-hero.js";
import { composeCanvas } from "./render/compose.js";
import type { Snapshot } from "./panels/types.js";

const MIN_BYTES = 400;

const SECTION_MARKERS = [
  "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
  "<!-- section:engine-room -->", "<!-- section:numbers -->",
  "<!-- section:connect -->", "<!-- section:coda -->",
];
export { SECTION_MARKERS };

export function validateReadme(md: string): { ok: true } | { ok: false; reason: string } {
  if (Buffer.byteLength(md, "utf8") < MIN_BYTES) return { ok: false, reason: "too short" };
  for (const m of SECTION_MARKERS) if (!md.includes(m)) return { ok: false, reason: `missing ${m}` };
  if (md.includes("{{")) return { ok: false, reason: "unresolved token" };
  return { ok: true };
}

export function assemble(ctx: Snapshot): { readme: string; assets: Record<string, string> } {
  const assets: Record<string, string> = {
    "hero-dark.svg": renderHeroSvg("dark", ctx.fields.tagline),
    "hero-light.svg": renderHeroSvg("light", ctx.fields.tagline),
  };
  for (const theme of ["dark", "light"] as const) {
    const telemetry = composeCanvas("telemetry", ctx, theme, ["heatmap", "signal"]);
    if (telemetry) assets[`telemetry-${theme}.svg`] = telemetry;
    const craft = composeCanvas("craft", ctx, theme, ["languages", "waka"]);
    if (craft) assets[`craft-${theme}.svg`] = craft;
    const arena = composeCanvas("arena", ctx, theme, ["leetcode", "roadmap-gauge", "status"]);
    if (arena) assets[`arena-${theme}.svg`] = arena;
  }
  return { readme: renderReadme(ctx), assets };
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
