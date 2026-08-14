import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});

export default async request => {
  if (request.method !== "GET" && request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await getUser();
    if (!user?.id) return json({ error: "Log in to access saved plans." }, 401);
    const store = getStore({ name: "careershield-user-plans", consistency: "strong" });
    const key = `users/${user.id}`;
    if (request.method === "GET") {
      const record = await store.get(key, { type: "json" });
      return json({ plans: record?.plans ?? null, updatedAt: record?.updatedAt ?? null });
    }
    verifyRequestOrigin(request);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 200000) return json({ error: "Saved plan data is too large." }, 413);
    const body = await request.json();
    if (!Array.isArray(body?.plans) || body.plans.length > 4) return json({ error: "Save up to four valid plans." }, 400);
    const plans = body.plans.filter(plan => plan && typeof plan === "object" && typeof plan.id === "string").slice(0, 4);
    if (plans.length !== body.plans.length) return json({ error: "One or more plans are invalid." }, 400);
    const record = { version: 1, plans, updatedAt: new Date().toISOString() };
    await store.setJSON(key, record);
    return json({ saved: true, updatedAt: record.updatedAt });
  } catch (error) {
    console.error("Plan storage error", error);
    return json({ error: "Your plans could not be synchronized right now." }, 500);
  }
};

export const config = { path: "/api/plans" };
