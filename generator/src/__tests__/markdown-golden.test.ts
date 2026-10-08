import { describe, it, expect } from "vitest";
import { renderReadme } from "../render/markdown.js";
import { FIXTURE } from "./fixtures.js";

describe("renderReadme", () => {
  it("emits every section marker in registry order", () => {
    const md = renderReadme(FIXTURE);
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order).toEqual([
      "hero", "currently", "telemetry", "featured", "cases", "roadmap",
      "engine-room", "numbers", "how", "connect", "coda",
    ]);
  });

  it("renders the LLM fields verbatim", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("RECENT WORK");
    expect(md).toContain("THINKING");
  });

  it("falls back to each project's static problem line when no blurb is supplied", () => {
    const md = renderReadme(FIXTURE);
    expect(md).toContain("Generative-AI media platform orchestrating foundation models for image, video, and audio.");
  });

  it("separates sections with a horizontal rule", () => {
    expect(renderReadme(FIXTURE)).toContain("\n\n---\n\n");
  });

  it("inserts the craft section when a language mix exists", () => {
    const md = renderReadme({ ...FIXTURE, languages: [
      { name: "TypeScript", color: "#3178c6", pct: 100 },
    ] });
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order).toContain("craft");
    expect(order.indexOf("craft")).toBeLessThan(order.indexOf("featured"));
  });

  it("inserts the engineering log directly after Featured when it has entries", () => {
    const md = renderReadme({ ...FIXTURE,
      fields: { ...FIXTURE.fields, engineeringLog: ["Shipped the telemetry canvas"] } });
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order[order.indexOf("featured") + 1]).toBe("log");
  });

  it("inserts the writing section directly after How I work when a feed exists", () => {
    const md = renderReadme({ ...FIXTURE,
      feed: [{ title: "Honest backtests", url: "https://blog.example/a", date: "2026-09-06" }] });
    const order = [...md.matchAll(/<!-- section:([a-z-]+) -->/g)].map((m) => m[1]);
    expect(order[order.indexOf("how") + 1]).toBe("writing");
  });
});
