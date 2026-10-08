import { THEME, escapeXml, fontFaceStyle, type Tokens } from "./svg-util.js";
import { content } from "../content.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET_MS = 5.5 * 3_600_000; // India has no DST, so a fixed offset is exact

/** "06 Sep 2026 · 19:14 IST". Returns an em dash rather than printing "Invalid Date".
 *  Built from UTC fields on a shifted clock instead of Intl: Node 24's en-GB locale spells
 *  September "Sept", which would change the stamp's width and break a fixed-length layout. */
export function formatSyncStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const d = new Date(ms + IST_OFFSET_MS);
  const two = (n: number): string => String(n).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()] ?? "—";
  return `${two(d.getUTCDate())} ${mon} ${d.getUTCFullYear()} · ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} IST`;
}

const STAMP_FONT = 11, STAMP_SPACING = 1, STAMP_DOT_R = 3.5;
const STAMP_DOT_GAP = 12; // clear space between the dot and the first glyph
const STAMP_SHIFT = 8;    // nudges the text right so dot + text read as centred together

/** The dot sits left of the text, so it needs the text's width. A monospace face is about 0.6em
 *  per glyph plus letter-spacing; the stamp is fixed-length, and the gap absorbs the spread
 *  between real fallback faces (Consolas is narrower, Menlo and DejaVu Mono about this wide). */
function syncStampSvg(W: number, H: number, t: Tokens, stamp: string): string {
  const text = `SYNCED ${stamp}`;
  const textW = text.length * (STAMP_FONT * 0.6 + STAMP_SPACING);
  const cx = W / 2 + STAMP_SHIFT;
  return `
<circle cx="${cx - textW / 2 - STAMP_DOT_GAP}" cy="${H - 14}" r="${STAMP_DOT_R}" fill="${t.accent}"/>
<text x="${cx}" y="${H - 10}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="${STAMP_FONT}" letter-spacing="${STAMP_SPACING}" fill="${t.mut}">${text}</text>`;
}

/** `syncedAt` is when the data was fetched, which is not when this job ran: a cache-served build
 *  carries the original fetch time. An unparseable value or the epoch (what a cache with no
 *  recorded fetch time yields) draws no stamp, because a wrong date is worse than none. */
export function renderHeroSvg(theme: "dark" | "light", tagline: string, syncedAt: string): string {
  const t = THEME[theme];
  const W = 900, H = 288;
  const { reaper, oak } = content.wordmark;
  const tag = escapeXml(tagline);
  const stamp = Date.parse(syncedAt) > 0 ? syncStampSvg(W, H, t, formatSyncStamp(syncedAt)) : "";
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
<line x1="${W / 2 - 120}" y1="238" x2="${W / 2 + 120}" y2="238" stroke="${t.accent}" stroke-opacity="0.35"/>${stamp}
</svg>`;
}
