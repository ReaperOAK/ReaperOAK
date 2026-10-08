import { describe, it, expect } from "vitest";
import { validateReadme, assemble } from "../assemble.js";
import { FIXTURE } from "./fixtures.js";

describe("validateReadme", () => {
  it("rejects empty / too-short output", () => {
    expect(validateReadme("").ok).toBe(false);
    expect(validateReadme("tiny").ok).toBe(false);
  });
  it("rejects output missing a section marker", () => {
    const md = assemble(FIXTURE).readme.replace("<!-- section:coda -->", "");
    expect(validateReadme(md).ok).toBe(false);
  });
  it("rejects unresolved tokens", () => {
    const md = assemble(FIXTURE).readme + "\n{{oops}}";
    expect(validateReadme(md).ok).toBe(false);
  });
  it("accepts a full valid readme", () => {
    expect(validateReadme(assemble(FIXTURE).readme).ok).toBe(true);
  });
});

describe("assemble", () => {
  it("produces four svg assets", () => {
    const built = assemble(FIXTURE);
    expect(Object.keys(built.assets).sort()).toEqual(
      ["hero-dark.svg", "hero-light.svg", "telemetry-dark.svg", "telemetry-light.svg"]);
  });
});
