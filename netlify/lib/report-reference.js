import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => {
  const value = process.env.STRIPE_CHECKOUT_REFERENCE_SECRET || "";
  if (value.length < 32) throw new Error("Checkout reference secret is not configured.");
  return value;
};

const signature = payload => createHmac("sha256", secret()).update(payload).digest("hex");

export function createReportReference(userId, product = "reviewed_report") {
  if (!/^(deep_analysis|reviewed_report|human_review_upgrade)$/.test(product)) throw new Error("Invalid checkout product.");
  const issued = Date.now().toString(36);
  const payload = `${userId}.${product}.${issued}`;
  return `${userId}_${product}_${issued}_${signature(payload)}`;
}

export function verifyReportReference(reference = "") {
  const match = String(reference).match(/^([A-Za-z0-9-]+)_(deep_analysis|reviewed_report|human_review_upgrade)_([0-9a-z]+)_([a-f0-9]{64})$/);
  if (!match) return null;
  const [, userId, product, issued, supplied] = match;
  const expected = signature(`${userId}.${product}.${issued}`);
  const valid = timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
  return valid ? { userId, product, issued } : null;
}
