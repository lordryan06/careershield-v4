import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const SYSTEM = `You produce a CareerShield Deep Analysis beta preview. Analyze only the supplied saved comparison and evidence. Do not invent facts, imply that a possible source match verifies a specific program, or guarantee outcomes. Clearly distinguish official data, user-entered values, CareerShield estimates, and unresolved verification needs. Use plain language and USD. Produce these headings exactly: Executive Takeaway; Ranking and Why; Expected Scenario; Best-Case Scenario; Downside Scenario; Break-Even Points; Red Flags and Material Assumptions; What Could Reverse the Ranking; Questions to Ask; Next 7 Actions; Data Confidence. Be specific to every compared path. State that this is AI-generated beta decision support, not financial, legal, admissions, recruiting, or career counseling advice.`;

export default async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    verifyRequestOrigin(request);
    const user = await getUser();
    if (!user?.id) return json({ error: "Log in to generate a free Deep Analysis beta preview." }, 401);
    const plansStore = getStore({ name: "careershield-user-plans", consistency: "strong" });
    const savedRecord = await plansStore.get(`users/${user.id}`, { type: "json" });
    const plans = Array.isArray(savedRecord?.plans) ? savedRecord.plans.slice(0, 4) : [];
    if (!plans.length) return json({ error: "Save at least one comparison path before generating Deep Analysis." }, 409);
    const snapshot = plans.map((plan, index) => ({
      rank: index + 1, path: plan.pathLabel, provider: plan.name, program: plan.program || plan.degree || null,
      programSource: plan.programSource || null, career: plan.career, score: plan.score, factors: plan.metrics,
      inputs: plan.inputs, fiveYearNet: plan.fiveYearNet, tenYearNet: plan.tenYearNet,
      timeline: plan.timeline, military: plan.militaryComp || null, apprenticeship: plan.tradeComp || null,
      training: plan.trainingComp || null, dataConfidence: plan.dataConfidence || null,
      officialProgramUrl: plan.officialProgramUrl || null, liveEvidence: plan.liveEvidence || null
    }));
    const fingerprint = JSON.stringify(snapshot.map(item => [item.provider, item.program, item.score, item.tenYearNet, item.dataConfidence?.score]));
    const previewStore = getStore({ name: "careershield-deep-analysis-previews", consistency: "strong" });
    const previewKey = `users/${user.id}`;
    const existing = await previewStore.get(previewKey, { type: "json" });
    if (existing?.analysis?.content && existing.fingerprint === fingerprint) return json({ analysis: existing.analysis, preview: true, cached: true });
    if (existing?.status === "generating" && existing.startedAt && Date.now() - new Date(existing.startedAt).getTime() < 120000) return json({ status: "generating", message: "Your free beta analysis is being prepared." }, 202);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: "Deep Analysis generation is not configured. Add OPENAI_API_KEY in Netlify." }, 503);
    await previewStore.setJSON(previewKey, { version: 1, status: "generating", fingerprint, startedAt: new Date().toISOString() });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-5-mini", instructions: SYSTEM, input: `Saved CareerShield comparison:\n${JSON.stringify(snapshot)}`, max_output_tokens: 3200 }),
      signal: AbortSignal.timeout(50000)
    });
    const data = await response.json().catch(() => ({}));
    const content = data.output_text || (data.output || []).flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
    if (!response.ok || !content) throw new Error(data.error?.message || "The analysis could not be generated.");
    const analysis = { version: 1, betaPreview: true, content, generatedAt: new Date().toISOString(), planSnapshot: snapshot };
    await previewStore.setJSON(previewKey, { version: 1, status: "complete", fingerprint, analysis, updatedAt: analysis.generatedAt });
    return json({ analysis, preview: true, cached: false });
  } catch (error) {
    console.error("Deep Analysis beta error", error);
    return json({ error: error.name === "TimeoutError" ? "Generation took too long. Try the free beta preview again." : "Deep Analysis could not be generated right now. Try again shortly." }, 502);
  }
};

export const config = { path: "/api/deep-analysis", method: "POST", rateLimit: { action: "rate_limit", windowLimit: 6, windowSize: 180, aggregateBy: ["ip", "domain"] } };
