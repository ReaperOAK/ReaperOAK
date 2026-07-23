import { describe, it, expect } from "vitest";
import { validateReadme, assemble } from "../assemble.js";
import { content } from "../content.js";

const fields = { ...content.fallback };
const snap = { recentCommitMessages: [], totalContributions: 10, currentStreakDays: 1 };

describe("validateReadme", () => {
  it("rejects empty / too-short output", () => {
    expect(validateReadme("").ok).toBe(false);
    expect(validateReadme("tiny").ok).toBe(false);
  });
  it("rejects output missing a section marker", () => {
    const md = assemble(fields, snap).readme.replace("<!-- section:coda -->", "");
    expect(validateReadme(md).ok).toBe(false);
  });
  it("rejects unresolved tokens", () => {
    const md = assemble(fields, snap).readme + "\n{{oops}}";
    expect(validateReadme(md).ok).toBe(false);
  });
  it("accepts a full valid readme", () => {
    expect(validateReadme(assemble(fields, snap).readme).ok).toBe(true);
  });
});

describe("assemble", () => {
  it("produces four svg assets", () => {
    const built = assemble(fields, snap);
    expect(Object.keys(built.assets).sort()).toEqual(
      ["hero-dark.svg", "hero-light.svg", "stats-dark.svg", "stats-light.svg"]);
  });
});
