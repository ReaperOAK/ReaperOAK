import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("disables OpenRouter when no key is present", () => {
    const c = loadConfig({});
    expect(c.openRouter).toBeNull();
    expect(c.wakatimeEnabled).toBe(false);
    expect(c.githubLogin).toBe("ReaperOAK");
  });
  it("enables OpenRouter with a key and default model", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "sk-x" });
    expect(c.openRouter?.key).toBe("sk-x");
    expect(c.openRouter?.model.length).toBeGreaterThan(0);
  });
  it("passes through a GitHub token", () => {
    expect(loadConfig({ GITHUB_TOKEN: "ghs_x" }).githubToken).toBe("ghs_x");
  });
});
