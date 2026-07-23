import { THEME, fontFaceStyle } from "./svg-util.js";
import type { GithubSnapshot } from "../types.js";

export function renderStatsSvg(theme: "dark" | "light", snap: GithubSnapshot): string {
  const t = THEME[theme];
  const W = 900, H = 140;
  const total = snap.totalContributions.toLocaleString("en-US");
  const cell = (x: number, value: string, label: string) => `
<text x="${x}" y="70" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="46" fill="${t.accent}">${value}</text>
<text x="${x}" y="100" text-anchor="middle" font-family="ui-monospace,monospace" font-size="13" letter-spacing="1" fill="${t.mut}">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity">
${fontFaceStyle()}
<rect width="${W}" height="${H}" rx="14" fill="${t.panel}" stroke="${t.line}"/>
${cell(W * 0.33, total, "Contributions · last year")}
${cell(W * 0.67, String(snap.currentStreakDays), "Day streak")}
<line x1="${W / 2}" y1="34" x2="${W / 2}" y2="106" stroke="${t.line}"/>
</svg>`;
}
