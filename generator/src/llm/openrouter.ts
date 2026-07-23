export interface ChatArgs { key: string; model: string; system: string; user: string; fetchImpl?: typeof fetch; }

/** Single chat completion. Returns trimmed text or null on any failure. Never throws. */
export async function chat(args: ChatArgs): Promise<string | null> {
  const f = args.fetchImpl ?? fetch;
  try {
    const res = await f("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${args.key}`, "content-type": "application/json",
        "x-title": "ReaperOAK Profile" },
      body: JSON.stringify({
        model: args.model, max_tokens: 120, temperature: 0.7,
        messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  }
}
