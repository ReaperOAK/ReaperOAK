import { describe, it, expect } from "vitest";
import { casesPanel } from "../panels/md/cases.js";
import { roadmapPanel } from "../panels/md/roadmap.js";
import { howPanel } from "../panels/md/how.js";
import { content } from "../content.js";
import { FIXTURE } from "./fixtures.js";
import type { Snapshot } from "../panels/types.js";
import type { RoadmapTopic } from "../types.js";

const withNeet: Snapshot = { ...FIXTURE, neetcode: { solved: 51, target: 150 } };

describe("casesPanel", () => {
  it("renders one collapsible block per case study", () => {
    const out = casesPanel.render(casesPanel.select(FIXTURE)!, FIXTURE);
    expect((out.match(/<details>/g) ?? []).length).toBe(content.caseStudies.length);
    expect((out.match(/<\/details>/g) ?? []).length).toBe(content.caseStudies.length);
  });

  it("keeps every project link as real markdown, never inside an image", () => {
    const out = casesPanel.render(casesPanel.select(FIXTURE)!, FIXTURE);
    for (const c of content.caseStudies.filter((c) => c.url)) expect(out).toContain(`(${c.url})`);
    // A study without a public URL renders no link at all, never an empty `[...]()`.
    expect(out).not.toContain("]()");
    expect(out).not.toContain("<img");
  });

  it("states a tradeoff for every case study", () => {
    for (const c of content.caseStudies) expect(c.tradeoff.length).toBeGreaterThan(0);
  });

  it("omits the outcome line when there is no honest number", () => {
    const out = casesPanel.render(
      [{ title: "T", url: "https://x", problem: "p", decision: "d", tradeoff: "t", outcome: "", stack: "s" }],
      FIXTURE,
    );
    expect(out).not.toContain("**Outcome**");
  });
});

describe("roadmapPanel", () => {
  it("shows the live neetcode count when it is available", () => {
    const out = roadmapPanel.render(roadmapPanel.select(withNeet)!, withNeet);
    expect(out).toContain("51 / 150");
  });

  it("omits the neetcode row entirely when the repo could not be read", () => {
    const out = roadmapPanel.render(roadmapPanel.select(FIXTURE)!, FIXTURE);
    expect(out).not.toContain("NeetCode 150");
  });

  it("renders every configured topic", () => {
    const out = roadmapPanel.render(roadmapPanel.select(FIXTURE)!, FIXTURE);
    for (const topic of content.roadmapTopics) expect(out).toContain(topic.name);
  });

  it("renders 'ongoing' for a topic with no progress figure, instead of a bar", () => {
    const topics: RoadmapTopic[] = [{ name: "System design", detail: "d" }];
    const out = roadmapPanel.render(topics, FIXTURE);
    expect(out).toContain("ongoing");
    expect(out).not.toMatch(/\d+%/);
  });

  it("renders a percentage bar for a topic that does carry a progress figure", () => {
    const topics: RoadmapTopic[] = [{ name: "Go", detail: "d", progress: 60 }];
    const out = roadmapPanel.render(topics, FIXTURE);
    expect(out).toContain("60%");
    expect(out).toContain("█");
    expect(out).not.toContain("ongoing");
  });

  it("clamps the printed percentage to the bar's 0..100 range", () => {
    const over = roadmapPanel.render([{ name: "Over", detail: "d", progress: 150 }], FIXTURE);
    const under = roadmapPanel.render([{ name: "Under", detail: "d", progress: -20 }], FIXTURE);
    expect(over).toContain(" 100%");
    expect(over).not.toContain("150%");
    expect(under).toContain(" 0%");
    expect(under).not.toContain("-20%");
  });

  it("guards a non-finite topic progress value so it never prints NaN% or crashes", () => {
    const topics: RoadmapTopic[] = [{ name: "Broken", detail: "d", progress: NaN }];
    expect(() => roadmapPanel.render(topics, FIXTURE)).not.toThrow();
    const out = roadmapPanel.render(topics, FIXTURE);
    expect(out).not.toContain("NaN");
  });

  it("guards the live neetcode bar against a zero target: no crash, no NaN, a real empty bar", () => {
    const zeroTarget: Snapshot = { ...FIXTURE, neetcode: { solved: 0, target: 0 } };
    expect(() => roadmapPanel.render(roadmapPanel.select(zeroTarget)!, zeroTarget)).not.toThrow();
    const out = roadmapPanel.render(roadmapPanel.select(zeroTarget)!, zeroTarget);
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("Infinity");
    // the guard renders a full 10-cell empty bar, not a blank/missing one
    expect(out).toContain("`░░░░░░░░░░`");
  });
});

describe("howPanel", () => {
  it("renders every principle", () => {
    const out = howPanel.render(howPanel.select(FIXTURE)!, FIXTURE);
    for (const p of content.principles) expect(out).toContain(p);
  });

  it("selects the configured principles", () => {
    expect(howPanel.select({ ...FIXTURE })).not.toBeNull();
  });
});
