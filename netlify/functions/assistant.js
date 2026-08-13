const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const SYSTEM = `You are the CareerShield Guide, a concise decision-support assistant for comparing college, skilled trades, certifications/technical training, and military paths. Use only the comparison data and methodology supplied with the request. Explain tradeoffs, challenge assumptions, and suggest verification questions. Never claim a projection is guaranteed. Never present yourself as a financial adviser, recruiter, school representative, insurer, or government official. Do not recommend borrowing products, enlistment, or a specific school as a certainty. If asked for facts not present in the comparison, say what should be verified and with whom. Keep answers under 220 words, use plain language, and prefer short bullets when comparing paths.`;

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "The AI guide is not configured yet." }, 503);
  try {
    const body = await request.json();
    const message = String(body.message || "").trim();
    const comparisons = Array.isArray(body.comparisons) ? body.comparisons.slice(0, 4) : [];
    if (message.length < 2 || message.length > 800) return json({ error: "Ask a question from 2 to 800 characters." }, 400);
    const context = comparisons.map((item, index) => ({
      rank: index + 1, path: item.pathLabel, name: item.name, career: item.career?.name,
      score: item.score, fiveYearNet: item.fiveYearNet, factors: item.metrics,
      inputs: item.inputs, military: item.militaryComp || null, apprenticeship: item.tradeComp || null,
      training: item.trainingComp || null
    }));
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: SYSTEM,
        input: `CareerShield comparison data:\n${JSON.stringify(context)}\n\nUser question: ${message}`,
        max_output_tokens: 600
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: data.error?.message || "The AI guide could not answer right now." }, 502);
    const answer = data.output_text || (data.output || []).flatMap(o => o.content || []).find(c => c.type === "output_text")?.text;
    if (!answer) return json({ error: "The AI guide returned an empty response." }, 502);
    return json({ answer });
  } catch (error) {
    return json({ error: error.name === "TimeoutError" ? "The AI guide took too long. Please try again." : "The AI guide is temporarily unavailable." }, 502);
  }
};

export const config = { path: "/api/assistant", method: "POST" };
