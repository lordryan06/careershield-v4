const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=86400" }
});
const number = value => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const annual = rows => list(rows).find(row => /annual|year/i.test(row.RateType || "")) || list(rows)[0] || null;

export default async request => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim();
  const zip = params.get("zip")?.trim();
  if (!/^\d{2}-\d{4}\.\d{2}$/.test(code || "") || !/^\d{5}$/.test(zip || "")) return json({ error: "Choose an occupation and enter a valid five-digit ZIP code." }, 400);
  const userId = process.env.CAREERONESTOP_USER_ID || process.env.COS_USER_ID;
  const token = process.env.CAREERONESTOP_API_TOKEN || process.env.CAREERONESTOP_TOKEN || process.env.COS_API_TOKEN;
  if (!userId || !token) return json({ error: "Local wage data is not configured.", code: "NOT_CONFIGURED" }, 503);
  try {
    const url = new URL(`https://api.careeronestop.org/v1/comparesalaries/${encodeURIComponent(userId)}/wage`);
    url.searchParams.set("keyword", code);
    url.searchParams.set("location", zip);
    url.searchParams.set("enableMetaData", "true");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "CareerOneStop local wage data is temporarily unavailable." }, response.status === 429 ? 429 : 502);
    const wages = data.OccupationDetail?.Wages || data.occupationDetail?.wages || {};
    const local = annual(wages.BLSAreaWagesList || wages.blsAreaWagesList), state = annual(wages.StateWagesList || wages.stateWagesList), national = annual(wages.NationalWagesList || wages.nationalWagesList), chosen = local || state || national;
    if (!chosen) return json({ error: "No wage record was returned for this occupation and ZIP code." }, 404);
    const multiplier = /hour/i.test(chosen.RateType || chosen.rateType || "Annual") ? 2080 : 1;
    const amount = key => { const parsed = number(chosen[key] ?? chosen[key[0].toLowerCase() + key.slice(1)]); return parsed == null ? null : Math.round(parsed * multiplier); };
    return json({ occupationCode: code, zip, geography: chosen.AreaName || chosen.areaName || (local ? `Area containing ${zip}` : state ? "State" : "United States"), geographyLevel: local ? "local" : state ? "state" : "national", annual: { low: amount("Pct10"), starting: amount("Pct25"), median: amount("Median"), high: amount("Pct75") }, source: "CareerOneStop / BLS OEWS", retrievedAt: new Date().toISOString() });
  } catch {
    return json({ error: "CareerOneStop local wage data is temporarily unavailable." }, 502);
  }
};
export const config = { path: "/api/local-wages", method: "GET" };
