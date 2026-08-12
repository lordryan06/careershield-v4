const BASE = "https://api-v2.onetcenter.org";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" }
});
const list = (value) => Array.isArray(value) ? value : value ? [value] : [];

async function onet(path, apiKey) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "O*NET request failed"), { status: response.status });
  return data;
}

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const params = new URL(request.url).searchParams;
  const apiKey = process.env.ONET_API_KEY;
  if (!apiKey) return json({ error: "Career data is not configured." }, 503);

  const code = params.get("code")?.trim();
  const search = params.get("search")?.trim();
  try {
    if (search) {
      if (search.length < 2 || search.length > 100) return json({ error: "Enter a search from 2 to 100 characters." }, 400);
      const data = await onet(`/online/search?keyword=${encodeURIComponent(search)}&start=1&end=12`, apiKey);
      return json({ results: list(data.occupation).map(o => ({ code: o.code, name: o.title, brightOutlook: Boolean(o.tags?.bright_outlook) })) });
    }
    if (!code || !/^\d{2}-\d{4}\.\d{2}$/.test(code)) return json({ error: "Provide a keyword or valid O*NET-SOC code." }, 400);
    const safe = encodeURIComponent(code);
    const paths = [
      `/mnm/careers/${safe}/`, `/mnm/careers/${safe}/job_outlook`,
      `/mnm/careers/${safe}/education`, `/mnm/careers/${safe}/explore_more`,
      `/online/occupations/${safe}/summary/tasks?start=1&end=5`
    ];
    const settled = await Promise.allSettled(paths.map(path => onet(path, apiKey)));
    if (settled[0].status === "rejected") throw settled[0].reason;
    const [career, outlook, education, explore, tasks] = settled.map(x => x.status === "fulfilled" ? x.value : {});
    return json({
      code: career.code || code,
      name: career.title,
      description: career.what_they_do || career.description || "",
      wage: outlook.salary || null,
      outlook: outlook.outlook || null,
      brightOutlook: list(outlook.bright_outlook),
      education: {
        jobZone: education.job_zone || null,
        usuallyNeeded: list(education.education_usually_needed)
      },
      relatedOccupations: list(explore.careers).slice(0, 8).map(o => ({ code: o.code, name: o.title })),
      industries: list(explore.industries).slice(0, 6).map(i => i.title),
      tasks: list(tasks.task).map(t => t.title)
    });
  } catch (error) {
    const status = error.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? "O*NET is busy. Please try again shortly." : "Career data is temporarily unavailable." }, status);
  }
};

export const config = { path: "/api/careers", method: "GET" };
