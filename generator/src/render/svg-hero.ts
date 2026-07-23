import { THEME, escapeXml, fontFaceStyle } from "./svg-util.js";
import { content } from "../content.js";

export function renderHeroSvg(theme: "dark" | "light", tagline: string): string {
  const t = THEME[theme];
  const W = 900, H = 260;
  const { reaper, oak } = content.wordmark;
  const tag = escapeXml(tagline);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ReaperOAK — ${escapeXml(content.fullName)}">
${fontFaceStyle()}
<defs>
  <radialGradient id="glow" cx="50%" cy="-10%" r="80%">
    <stop offset="0%" stop-color="${t.accent}" stop-opacity="0.14"/>
    <stop offset="60%" stop-color="${t.accent}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<text x="${W / 2}" y="58" text-anchor="middle" font-family="ui-monospace,monospace" font-size="13" letter-spacing="4" fill="${t.mut}">${escapeXml(content.eyebrow.toUpperCase())}</text>
<text x="${W / 2}" y="132" text-anchor="middle" font-family="OakDisplay,sans-serif" font-weight="800" font-size="72" letter-spacing="-2">
  <tspan fill="${t.ink}">${escapeXml(reaper)}</tspan><tspan fill="${t.accent}">${escapeXml(oak)}</tspan>
</text>
<text x="${W / 2}" y="170" text-anchor="middle" font-family="ui-monospace,monospace" font-size="14" letter-spacing="2" fill="${t.mut}">
  <tspan fill="${t.accent}">O</tspan>wais <tspan fill="${t.accent}">A</tspan>hmed <tspan fill="${t.accent}">K</tspan>han
</text>
<text x="${W / 2}" y="212" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" fill="${t.ink}" opacity="0.92">${tag}</text>
<line x1="${W / 2 - 120}" y1="238" x2="${W / 2 + 120}" y2="238" stroke="${t.accent}" stroke-opacity="0.35"/>
</svg>`;
}
