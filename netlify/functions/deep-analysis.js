import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const SYSTEM = `You produce CareerShield Deep Analysis, an instant decision-support product. Analyze only the supplied saved comparison and evidence. Do not invent facts, imply that a possible source match verifies a specific program, or guarantee outcomes. Clearly distinguish official data, user-entered values, CareerShield estimates, and unresolved verification needs. Use plain language and USD. Produce these headings exactly: Executive Takeaway; Ranking and Why; Expected Scenario; Best-Case Scenario; Downside Scenario; Break-Even Points; Red Flags and Material Assumptions; What Could Reverse the Ranking; Questions to Ask; Next 7 Actions; Data Confidence. Be specific to every compared path. State that this is educational decision support, not financial, legal, admissions, recruiting, or career counseling advice.`;

export default async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    verifyRequestOrigin(request);
    const user = await getUser();
    if (!user?.id) return json({ error: "Log in to access Deep Analysis." }, 401);
    const orderStore = getStore({ name: "careershield-report-orders", consistency: "strong" });
    const orderKey = `users/${user.id}`;
    const record = await orderStore.get(orderKey, { type: "json" }) || { version: 2, orders: [] };
    const order = record.orders.find(item => item.product === "deep_analysis" && item.status === "purchased");
    if (!order) return json({ error: "A verified Deep Analysis purchase was not found." }, 403);
    if (order.analysis?.content) return json({ analysis: order.analysis, order: { sessionId: order.sessionId, purchasedAt: order.purchasedAt } });
    if (order.analysisStatus === "generating" && order.analysisStartedAt && Date.now() - new Date(order.analysisStartedAt).getTime() < 120000) return json({ status: "generating", message: "Your Deep Analysis is being prepared." }, 202);

    const plansStore = getStore({ name: "careershield-user-plans", consistency: "strong" });
    const savedRecord = await plansStore.get(`users/${user.id}`, { type: "json" });
    const plans = Array.isArray(savedRecord?.plans) ? savedRecord.plans.slice(0, 4) : [];
    if (!plans.length) return json({ error: "Your saved comparison is missing. Restore at least one path before generating the analysis." }, 409);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: "Deep Analysis generation is not configured." }, 503);

    order.analysisStatus = "generating";
    order.analysisStartedAt = new Date().toISOString();
    record.updatedAt = order.analysisStartedAt;
    await orderStore.setJSON(orderKey, record);
    const snapshot = plans.map((plan, index) => ({
      rank: index + 1, path: plan.pathLabel, provider: plan.name, program: plan.program || plan.degree || null,
      programSource: plan.programSource || null, career: plan.career, score: plan.score, factors: plan.metrics,
      inputs: plan.inputs, fiveYearNet: plan.fiveYearNet, tenYearNet: plan.tenYearNet,
      timeline: plan.timeline, military: plan.militaryComp || null, apprenticeship: plan.tradeComp || null,
      training: plan.trainingComp || null, dataConfidence: plan.dataConfidence || null,
      officialProgramUrl: plan.officialProgramUrl || null, liveEvidence: plan.liveEvidence || null
    }));
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-5-mini", instructions: SYSTEM, input: `Saved CareerShield comparison:\n${JSON.stringify(snapshot)}`, max_output_tokens: 3200 }),
      signal: AbortSignal.timeout(50000)
    });
    const data = await response.json().catch(() => ({}));
    const content = data.output_text || (data.output || []).flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
    if (!response.ok || !content) throw new Error(data.error?.message || "The analysis could not be generated.");
    order.analysis = { version: 1, content, generatedAt: new Date().toISOString(), planSnapshot: snapshot };
    order.analysisStatus = "complete";
    order.updatedAt = order.analysis.generatedAt;
    record.updatedAt = order.updatedAt;
    await orderStore.setJSON(orderKey, record);
    return json({ analysis: order.analysis, order: { sessionId: order.sessionId, purchasedAt: order.purchasedAt } });
  } catch (error) {
    console.error("Deep Analysis error", error);
    return json({ error: error.name === "TimeoutError" ? "Generation took too long. Try again; your purchase remains available." : "Deep Analysis could not be generated right now. Your purchase remains available." }, 502);
  }
};

export const config = { path: "/api/deep-analysis", method: "POST", rateLimit: { action: "rate_limit", windowLimit: 6, windowSize: 300, aggregateBy: ["ip", "domain"] } };
