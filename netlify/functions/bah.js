import { ZIP_MHA, MHA_NAMES, WITH_DEPENDENTS, WITHOUT_DEPENDENTS } from "./bah-data.js";

const GRADES = [
  "E-1", "E-2", "E-3", "E-4", "E-5", "E-6", "E-7", "E-8", "E-9",
  "W-1", "W-2", "W-3", "W-4", "W-5", "O-1E", "O-2E", "O-3E",
  "O-1", "O-2", "O-3", "O-4", "O-5", "O-6", "O-7", "O-8", "O-9", "O-10"
];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=86400" }
});

export default async request => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const params = new URL(request.url).searchParams;
  const zip = params.get("zip")?.trim();
  const grade = params.get("grade")?.trim().toUpperCase();
  const dependents = params.get("dependents") === "with" ? "with" : "without";
  if (!/^\d{5}$/.test(zip || "")) return json({ error: "Enter a valid five-digit duty ZIP code." }, 400);
  const gradeIndex = GRADES.indexOf(grade);
  if (gradeIndex < 0) return json({ error: "Choose a valid pay grade." }, 400);
  const mha = ZIP_MHA[zip];
  if (!mha) return json({ error: "That ZIP code is not in the 2026 DoD BAH file." }, 404);
  const table = dependents === "with" ? WITH_DEPENDENTS : WITHOUT_DEPENDENTS;
  const monthly = table[mha]?.[gradeIndex];
  if (!Number.isFinite(monthly)) return json({ error: "A BAH rate was not available for that selection." }, 404);
  return json({ zip, grade, dependents, mha, location: MHA_NAMES[mha] || mha, monthly, year: 2026 });
};

export const config = { path: "/api/bah", method: "GET" };
