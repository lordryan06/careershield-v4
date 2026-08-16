import QRCode from "qrcode";

export default async request => {
  const url = new URL(request.url).searchParams.get("url") || "";
  const origin = new URL(request.url).origin;
  let target;
  try { target = new URL(url); } catch { return new Response("Invalid URL", { status: 400 }); }
  if (target.origin !== origin || !/^[a-f0-9]{24}$/.test(target.searchParams.get("family") || "")) return new Response("Invalid share URL", { status: 400 });
  const svg = await QRCode.toString(target.toString(), { type: "svg", width: 260, margin: 1, color: { dark: "#071b30", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
};

export const config = { path: "/api/share-qr", method: "GET" };
