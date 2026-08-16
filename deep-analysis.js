import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const SYSTEM = `You produce a concise CareerShield Deep Analysis beta preview for a student and parent. Analyze only the supplied comparison and evidence. Never invent facts, treat a possible source match as verification, or guarantee an outcome. Clearly label official data, user-entered values, CareerShield estimates, and verification gaps. Use plain language and USD.

Produce these headings exactly and in this order:
Executive Takeaway
The 3 Things That Matter Most
Path-by-Path Decision Summary
Expected Scenario
Best-Case Scenario
Downside Scenario
Break-Even Points
What Could Reverse the Ranking
Red Flags and Material Assumptions
Questions to Ask
Next 7 Actions
Data Confidence

Rules: Put the current leading path and main reason in the first sentence. Keep Executive Takeaway under 100 words. Under The 3 Things That Matter Most, give exactly three numbered points. Under Path-by-Path Decision Summary, give each path one short "Why it could win" bullet and one "Main risk" bullet. Keep every other section to 3-5 bullets. Explain break-even timing in plain English; say when the data cannot support an exact crossover. Rank actions by importance. Keep the entire report under 1,300 words. End with one short beta decision-support disclaimer.`;

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
    if (existing?.analysis?.content && existing.analysis.formatVersion === 2 && existing.fingerprint === fingerprint) return json({ analysis: existing.analysis, preview: true, cached: true });
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
    const analysis = { version: 1, formatVersion: 2, betaPreview: true, content, generatedAt: new Date().toISOString(), planSnapshot: snapshot };
    await previewStore.setJSON(previewKey, { version: 1, status: "complete", fingerprint, analysis, updatedAt: analysis.generatedAt });
    return json({ analysis, preview: true, cached: false });
  } catch (error) {
    console.error("Deep Analysis beta error", error);
    return json({ error: error.name === "TimeoutError" ? "Generation took too long. Try the free beta preview again." : "Deep Analysis could not be generated right now. Try again shortly." }, 502);
  }
};

export const config = { path: "/api/deep-analysis", method: "POST", rateLimit: { action: "rate_limit", windowLimit: 6, windowSize: 180, aggregateBy: ["ip", "domain"] } };
