import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

const MAX_BYTES = 200000;
const SHARE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
const validToken = value => /^[a-f0-9]{24}$/.test(value || "");

async function sharedComparison(request, url) {
  const action = url.searchParams.get("share");
  const store = getStore({ name: "careershield-shared-comparisons", consistency: "strong" });
  if (request.method === "POST" && action === "create") {
    verifyRequestOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return json({ error: "Comparison data is too large." }, 413);
    const body = await request.json();
    const plans = Array.isArray(body?.plans) ? body.plans.slice(0, 4) : [];
    if (!plans.length || plans.some(plan => !plan || typeof plan !== "object" || typeof plan.id !== "string")) return json({ error: "Add at least one valid path before creating a take-home link." }, 400);
    const token = randomBytes(12).toString("hex");
    const createdAt = new Date(), expiresAt = new Date(createdAt.getTime() + SHARE_MAX_AGE);
    await store.setJSON(`shares/${token}`, { version: 1, plans, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
    return json({ token, expiresAt: expiresAt.toISOString() }, 201);
  }
  if (request.method === "GET" && action === "open") {
    const token = url.searchParams.get("token") || "";
    if (!validToken(token)) return json({ error: "This take-home link is invalid." }, 400);
    const record = await store.get(`shares/${token}`, { type: "json" });
    if (!record) return json({ error: "This take-home comparison was not found or has expired." }, 404);
    if (!record.expiresAt || Date.now() > new Date(record.expiresAt).getTime()) {
      await store.delete(`shares/${token}`).catch(() => {});
      return json({ error: "This take-home comparison has expired. Create a new take-home plan." }, 410);
    }
    return json({ plans: record.plans, createdAt: record.createdAt, expiresAt: record.expiresAt });
  }
  if (request.method === "GET" && action === "qr") {
    const targetValue = url.searchParams.get("url") || "";
    let target;
    try { target = new URL(targetValue); } catch { return new Response("Invalid URL", { status: 400 }); }
    if (target.origin !== url.origin || !validToken(target.searchParams.get("family") || "")) return new Response("Invalid share URL", { status: 400 });
    const svg = await QRCode.toString(target.toString(), { type: "svg", width: 260, margin: 1, color: { dark: "#071b30", light: "#ffffff" } });
    return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
  }
  return json({ error: "Unknown take-home action." }, 404);
}

export default async request => {
  const url = new URL(request.url);
  if (url.searchParams.has("share")) {
    try { return await sharedComparison(request, url); }
    catch (error) {
      console.error("Shared comparison error", error);
      return json({ error: error?.message || "The take-home comparison service is temporarily unavailable." }, Number(error?.status || error?.statusCode) || 500);
    }
  }
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
    if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return json({ error: "Saved plan data is too large." }, 413);
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
