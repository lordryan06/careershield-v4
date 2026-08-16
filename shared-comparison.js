import { getStore } from "@netlify/blobs";
import { verifyRequestOrigin } from "@netlify/identity";
import { randomBytes } from "node:crypto";

const MAX_BYTES = 200000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});

const validToken = value => /^[a-f0-9]{24}$/.test(value || "");

export default async request => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const store = getStore({ name: "careershield-shared-comparisons", consistency: "strong" });
    if (request.method === "POST") {
      verifyRequestOrigin(request);
      if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return json({ error: "Comparison data is too large." }, 413);
      const body = await request.json();
      const plans = Array.isArray(body?.plans) ? body.plans.slice(0, 4) : [];
      if (!plans.length || plans.some(plan => !plan || typeof plan !== "object" || typeof plan.id !== "string")) return json({ error: "Add at least one valid path before creating a take-home link." }, 400);
      const token = randomBytes(12).toString("hex");
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + MAX_AGE_MS);
      await store.setJSON(`shares/${token}`, { version: 1, plans, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
      return json({ token, expiresAt: expiresAt.toISOString() }, 201);
    }
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!validToken(token)) return json({ error: "This take-home link is invalid." }, 400);
    const record = await store.get(`shares/${token}`, { type: "json" });
    if (!record) return json({ error: "This take-home comparison was not found or has expired." }, 404);
    if (!record.expiresAt || Date.now() > new Date(record.expiresAt).getTime()) {
      await store.delete(`shares/${token}`).catch(() => {});
      return json({ error: "This take-home comparison has expired. Ask the counselor or student to create a new copy." }, 410);
    }
    return json({ plans: record.plans, createdAt: record.createdAt, expiresAt: record.expiresAt });
  } catch (error) {
    console.error("Shared comparison error", error);
    return json({ error: "The take-home comparison service is temporarily unavailable." }, 500);
  }
};

export const config = { path: "/api/shared-comparison" };
