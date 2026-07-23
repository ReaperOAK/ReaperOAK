import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Tokens { bg: string; panel: string; ink: string; mut: string; accent: string; accent2: string; line: string; }

export const THEME: { dark: Tokens; light: Tokens } = {
  dark:  { bg: "#0B0B0D", panel: "#0E0E11", ink: "#ECE7DE", mut: "#8F887B", accent: "#E8A33D", accent2: "#C77B30", line: "rgba(255,255,255,0.08)" },
  light: { bg: "#FBF8F2", panel: "#FFFFFF", ink: "#1A1712", mut: "#6B6459", accent: "#C77B30", accent2: "#A15E1E", line: "rgba(0,0,0,0.10)" },
};

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

let cachedFont: string | null = null;
function fontBase64(): string {
  if (cachedFont) return cachedFont;
  const here = fileURLToPath(new URL(".", import.meta.url));
  const p = resolve(here, "..", "..", "assets-fonts", "Sora.ttf");
  cachedFont = readFileSync(p).toString("base64");
  return cachedFont;
}

/** A <style> block embedding the display font so SVG text renders crisply on GitHub. */
export function fontFaceStyle(): string {
  return `<style>@font-face{font-family:'OakDisplay';font-weight:400 800;` +
    `src:url(data:font/ttf;base64,${fontBase64()}) format('truetype');}</style>`;
}
