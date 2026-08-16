import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { createReportReference } from "../lib/report-reference.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    verifyRequestOrigin(request);
    const user = await getUser();
    if (!user?.id || !user?.email) return json({ error: "Log in before purchasing a report." }, 401);
    const plansStore = getStore({ name: "careershield-user-plans", consistency: "strong" });
    const savedRecord = await plansStore.get(`users/${user.id}`, { type: "json" });
    const savedPlans = Array.isArray(savedRecord?.plans) ? savedRecord.plans : [];
    if (!savedPlans.length) return json({ error: "Save and synchronize at least one comparison path before purchasing a report." }, 409);
    const body = await request.json().catch(() => ({}));
    const product = String(body.product || "reviewed_report");
    if (["reviewed_report", "human_review_upgrade", "partner_review"].includes(product)) {
      return json({ error: "CareerShield Partner Review is not accepting purchases until approved reviewers and fulfillment standards are in place." }, 409);
    }
    const products = {
      deep_analysis: process.env.DEEP_ANALYSIS_PAYMENT_LINK_URL
    };
    if (!(product in products)) return json({ error: "Choose a valid CareerShield product." }, 400);
    const configuredLink = products[product];
    if (!configuredLink) return json({ error: "Deep Analysis checkout is not configured yet." }, 503);
    const url = new URL(configuredLink);
    if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com") throw new Error("Invalid Stripe Payment Link.");
    url.searchParams.set("client_reference_id", createReportReference(user.id, product));
    url.searchParams.set("locked_prefilled_email", user.email);
    return json({ url: url.toString() });
  } catch (error) {
    console.error("Report checkout error", error);
    return json({ error: "Secure report checkout is not configured yet." }, 503);
  }
};

export const config = { path: "/api/report-checkout", method: "POST" };
