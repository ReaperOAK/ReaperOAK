import { describe, it, expect, vi } from "vitest";
import { chat } from "../llm/gateway.js";

const args = { baseUrl: "http://127.0.0.1:20128/v1", key: "k", model: "m", system: "s", user: "u" };
const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "content-type": "application/json" } });

describe("chat", () => {
  it("posts to the configured base url", async () => {
    const fake = vi.fn().mockResolvedValue(ok("hello"));
    await chat({ ...args, fetchImpl: fake as unknown as typeof fetch });
    expect(String(fake.mock.calls[0]![0])).toBe("http://127.0.0.1:20128/v1/chat/completions");
  });

  it("returns the trimmed reply", async () => {
    const fake = vi.fn().mockResolvedValue(ok("  hello  "));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBe("hello");
  });

  it("returns null on a non-200 response", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("no", { status: 429 }));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBeNull();
  });

  it("never throws when the gateway is unreachable", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBeNull();
  });

  it("returns null when the response has no message content", async () => {
    const fake = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    expect(await chat({ ...args, fetchImpl: fake as unknown as typeof fetch })).toBeNull();
  });

  it("sends the key as a bearer token, never in the URL", async () => {
    const fake = vi.fn().mockResolvedValue(ok("x"));
    await chat({ ...args, fetchImpl: fake as unknown as typeof fetch });
    expect(String(fake.mock.calls[0]![0])).not.toContain("k@");
    expect((fake.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ authorization: "Bearer k" });
  });
});
