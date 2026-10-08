import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("defaults the github login to ReaperOAK", () => {
    expect(loadConfig({}).githubLogin).toBe("ReaperOAK");
  });

  it("returns null for every optional source when the env is empty", () => {
    const c = loadConfig({});
    expect(c.githubToken).toBeNull();
    expect(c.wakatimeKey).toBeNull();
    expect(c.leetcodeHandle).toBeNull();
    expect(c.feedUrl).toBeNull();
    expect(c.llm).toBeNull();
  });

  it("prefers the OmniRoute gateway when LLM_BASE_URL and LLM_API_KEY are set", () => {
    const c = loadConfig({ LLM_BASE_URL: "http://127.0.0.1:20128/v1", LLM_API_KEY: "k" });
    expect(c.llm).toEqual({
      baseUrl: "http://127.0.0.1:20128/v1", key: "k", models: expect.any(Array),
    });
  });

  it("falls back to OpenRouter when only OPENROUTER_API_KEY is set", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "or" });
    expect(c.llm!.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(c.llm!.key).toBe("or");
  });

  it("splits LLM_MODELS on commas and trims", () => {
    const c = loadConfig({ LLM_BASE_URL: "http://x/v1", LLM_API_KEY: "k", LLM_MODELS: " a , b " });
    expect(c.llm!.models).toEqual(["a", "b"]);
  });

  it("parses uptime targets from label=url pairs", () => {
    const c = loadConfig({ UPTIME_TARGETS: "app.example.com=https://app.example.com,shop=https://shop.example.com/" });
    expect(c.uptimeTargets).toEqual([
      { label: "app.example.com", url: "https://app.example.com" },
      { label: "shop", url: "https://shop.example.com/" },
    ]);
  });

  it("ignores malformed uptime entries rather than throwing", () => {
    expect(loadConfig({ UPTIME_TARGETS: "garbage,,x=" }).uptimeTargets).toEqual([]);
  });

  it("returns an empty uptime list when the variable is unset", () => {
    expect(loadConfig({}).uptimeTargets).toEqual([]);
  });

  it("falls through to OPENROUTER_MODELS when LLM_MODELS is empty", () => {
    const c = loadConfig({
      OPENROUTER_API_KEY: "or",
      LLM_MODELS: "",
      OPENROUTER_MODELS: "model-a,model-b"
    });
    expect(c.llm!.models).toEqual(["model-a", "model-b"]);
  });

  it("falls through to OPENROUTER_MODELS when LLM_MODELS is whitespace-only", () => {
    const c = loadConfig({
      OPENROUTER_API_KEY: "or",
      LLM_MODELS: "  ,  , ",
      OPENROUTER_MODELS: "model-x"
    });
    expect(c.llm!.models).toEqual(["model-x"]);
  });

  it("uses OPENROUTER_MODEL when both LLM and OPENROUTER_MODELS are empty/absent", () => {
    const c = loadConfig({
      OPENROUTER_API_KEY: "or",
      LLM_MODELS: "",
      OPENROUTER_MODEL: "final-fallback"
    });
    expect(c.llm!.models).toEqual(["final-fallback"]);
  });
});
