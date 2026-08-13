const SCORECARD_URL = "https://api.data.gov/ed/collegescorecard/v1/schools.json";
const FIELDS = [
  "id", "school.name", "school.city", "school.state", "school.ownership", "school.school_url",
  "latest.cost.tuition.in_state", "latest.cost.tuition.out_of_state",
  "latest.cost.avg_net_price.overall", "latest.aid.median_debt.completers.overall",
  "latest.earnings.10_yrs_after_entry.median", "latest.completion.rate_suppressed.overall"
].join(",");

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" }
});

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const search = new URL(request.url).searchParams.get("search")?.trim();
  if (!search || search.length < 2) return json({ error: "Enter at least two characters." }, 400);
  if (search.length > 100) return json({ error: "Search is too long." }, 400);
  const apiKey = process.env.DATA_GOV_API_KEY;
  if (!apiKey) return json({ error: "School data is not configured." }, 503);

  const api = new URL(SCORECARD_URL);
  api.searchParams.set("api_key", apiKey);
  api.searchParams.set("school.name", search);
  api.searchParams.set("school.operating", "1");
  api.searchParams.set("fields", FIELDS);
  api.searchParams.set("per_page", "12");

  try {
    const response = await fetch(api, { signal: AbortSignal.timeout(10000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "College Scorecard could not complete the search." }, response.status);
    return json({ results: data.results || [], metadata: data.metadata || {} });
  } catch {
    return json({ error: "School search is temporarily unavailable." }, 502);
  }
};

export const config = { path: "/api/schools", method: "GET" };
