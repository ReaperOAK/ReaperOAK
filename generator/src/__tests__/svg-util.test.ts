import { describe, it, expect } from "vitest";
import { THEME, escapeXml, fontFaceStyle } from "../render/svg-util.js";

describe("svg-util", () => {
  it("exposes dark and light themes with the oak accent", () => {
    expect(THEME.dark.accent).toBe("#E8A33D");
    expect(THEME.light.accent).toBe("#C77B30");
    expect(THEME.dark.bg).toBe("#0B0B0D");
  });
  it("escapes xml-hostile characters", () => {
    expect(escapeXml(`a & b < c > "d"`)).toBe("a &amp; b &lt; c &gt; &quot;d&quot;");
  });
  it("embeds a base64 font face named OakDisplay", () => {
    const s = fontFaceStyle();
    expect(s).toContain("@font-face");
    expect(s).toContain("OakDisplay");
    expect(s).toContain("base64,");
  });
});
