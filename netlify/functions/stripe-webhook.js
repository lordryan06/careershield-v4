import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { verifyReportReference } from "../lib/report-reference.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function verifyStripeSignature(body, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret.startsWith("whsec_")) throw new Error("Webhook secret is not configured.");
  const parts = String(header || "").split(",").map(value => value.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return signatures.some(value => value.length === expected.length && timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(expected, "hex")));
}

export default async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await request.text();
  try {
    if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"))) return json({ error: "Invalid Stripe signature" }, 400);
    const event = JSON.parse(rawBody);
    const supported = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"];
    if (!supported.includes(event.type)) return json({ received: true });
    const session = event.data?.object;
    const reference = verifyReportReference(session?.client_reference_id);
    if (!reference || !session?.id) return json({ received: true });

    const status = event.type === "checkout.session.async_payment_failed" ? "payment_failed" : session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded" ? "purchased" : "processing";
    const store = getStore({ name: "careershield-report-orders", consistency: "strong" });
    const key = `users/${reference.userId}`;
    const record = await store.get(key, { type: "json" }) || { version: 1, orders: [] };
    const existing = record.orders.findIndex(order => order.sessionId === session.id);
    const prior = existing >= 0 ? record.orders[existing] : null;
    const order = {
      sessionId: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      status,
      amountTotal: Number(session.amount_total || 0),
      currency: String(session.currency || "usd").toLowerCase(),
      customerEmail: session.customer_details?.email || session.customer_email || null,
      purchasedAt: prior?.purchasedAt || new Date(Number(session.created || event.created) * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      lastEventId: event.id
    };
    if (existing >= 0) record.orders[existing] = order; else record.orders.unshift(order);
    record.orders = record.orders.slice(0, 20);
    record.updatedAt = order.updatedAt;
    await store.setJSON(key, record);
    return json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error", error);
    return json({ error: "Webhook processing failed" }, 400);
  }
};

export const config = { path: "/api/stripe-webhook", method: "POST" };
