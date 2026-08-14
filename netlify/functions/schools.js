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

const firstNumber = (item, paths) => {
  for (const path of paths) {
    const value = item[path] ?? path.split(".").reduce((current, key) => current?.[key], item);
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
};

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim();
  const schoolId = params.get("programs")?.trim();
  const apiKey = process.env.DATA_GOV_API_KEY;
  if (!apiKey) return json({ error: "School data is not configured." }, 503);

  if (schoolId) {
    if (!/^\d{4,10}$/.test(schoolId)) return json({ error: "Choose a valid school." }, 400);
    const api = new URL(SCORECARD_URL);
    api.searchParams.set("api_key", apiKey);
    api.searchParams.set("id", schoolId);
    api.searchParams.set("fields", "id,school.name,latest.programs.cip_4_digit");
    try {
      const response = await fetch(api, { signal: AbortSignal.timeout(10000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return json({ error: "College Scorecard could not load this school’s programs." }, response.status);
      const row = (data.results || [])[0] || {};
      const nested = row.latest?.programs?.cip_4_digit;
      const dotted = row["latest.programs.cip_4_digit"];
      const raw = Array.isArray(nested) ? nested : Array.isArray(dotted) ? dotted : [];
      const seen = new Set();
      const programs = raw.map(item => ({
        code: String(item.code ?? item.cip_code ?? item["code"] ?? ""),
        title: String(item.title ?? item.cip_title ?? item["title"] ?? ""),
        credential: String(item.credential?.title ?? item.credential_title ?? item["credential.title"] ?? ""),
        credentialLevel: Number(item.credential?.level ?? item.credential_level ?? item["credential.level"]) || null,
        earnings: firstNumber(item, [
          "earnings.4_yrs_after_completion.median", "earnings.5_yrs_after_completion.median",
          "earnings.highest.4_yr.overall_median_earnings", "earnings.highest.3_yr.overall_median_earnings",
          "earnings.1_yr.overall_median_earnings", "earnings.1_yr_after_completion.median"
        ]),
        debt: firstNumber(item, [
          "debt.all_students.completers.median", "debt.all_students.completers.overall",
          "debt.all_students.completers.overall_median", "debt.all.student.median"
        ])
      })).filter(item => item.title && !seen.has(`${item.code}|${item.credential}`) && seen.add(`${item.code}|${item.credential}`));
      return json({ school: row.school?.name || row["school.name"] || "", programs });
    } catch {
      return json({ error: "School program data is temporarily unavailable." }, 502);
    }
  }
  if (!search || search.length < 2) return json({ error: "Enter at least two characters." }, 400);
  if (search.length > 100) return json({ error: "Search is too long." }, 400);

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
