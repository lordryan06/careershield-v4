const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=86400" }
});

const clean = (value, max = 140) => String(value || "").trim().slice(0, max);
const textValue = value => typeof value === "string" ? value : value?.en || value?.["en-US"] || Object.values(value || {})[0] || "";
const stripHtml = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&#36;/g, "$").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(9000) });
}

async function blsEvidence(code) {
  const soc = clean(code, 12);
  if (!/^\d{2}-\d{4}\.\d{2}$/.test(soc)) return { status: "not_applicable" };
  const profileCode = soc.replace(/\D/g, "").slice(0, 6);
  const url = `https://www.bls.gov/oes/2025/may/oes${profileCode}.htm`;
  try {
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": "CareerShield evidence retrieval" } });
    if (!response.ok) return { status: "unavailable", url, note: `BLS returned ${response.status}.` };
    const html = await response.text();
    const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const annualMedian = Number((stripHtml(html).match(/Annual median wage[^$]{0,160}\$([\d,]+)/i)?.[1] || "").replace(/,/g, "")) || null;
    const annualMean = Number((stripHtml(html).match(/Annual mean wage[^$]{0,160}\$([\d,]+)/i)?.[1] || "").replace(/,/g, "")) || null;
    return { status: "official", source: "BLS OEWS", release: "May 2025", soc, title, annualMedian, annualMean, url };
  } catch { return { status: "unavailable", url, note: "BLS was temporarily unreachable." }; }
}

async function ipedsEvidence(unitId, schoolName) {
  const id = clean(unitId, 10);
  if (!/^\d{4,10}$/.test(id)) return { status: "not_applicable" };
  const url = `https://nces.ed.gov/collegenavigator/?id=${id}`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return { status: "unavailable", unitId: id, url, note: `NCES returned ${response.status}.` };
    const html = await response.text();
    const pageText = stripHtml(html);
    const requestedName = clean(schoolName);
    const nameFound = requestedName ? pageText.toLowerCase().includes(requestedName.toLowerCase()) : null;
    return { status: "official", source: "NCES College Navigator / IPEDS", unitId: id, institutionNameMatched: nameFound, url };
  } catch { return { status: "unavailable", unitId: id, url, note: "NCES was temporarily unreachable." }; }
}

async function credentialEvidence(keyword) {
  const term = clean(keyword);
  if (!term) return { status: "not_applicable" };
  const apiKey = process.env.CREDENTIAL_ENGINE_API_KEY;
  if (!apiKey) return { status: "configuration_required", source: "Credential Engine Registry", note: "Add CREDENTIAL_ENGINE_API_KEY in Netlify to enable automatic Registry matching.", url: "https://credreg.net/registry/searchapi" };
  try {
    const response = await fetchWithTimeout("https://apps.credentialengine.org/assistant/search/ctdl", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ Query: { "@type": "ceterms:Credential", "ceterms:name": term }, Skip: 0, Take: 5, Sort: "search:relevance" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: response.status === 401 || response.status === 403 ? "configuration_required" : "unavailable", source: "Credential Engine Registry", note: `Registry returned ${response.status}.`, url: "https://credentialengineregistry.org/" };
    const raw = data.Results || data.results || data.SearchResults || [];
    const matches = (Array.isArray(raw) ? raw : []).slice(0, 5).map(item => ({
      name: textValue(item["ceterms:name"] || item.name),
      ctid: item["ceterms:ctid"] || item.CTID || item.ctid || "",
      type: Array.isArray(item["@type"]) ? item["@type"].join(", ") : item["@type"] || "",
      url: item["ceterms:subjectWebpage"] || item["@id"] || item.id || ""
    })).filter(item => item.name);
    return { status: "official", source: "Credential Engine Registry", query: term, matches, url: "https://credentialengineregistry.org/" };
  } catch { return { status: "unavailable", source: "Credential Engine Registry", note: "Registry was temporarily unreachable.", url: "https://credentialengineregistry.org/" }; }
}

async function vaEvidence(schoolName) {
  const term = clean(schoolName);
  if (!term) return { status: "not_applicable" };
  const url = `https://api.va.gov/v0/gi/institutions/autocomplete?term=${encodeURIComponent(term)}`;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: "unavailable", source: "VA GI Bill Comparison Tool", note: `VA returned ${response.status}.`, url: "https://www.va.gov/education/gi-bill-comparison-tool/schools-and-employers" };
    const raw = data.data || data.results || data;
    const matches = (Array.isArray(raw) ? raw : []).slice(0, 5).map(item => ({ name: item.name || item.value || item.label || item.attributes?.name || "", facilityCode: item.facility_code || item.facilityCode || item.attributes?.facility_code || "" })).filter(item => item.name);
    return { status: "official", source: "VA GI Bill Comparison Tool", query: term, matches, url: "https://www.va.gov/education/gi-bill-comparison-tool/schools-and-employers" };
  } catch { return { status: "unavailable", source: "VA GI Bill Comparison Tool", note: "VA school approval search was temporarily unreachable.", url: "https://www.va.gov/education/gi-bill-comparison-tool/schools-and-employers" }; }
}

export default async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const path = clean(body.path, 20);
  const schoolName = clean(body.schoolName);
  const [bls, ipeds, credential, va] = await Promise.all([
    blsEvidence(body.soc),
    path === "college" ? ipedsEvidence(body.unitId, schoolName) : Promise.resolve({ status: "not_applicable" }),
    path === "training" ? credentialEvidence(body.program || body.provider) : Promise.resolve({ status: "not_applicable" }),
    path === "college" ? vaEvidence(schoolName) : Promise.resolve({ status: "not_applicable" })
  ]);
  return json({ retrievedAt: new Date().toISOString(), bls, ipeds, credential, va });
};

export const config = { path: "/api/evidence", method: "POST" };
