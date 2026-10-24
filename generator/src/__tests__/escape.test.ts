import { describe, it, expect } from "vitest";
import { escapeMd } from "../render/escape.js";

describe("escapeMd", () => {
  it.each([
    ["<", "&lt;"],
    [">", "&gt;"],
    ["[", "\\["],
    ["]", "\\]"],
    ["\\", "\\\\"],
    ["|", "\\|"],
  ])("escapes %s", (raw, escaped) => {
    expect(escapeMd(`a${raw}b`)).toBe(`a${escaped}b`);
  });

  it.each([
    ["a newline", "a\nb"],
    ["a blank line", "a\n\nb"],
    ["a carriage return", "a\r\nb"],
    ["a tab", "a\tb"],
    ["a unicode line separator", "a b"],
    ["a non-breaking space", "a b"],
    ["a run of mixed whitespace", "a \n\t \r\n b"],
  ])("collapses %s to one space", (_label, raw) => {
    expect(escapeMd(raw)).toBe("a b");
  });

  it("trims the ends", () => {
    expect(escapeMd("  \n a b \n ")).toBe("a b");
  });

  it("cannot be made to start a heading, rule, list or table row", () => {
    const out = escapeMd("Real post\n\n## Heading\n\n---\n\n- item\n\n| a | b |");
    expect(out).toBe("Real post ## Heading --- - item \\| a \\| b \\|");
    expect(out).not.toMatch(/\n/);
  });

  it("leaves plain text alone", () => {
    expect(escapeMd("Honest backtests, part 2 (v1.0) — 99.9%")).toBe("Honest backtests, part 2 (v1.0) — 99.9%");
  });
});
