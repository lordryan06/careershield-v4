import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async request => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await getUser();
    if (!user?.id) return json({ error: "Log in to view report purchases." }, 401);
    const store = getStore({ name: "careershield-report-orders", consistency: "strong" });
    const record = await store.get(`users/${user.id}`, { type: "json" });
    return json({ orders: Array.isArray(record?.orders) ? record.orders : [] });
  } catch (error) {
    console.error("Report order lookup error", error);
    return json({ error: "Report purchases could not be loaded." }, 500);
  }
};

export const config = { path: "/api/report-orders", method: "GET" };
