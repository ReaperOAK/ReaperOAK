import { describe, it, expect, vi } from "vitest";
import { checkUptime } from "../data/uptime.js";
import type { Config } from "../config.js";

const cfg: Config = {
  githubToken: null, githubLogin: "ReaperOAK", llm: null,
  wakatimeKey: null, leetcodeHandle: null, feedUrl: null,
  uptimeTargets: [
    { label: "app.example.com", url: "https://app.example.com" },
    { label: "shop", url: "https://shop.example.com/" },
  ],
};

describe("checkUptime", () => {
  it("returns null when no targets are configured", async () => {
    expect(await checkUptime({ ...cfg, uptimeTargets: [] })).toBeNull();
  });

  it("reports the status code for each target", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const out = (await checkUptime(cfg, fake as unknown as typeof fetch))!;
    expect(out).toHaveLength(2);
    expect(out[0]!.label).toBe("app.example.com");
    expect(out[0]!.status).toBe(200);
    expect(out[0]!.ms).toBeGreaterThanOrEqual(0);
  });

  it("issues HEAD requests, not GET", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await checkUptime(cfg, fake as unknown as typeof fetch);
    expect((fake.mock.calls[0]![1] as RequestInit).method).toBe("HEAD");
  });

  it("records a null status for a failed check rather than inventing one", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("timeout"));
    const out = (await checkUptime(cfg, fake as unknown as typeof fetch))!;
    expect(out[0]!.status).toBeNull();
    expect(out[0]!.ms).toBeNull();
  });

  it("keeps a healthy target when a sibling fails", async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValueOnce(new Error("down"));
    const out = (await checkUptime(cfg, fake as unknown as typeof fetch))!;
    expect(out[0]!.status).toBe(200);
    expect(out[1]!.status).toBeNull();
  });

  it("reports a 5xx as the real code, not as a failure", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    expect((await checkUptime(cfg, fake as unknown as typeof fetch))![0]!.status).toBe(503);
  });

  it("does not retry a 5xx or other non-405/501 status", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await checkUptime({ ...cfg, uptimeTargets: [cfg.uptimeTargets[0]!] }, fake as unknown as typeof fetch);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("retries a 405 HEAD with GET and records the GET result", async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const out = (await checkUptime(
      { ...cfg, uptimeTargets: [cfg.uptimeTargets[0]!] }, fake as unknown as typeof fetch,
    ))!;
    expect(fake).toHaveBeenCalledTimes(2);
    expect((fake.mock.calls[1]![1] as RequestInit).method).toBe("GET");
    expect(out[0]!.status).toBe(200);
  });

  it("retries a 501 HEAD with GET and records the GET result", async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 501 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const out = (await checkUptime(
      { ...cfg, uptimeTargets: [cfg.uptimeTargets[0]!] }, fake as unknown as typeof fetch,
    ))!;
    expect(fake).toHaveBeenCalledTimes(2);
    expect(out[0]!.status).toBe(204);
  });

  it("still records null when the GET retry itself fails", async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockRejectedValueOnce(new Error("get failed too"));
    const out = (await checkUptime(
      { ...cfg, uptimeTargets: [cfg.uptimeTargets[0]!] }, fake as unknown as typeof fetch,
    ))!;
    expect(out[0]!.status).toBeNull();
    expect(out[0]!.ms).toBeNull();
  });
});

describe("GET retry body handling", () => {
  it("cancels the GET body after reading the status", async () => {
    let cancelled = false;
    const body = new ReadableStream({ cancel() { cancelled = true; } });
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }));
    const one: Config = { ...cfg, uptimeTargets: [cfg.uptimeTargets[0]!] };
    const out = (await checkUptime(one, fake as unknown as typeof fetch))!;
    expect(out[0]!.status).toBe(200);
    expect(cancelled).toBe(true);
  });
});
