// THE TERMINAL — AI furniture suggestions
//
// Runs on Supabase Edge Functions so the OpenRouter key stays server-side.
// The browser never sees it. Deploy with:
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
//   supabase functions deploy ai-suggest
//
// The client sends a shortlist that the local scoring engine already ranked,
// so the model only ever chooses between real SKUs that physically fit — it
// cannot invent stock.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// This OpenRouter account restricts providers to nvidia / mistral / tencent /
// cloudflare / perplexity / google-ai-studio, so Anthropic and OpenAI models
// return 404 "no allowed providers". Gemini is served by google-ai-studio and
// works. Override with the OPENROUTER_MODEL secret if the account changes.
const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-3.5-flash-lite";
const MAX_CANDIDATES = 24;

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const SYSTEM = `You are a senior interior designer helping a colleague choose furniture from their own showroom inventory.

Rules you must follow:
- Recommend ONLY from the candidate list you are given. Never invent a piece, a size, a material or a price.
- Identify every pick by its "ref" number. The same SKU can appear more than once as different variants (for example one in leather and one in fabric) — they are NOT interchangeable, so pick the exact ref whose material and price you mean.
- The candidates were pre-filtered to physically fit the space, and each carries a fit score from 0-100. Treat that score as the spatial verdict; your job is judgement the maths cannot make: how the pieces work together, proportion, material mix, and value.
- Prefer a coherent scheme over five variations of the same thing, unless the brief clearly asks for one category.
- Be concrete and short. Write the way a designer talks to a client, not like marketing copy.
- If the brief asks for something the inventory cannot serve, say so plainly in "note" rather than forcing a recommendation.

Reply with JSON only, no markdown fence, in exactly this shape:
{
  "summary": "one or two sentences describing the scheme you are proposing",
  "picks": [
    { "ref": 12, "role": "what this piece does in the room", "why": "one sentence of concrete reasoning" }
  ],
  "note": "any caveat, or an empty string"
}
Return between 5 and 6 picks unless the candidate list is shorter.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENROUTER_API_KEY is not set on this function." }, 500);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const brief = String(payload?.brief ?? "").slice(0, 600);
  const context = String(payload?.context ?? "").slice(0, 400);
  const candidates = Array.isArray(payload?.candidates)
    ? payload.candidates.slice(0, MAX_CANDIDATES)
    : [];

  if (!candidates.length) return json({ error: "No candidates supplied." }, 400);

  // A SKU can cover several variants (same model, different material/colour), so
  // every candidate carries a unique ref and the model must answer with the ref.
  const lines = candidates.map((c: Record<string, unknown>) =>
    `ref ${c.ref} | SKU ${c.sku} | ${c.type} | ${c.name} | ${c.dims} | ${c.material || "material not listed"} | ${c.price} | fit score ${c.score}`
  ).join("\n");

  const userMsg =
    `Space / requirement: ${context}\n` +
    (brief ? `What the client asked for: ${brief}\n` : "") +
    `\nCandidates (already checked to fit):\n${lines}`;

  let res;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dreamsworld08.github.io/TerminalSKUFind/",
        "X-Title": "THE TERMINAL - SKU Ledger",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });
  } catch (e) {
    return json({ error: "Could not reach OpenRouter: " + String(e) }, 502);
  }

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `OpenRouter returned ${res.status}`, detail: detail.slice(0, 400) }, 502);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = String(raw).match(/\{[\s\S]*\}/);      // tolerate a stray fence
    if (!m) return json({ error: "Model did not return JSON.", raw: String(raw).slice(0, 400) }, 502);
    try { parsed = JSON.parse(m[0]); }
    catch { return json({ error: "Model JSON was malformed.", raw: String(raw).slice(0, 400) }, 502); }
  }

  // Keep only refs we actually sent, and echo back the exact variant so the
  // client renders the same row the model reasoned about.
  const byRef = new Map(candidates.map((c: Record<string, unknown>) => [String(c.ref), c]));
  const picks = (Array.isArray(parsed?.picks) ? parsed.picks : [])
    .map((p: Record<string, unknown>) => {
      const c = byRef.get(String(p?.ref));
      if(!c) return null;
      return { ref: c.ref, sku: c.sku, role: String(p?.role ?? ""), why: String(p?.why ?? "") };
    })
    .filter(Boolean);

  return json({
    summary: String(parsed?.summary ?? ""),
    note: String(parsed?.note ?? ""),
    picks,
    model: MODEL,
    usage: data?.usage ?? null,
  });
});
