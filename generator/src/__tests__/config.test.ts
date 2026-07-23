import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("disables OpenRouter when no key is present", () => {
    const c = loadConfig({});
    expect(c.openRouter).toBeNull();
    expect(c.wakatimeEnabled).toBe(false);
    expect(c.githubLogin).toBe("ReaperOAK");
  });
  it("enables OpenRouter with a key and a default free-model chain", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "sk-x" });
    expect(c.openRouter?.key).toBe("sk-x");
    expect(c.openRouter?.models.length).toBeGreaterThan(1);
    expect(c.openRouter?.models.every((m) => m.includes(":free") || m === "openrouter/free")).toBe(true);
  });
  it("honors OPENROUTER_MODELS as a comma-separated override", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "sk-x", OPENROUTER_MODELS: "a/x:free, b/y:free" });
    expect(c.openRouter?.models).toEqual(["a/x:free", "b/y:free"]);
  });
  it("passes through a GitHub token", () => {
    expect(loadConfig({ GITHUB_TOKEN: "ghs_x" }).githubToken).toBe("ghs_x");
  });
});
