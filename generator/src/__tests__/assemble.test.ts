import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateReadme, assemble, writeOutputs, SECTION_MARKERS } from "../assemble.js";
import { LEAK_PATTERN } from "../render/leaks.js";
import { FIXTURE } from "./fixtures.js";

describe("writeOutputs asset scan", () => {
  it("rejects a leaking asset and writes nothing at all", () => {
    const dir = mkdtempSync(join(tmpdir(), "roak-write-"));
    const built = assemble(FIXTURE);
    built.assets["telemetry-dark.svg"] = '<svg width="NaN"/>';
    expect(() => writeOutputs(dir, built)).toThrow("telemetry-dark.svg leaked NaN");
    expect(existsSync(join(dir, "README.md"))).toBe(false);
    expect(existsSync(join(dir, "assets"))).toBe(false);
  });

  it("passes the real rendered assets, embedded font included", () => {
    for (const svg of Object.values(assemble(FIXTURE).assets)) expect(LEAK_PATTERN.test(svg)).toBe(false);
  });
});

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

  describe("required sections", () => {
    it("are exactly the always-present ones, so a page without optional panels still passes", () => {
      expect(SECTION_MARKERS).toEqual([
        "<!-- section:hero -->", "<!-- section:currently -->", "<!-- section:featured -->",
        "<!-- section:engine-room -->", "<!-- section:numbers -->",
        "<!-- section:connect -->", "<!-- section:coda -->",
      ]);
    });

    it.each(SECTION_MARKERS)("rejects a page missing %s and names it", (marker) => {
      const md = assemble(FIXTURE).readme.replace(marker, "");
      expect(validateReadme(md)).toEqual({ ok: false, reason: `missing ${marker}` });
    });
  });

  describe("leaked values", () => {
    const good = assemble(FIXTURE).readme;

    it("accepts the page the tests below corrupt", () => {
      expect(validateReadme(good)).toEqual({ ok: true });
    });

    it.each([
      ["an unresolved template token", "{{tagline}}", "{{"],
      ["a leaked NaN", "streak: NaN days", "NaN"],
      ["a leaked undefined", "language: undefined", "undefined"],
      ["a leaked Infinity", "score: Infinity", "Infinity"],
      ["a stringified object", "[object Object]", "[object Object]"],
    ])("rejects %s and names it", (_what, line, leaked) => {
      expect(validateReadme(`${good}\n${line}`)).toEqual({ ok: false, reason: `leaked ${leaked}` });
    });

    it("rejects a leak at the very start of the page", () => {
      expect(validateReadme(`undefined\n${good}`)).toEqual({ ok: false, reason: "leaked undefined" });
    });

    it("rejects a leak at the very end of the page, with no trailing newline", () => {
      expect(validateReadme(`${good}\nvalue: NaN`)).toEqual({ ok: false, reason: "leaked NaN" });
    });

    it("rejects a leak inside a link target", () => {
      expect(validateReadme(`${good}\n[repo](https://github.com/ReaperOAK/undefined)`))
        .toEqual({ ok: false, reason: "leaked undefined" });
    });

    it("names the first leak when there are several", () => {
      expect(validateReadme(`${good}\nNaN then undefined`)).toEqual({ ok: false, reason: "leaked NaN" });
    });

    it("reports a missing section before a leak", () => {
      const md = `${good.replace("<!-- section:coda -->", "")}\nNaN`;
      expect(validateReadme(md)).toMatchObject({ ok: false, reason: expect.stringContaining("coda") });
    });

    it("does not reject ordinary prose that merely contains the same letters", () => {
      // \b means a leak must stand alone as a word: these only embed one.
      for (const prose of [
        "Behaviour here is well defined.",
        "the undefinedness of the spec",
        "Infinityx and xInfinity are not values",
        "NaNoWriMo and banana bread",
        "undefined_value and _undefined",
        "lowercase nan and infinity and Undefined",
      ]) {
        expect(validateReadme(`${good}\n${prose}`), prose).toEqual({ ok: true });
      }
    });

    it("does reject a leak next to punctuation, which is how a stringified value usually appears", () => {
      for (const line of ["(undefined)", "undefined.", "undefined-behaviour", "a/NaN/b", '"Infinity"']) {
        expect(validateReadme(`${good}\n${line}`), line).toMatchObject({ ok: false });
      }
    });
  });
});

describe("assemble", () => {
  it("produces four svg assets", () => {
    const built = assemble(FIXTURE);
    expect(Object.keys(built.assets).sort()).toEqual(
      ["hero-dark.svg", "hero-light.svg", "telemetry-dark.svg", "telemetry-light.svg"]);
  });

  it("stamps both heroes with the snapshot's syncedAt, not the time of the build", () => {
    const { assets } = assemble({ ...FIXTURE, syncedAt: "2024-02-03T01:00:00.000Z" });
    for (const name of ["hero-dark.svg", "hero-light.svg"]) {
      expect(assets[name], name).toContain("SYNCED 03 Feb 2024 · 06:30 IST");
    }
  });

  it("stamps neither hero when the data has no recorded fetch time", () => {
    const { assets } = assemble({ ...FIXTURE, syncedAt: new Date(0).toISOString() });
    for (const name of ["hero-dark.svg", "hero-light.svg"]) {
      expect(assets[name], name).not.toContain("SYNCED");
    }
  });
});
