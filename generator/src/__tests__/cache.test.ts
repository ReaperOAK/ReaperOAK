import { describe, it, expect } from "vitest";
import { readCache, writeCache } from "../cache.js";

describe("cache", () => {
  const key = "test-key";
  it("returns null for a missing key", () => {
    expect(readCache("does-not-exist-xyz")).toBeNull();
  });
  it("round-trips a value", () => {
    writeCache(key, { a: 1, b: "x" });
    expect(readCache<{ a: number; b: string }>(key)).toEqual({ a: 1, b: "x" });
  });
  it("returns null on corrupt json without throwing", () => {
    expect(() => readCache("../../etc/passwd")).not.toThrow();
  });
});
