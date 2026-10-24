import { describe, it, expect } from "vitest";
import { renderHeroSvg, formatSyncStamp } from "../render/svg-hero.js";
import { assemble } from "../assemble.js";
import { FIXTURE } from "./fixtures.js";

const SYNCED = "2026-09-06T13:44:00.000Z";
const THEMES = ["dark", "light"] as const;

describe("formatSyncStamp", () => {
  it("renders an IST date and time", () => {
    expect(formatSyncStamp(SYNCED)).toBe("06 Sep 2026 · 19:14 IST");
  });

  it("returns an em dash for an unparseable timestamp rather than 'Invalid Date'", () => {
    expect(formatSyncStamp("not a date")).toBe("—");
    expect(formatSyncStamp("")).toBe("—");
  });

  it("rolls the date over when IST is already the next day", () => {
    expect(formatSyncStamp("2026-09-06T18:30:00.000Z")).toBe("07 Sep 2026 · 00:00 IST");
    expect(formatSyncStamp("2026-12-31T19:00:00.000Z")).toBe("01 Jan 2027 · 00:30 IST");
  });

  it("uses a 24-hour clock that never prints 24:xx", () => {
    expect(formatSyncStamp("2026-09-06T18:45:00.000Z")).toBe("07 Sep 2026 · 00:15 IST");
    expect(formatSyncStamp("2026-09-06T18:29:00.000Z")).toBe("06 Sep 2026 · 23:59 IST");
  });

  it("spells every month with three letters, September included", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      formatSyncStamp(new Date(Date.UTC(2026, i, 15, 6)).toISOString()).split(" ")[1]);
    expect(months).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  });

  it("is always the same length, so the hero can place the stamp's dot", () => {
    const lengths = new Set(
      ["2026-01-01T00:00:00Z", "2026-09-30T23:59:00Z", "2027-05-05T05:05:00Z"].map((s) => formatSyncStamp(s).length));
    expect(lengths.size).toBe(1);
  });
});

describe("renderHeroSvg", () => {
  const svg = renderHeroSvg("dark", "Shipping calm systems.", SYNCED);

  it("produces a valid svg containing the wordmark and reveal", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Reaper");
    expect(svg).toContain("OAK");
    expect(svg).toContain("Owais");
    expect(svg).toContain("Shipping calm systems.");
  });

  it("uses the dark ground for dark and light ground for light", () => {
    expect(renderHeroSvg("dark", "x", SYNCED)).toContain("#0B0B0D");
    expect(renderHeroSvg("light", "x", SYNCED)).toContain("#FBF8F2");
  });

  it("renders light and dark differently", () => {
    expect(renderHeroSvg("light", "t", SYNCED)).not.toBe(renderHeroSvg("dark", "t", SYNCED));
  });

  it("escapes a hostile tagline", () => {
    expect(renderHeroSvg("dark", 'a < b & "c"', SYNCED)).toContain("a &lt; b &amp; &quot;c&quot;");
  });

  describe("sync stamp", () => {
    it("shows when the data was fetched, in IST", () => {
      for (const theme of THEMES) {
        expect(renderHeroSvg(theme, "t", SYNCED)).toContain(">SYNCED 06 Sep 2026 · 19:14 IST</text>");
      }
    });

    it("reports the given timestamp, not the time the job ran", () => {
      const out = renderHeroSvg("dark", "t", "2024-02-03T01:00:00.000Z");
      expect(out).toContain("SYNCED 03 Feb 2024 · 06:30 IST");
    });

    it("draws no stamp for the epoch, which is what a cache with no fetch time yields", () => {
      for (const theme of THEMES) {
        const out = renderHeroSvg(theme, "t", new Date(0).toISOString());
        expect(out).not.toContain("SYNCED");
        expect(out).not.toMatch(/\d{2} [A-Za-z]{3} \d{4}/); // no date text at all, least of all 1970
        expect(out).not.toContain("<circle");
      }
    });

    it("draws no stamp for an unparseable timestamp, and never prints a dash placeholder", () => {
      for (const bad of ["not a date", "", "undefined"]) {
        const out = renderHeroSvg("dark", "t", bad);
        expect(out).not.toContain("SYNCED");
        expect(out).not.toContain("<circle");
      }
    });

    it("draws the stamp for the first instant after the epoch", () => {
      expect(renderHeroSvg("dark", "t", "1970-01-01T00:00:00.001Z")).toContain("SYNCED");
    });

    it("draws no stamp for a timestamp before the epoch", () => {
      expect(renderHeroSvg("dark", "t", "1969-12-31T23:59:59.999Z")).not.toContain("SYNCED");
    });
  });

  describe("layout", () => {
    const attr = (s: string, re: RegExp): number => Number(re.exec(s)?.[1]);

    it("keeps width, height and viewBox consistent so a width-only <img> scales proportionally", () => {
      for (const theme of THEMES) {
        const out = renderHeroSvg(theme, "t", SYNCED);
        const w = attr(out, /<svg[^>]* width="(\d+)"/);
        const h = attr(out, /<svg[^>]* height="(\d+)"/);
        expect(out).toContain(`viewBox="0 0 ${w} ${h}"`);
        expect(out).toContain(`<rect width="${w}" height="${h}" fill=`);
      }
    });

    it("is as wide as the README's hero <img>", () => {
      const { readme, assets } = assemble(FIXTURE);
      const imgW = attr(readme, /src="assets\/hero-dark\.svg" width="(\d+)"/);
      expect(attr(assets["hero-dark.svg"] ?? "", /<svg[^>]* width="(\d+)"/)).toBe(imgW);
    });

    it("stacks the text above the rule above the stamp, inside the canvas, in both themes", () => {
      for (const theme of THEMES) {
        const out = renderHeroSvg(theme, "t", SYNCED);
        const h = attr(out, /<svg[^>]* height="(\d+)"/);
        const rule = attr(out, /<line [^>]*y1="(\d+)"/);
        const stampY = attr(out, /<text [^>]*y="(\d+)"[^>]*font-size="11"[^>]*>SYNCED/);
        const stampSize = attr(out, /<text [^>]*font-size="(\d+)"[^>]*>SYNCED/);
        const otherBaselines = [...out.matchAll(/<text [^>]*y="(\d+)"/g)]
          .map((m) => Number(m[1])).filter((y) => y !== stampY);
        expect(Math.max(...otherBaselines)).toBeLessThan(rule);
        expect(stampY - stampSize).toBeGreaterThan(rule);
        expect(stampY).toBeLessThan(h);
      }
    });

    it("keeps the dot clear of the first glyph even in a wide monospace fallback", () => {
      for (const theme of THEMES) {
        const out = renderHeroSvg(theme, "t", SYNCED);
        const dotCx = attr(out, /<circle cx="([\d.]+)"/);
        const dotR = attr(out, /<circle [^>]*r="([\d.]+)"/);
        const textCx = attr(out, /<text x="([\d.]+)"[^>]*>SYNCED/);
        const chars = "SYNCED 06 Sep 2026 · 19:14 IST".length;
        const widestFallback = chars * (11 * 0.62 + 1); // roughly the widest mono face a viewer might get
        const textLeft = textCx - widestFallback / 2;
        expect(dotCx + dotR).toBeLessThan(textLeft);
        expect(textLeft - (dotCx + dotR)).toBeGreaterThan(3);
      }
    });
  });
});
