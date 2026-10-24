import { describe, it, expect } from "vitest";
import { LEAK_PATTERN } from "../render/leaks.js";

describe("LEAK_PATTERN", () => {
  it.each([
    "Hello {{ name }}",
    "Fixed NaN propagation",
    "NaN%",
    "Guarded against undefined fields",
    "/posts/undefined",
    "Capped the Infinity retry loop",
    "Rendered [object Object] in the log",
  ])("matches %s", (text) => {
    expect(LEAK_PATTERN.test(text)).toBe(true);
  });

  it.each([
    "NaNoWriMo recap",
    "undefinedBehavior in C",
    "Infinityward postmortem",
    "Added an isNaN guard",
    "Added an isInfinity guard",
    "xundefined",
    "nan and infinity in lowercase",
    "[object] Object",
    "{ single brace }",
  ])("does not match %s", (text) => {
    expect(LEAK_PATTERN.test(text)).toBe(false);
  });

  // A /g flag would make .test() stateful (lastIndex), so alternate calls would disagree.
  it("gives the same answer on every call", () => {
    expect([1, 2, 3].map(() => LEAK_PATTERN.test("Fixed NaN"))).toEqual([true, true, true]);
  });
});
