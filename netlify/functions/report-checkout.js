import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { createReportReference } from "../lib/report-reference.js";

const LIVE_PAYMENT_LINK = "https://buy.stripe.com/9B63cxdf02Zj9qw5AAfUQ01";
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    verifyRequestOrigin(request);
    const user = await getUser();
    if (!user?.id || !user?.email) return json({ error: "Log in before purchasing a report." }, 401);
    const configuredLink = process.env.STRIPE_PAYMENT_LINK_URL || LIVE_PAYMENT_LINK;
    const url = new URL(configuredLink);
    if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com") throw new Error("Invalid Stripe Payment Link.");
    url.searchParams.set("client_reference_id", createReportReference(user.id));
    url.searchParams.set("locked_prefilled_email", user.email);
    return json({ url: url.toString() });
  } catch (error) {
    console.error("Report checkout error", error);
    return json({ error: "Secure report checkout is not configured yet." }, 503);
  }
};

export const config = { path: "/api/report-checkout", method: "POST" };
